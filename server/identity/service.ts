import { randomInt, randomUUID } from "node:crypto";
import { CONSENT_VERSION, PILOT_CONSENT_VERSION, type PilotIdentityStatus, type PublicIdentity } from "../../shared/identity.js";
import { actionMatches, distance, isCurrent, quality, type FaceEngine, type FaceSample } from "./policy.js";
import { calibrationGate } from "./calibration.js";
import { identityStore, type IdentityRecord, type IdentityStore } from "./store.js";

export function identityError(message: string, status = 400) { return Object.assign(new Error(message), { status }); }
function threshold(): number {
  const gate = calibrationGate();
  // `development` is a local-only override and never becomes `ready`.
  if ((!gate.ready && !gate.development) || gate.threshold === null) throw identityError("La verificación facial requiere calibración aprobada. Solicita revisión manual.", 503);
  return gate.threshold;
}
function ttl(): number {
  const minutes = Number(process.env.FACE_VALIDITY_MINUTES ?? 30);
  return Math.max(1, Math.min(120, Number.isFinite(minutes) ? minutes : 30)) * 60_000;
}
/** Umbral experimental, independiente de la calibración aprobada. */
function pilotThreshold(): number {
  const raw = Number(process.env.FACE_PILOT_DISTANCE_THRESHOLD ?? 0.55);
  return Math.min(0.8, Math.max(0.3, Number.isFinite(raw) ? raw : 0.55));
}
function pilotRetentionDays(): number {
  const raw = Number(process.env.FACE_PILOT_RETENTION_DAYS ?? 7);
  return Math.max(1, Math.min(30, Number.isFinite(raw) ? raw : 7));
}
/** Calidad legible para la persona; nunca vectores ni fotogramas. */
export function pilotQualityReport(sample: FaceSample) {
  return {
    facePixels: Math.round(sample.facePixels),
    light: Math.round((sample.light / 255) * 100),
    sharpness: Math.max(0, Math.round(sample.sharpness)),
    yaw: Number(sample.yaw.toFixed(2)),
    roll: Math.round(sample.roll),
  };
}
export class IdentityService {
  constructor(readonly engine: FaceEngine, readonly store: IdentityStore = identityStore, readonly now = Date.now) {}
  async read(subject: string) {
    const r = await this.store.get(subject);
    if (r.challenge && r.challenge.expires <= this.now()) {
      delete r.challenge;
      await this.save(subject, r, subject, "challenge-retention", "deleted");
      r.revision++;
    }
    if (r.loginChallenge && r.loginChallenge.expires <= this.now()) {
      delete r.loginChallenge;
      await this.save(subject, r, subject, "login-challenge-retention", "deleted");
      r.revision++;
    }
    if (r.templateExpires && r.templateExpires <= this.now() && (r.template || r.challenge || r.loginChallenge)) {
      delete r.template; delete r.challenge; delete r.loginChallenge; delete r.templateExpires; r.validUntil = 0;
      await this.save(subject, r, subject, "retention", "deleted");
      r.revision++;
    }
    if (r.pilotTemplateExpires && r.pilotTemplateExpires <= this.now() && (r.pilotTemplate || r.pilotChallenge)) {
      delete r.pilotTemplate; delete r.pilotChallenge; delete r.pilotModel; delete r.pilotTemplateExpires;
      await this.save(subject, r, subject, "pilot-retention", "deleted");
      r.revision++;
    }
    return r;
  }
  async endShift(subject: string) {
    const r = await this.read(subject); r.validUntil = 0; delete r.challenge;
    await this.save(subject, r, subject, "end-shift");
  }
  async save(subject: string, r: IdentityRecord, actor: string, event: string, result = "ok", score?: number) {
    await this.store.save(subject, r, { actor, subject, event, result, ...(Number.isFinite(score) ? { score } : {}) });
  }
  async public(subject: string, firstName = false): Promise<PublicIdentity> {
    const r = await this.read(subject);
    const verified = isCurrent(r, this.now()) && (r.method === "manual" || r.model === this.engine.model);
    return { verified, name: r.approvedName ? (firstName ? r.approvedName.split(/\s+/)[0] : r.approvedName) : null,
      verifiedAt: r.verifiedAt ? new Date(r.verifiedAt).toISOString() : null,
      validUntil: r.validUntil ? new Date(r.validUntil).toISOString() : null, method: r.method ?? null };
  }
  async consent(subject: string) {
    const r = await this.read(subject);
    if (!r.consentAt || r.revoked) { r.consentAt = this.now(); r.consentVersion = CONSENT_VERSION; r.revoked = false; }
    await this.save(subject, r, subject, "consent");
  }
  async revoke(subject: string) {
    const r = await this.read(subject);
    delete r.template; delete r.challenge; delete r.model; delete r.templateExpires;
    delete r.loginChallenge; delete r.loginAttempts; delete r.loginLockedUntil;
    delete r.consentAt; r.revoked = true; r.validUntil = 0; delete r.method;
    await this.save(subject, r, subject, "consent", "revoked-template-deleted");
  }
  async manual(subject: string) {
    const r = await this.read(subject); r.manualRequested = true;
    await this.save(subject, r, subject, "manual-request");
  }
  async approve(subject: string, actor: string, name: string, documentRef: string, method: "face" | "manual") {
    const r = await this.read(subject);
    if (method === "face" && (!r.template || !r.consentAt || r.revoked || (r.templateExpires ?? 0) <= this.now())) throw identityError("Primero completa el enrolamiento autorizado.");
    if (method === "manual" && !r.manualRequested) throw identityError("La persona debe solicitar revisión manual.");
    r.approvedName = name; r.approvedBy = actor; r.documentRef = documentRef;
    delete r.challenge;
    if (method === "manual") {
      delete r.template; delete r.model; delete r.templateExpires;
      r.method = "manual"; r.revoked = false; r.verifiedAt = this.now(); r.validUntil = this.now() + ttl();
    } else { r.validUntil = 0; }
    await this.save(subject, r, actor, "admin-document-approval", method);
  }
  /* ── Acceso facial 1:1: la cuenta se elige antes del reto ───────────────── */
  /**
   * Estado de la credencial facial para la propia cuenta. No revela umbral,
   * modelo ni plantilla. Se calcula sobre el registro ya leído por la ruta.
   */
  faceLoginStatus(record: IdentityRecord) {
    const gate = calibrationGate();
    return {
      ready: (gate.ready || gate.development) && gate.threshold !== null && this.engine.available !== false,
      enrolled: !!record.template && !record.revoked && !!record.consentAt
        && record.consentVersion === CONSENT_VERSION && record.model === this.engine.model
        && (record.templateExpires ?? 0) > this.now(),
      locked: (record.loginLockedUntil ?? 0) > this.now(),
    };
  }
  async faceLoginChallenge(subject: string) {
    threshold();
    const r = await this.read(subject);
    if ((r.loginLockedUntil ?? 0) > this.now()) throw identityError("Demasiados intentos. Espera 15 minutos.", 429);
    if (r.revoked || !r.template || !r.consentAt || r.consentVersion !== CONSENT_VERSION
      || r.model !== this.engine.model || (r.templateExpires ?? 0) <= this.now()) {
      throw identityError("No pudimos iniciar sesión con tu rostro.", 401);
    }
    // Starting a challenge also counts; abandoning it cannot reset attempts.
    r.loginAttempts = (r.loginAttempts ?? 0) + 1;
    if (r.loginAttempts > 5) {
      r.loginLockedUntil = this.now() + 900_000; r.loginAttempts = 0;
      await this.save(subject, r, subject, "login-challenge", "locked");
      throw identityError("Demasiados intentos. Espera 15 minutos.", 429);
    }
    const direction = randomInt(2) ? "left" : "right";
    r.loginChallenge = {
      id: randomUUID(),
      actions: ["center", direction, "center", direction === "left" ? "right" : "left", "center"],
      step: 0, issued: this.now(), expires: this.now() + 90_000,
    };
    await this.save(subject, r, subject, "login-challenge", "issued");
    return { id: r.loginChallenge.id, action: r.loginChallenge.actions[0], step: 0 };
  }
  async faceLoginFrame(subject: string, id: string, image: Buffer) {
    try {
      const limit = threshold();
      const r = await this.read(subject); const c = r.loginChallenge;
      if (!c || c.id !== id || c.expires <= this.now()) throw identityError("Reto vencido o utilizado. Solicita uno nuevo.", 409);
      // Re-check the credential: a revocation or expiry between challenge and
      // frame must never fall back to the frame's own baseline.
      if (r.revoked || !r.template || !r.consentAt || r.consentVersion !== CONSENT_VERSION
        || r.model !== this.engine.model || (r.templateExpires ?? 0) <= this.now()) {
        throw identityError("No pudimos iniciar sesión con tu rostro.", 401);
      }
      if (this.now() - c.issued < 300) throw identityError("Espera a completar el movimiento indicado.");
      let score: number | undefined;
      try {
        const sample = await this.engine.analyze(image, false);
        const guide = quality(sample, c.actions[c.step]);
        if (guide) throw identityError(guide);
        if (!actionMatches(c.actions[c.step], sample)) throw identityError("No se detectó el movimiento solicitado. Reinicia el reto.");
        if (!c.baseline) c.baseline = sample.descriptor;
        score = distance(r.template, sample.descriptor);
        if (score > limit || distance(c.baseline, sample.descriptor) > limit) throw identityError("No pudimos iniciar sesión con tu rostro.", 401);
        c.step++;
        if (c.step === c.actions.length) {
          // El acceso facial no concede identidad verificada: solo autentica.
          delete r.loginChallenge; r.loginAttempts = 0;
          await this.save(subject, r, subject, "login", "passed", score);
          return { done: true, distance: Number(score.toFixed(3)) };
        }
        c.id = randomUUID(); c.issued = this.now();
        await this.save(subject, r, subject, "login-step", "passed", score);
        return { done: false, id: c.id, action: c.actions[c.step], step: c.step };
      } catch (error) {
        delete r.loginChallenge;
        await this.save(subject, r, subject, "login", "rejected", score);
        if ((error as any).status) throw error;
        throw identityError("No pudimos procesar el rostro. Revisa luz, distancia y posición.");
      }
    } finally { image.fill(0); }
  }
  /* ── Piloto experimental: no concede identidad verificada ni sesiones ─── */
  async pilotStatus(subject: string): Promise<Omit<PilotIdentityStatus, "invited">> {
    const r = await this.read(subject);
    return {
      consent: !!r.pilotConsentAt && r.pilotConsentVersion === PILOT_CONSENT_VERSION,
      enrolled: !!r.pilotTemplate && (r.pilotTemplateExpires ?? 0) > this.now(),
      ready: this.engine.available !== false,
      model: this.engine.model,
      threshold: pilotThreshold(),
      retentionDays: pilotRetentionDays(),
      last: r.pilotLastAt
        ? { at: new Date(r.pilotLastAt).toISOString(), distance: r.pilotLastDistance ?? null, quality: r.pilotLastQuality ?? null }
        : null,
    };
  }
  async pilotConsent(subject: string, version: string) {
    const r = await this.read(subject);
    r.pilotConsentAt = this.now(); r.pilotConsentVersion = version;
    await this.save(subject, r, subject, "pilot-consent", "authorized");
  }
  async pilotRevoke(subject: string) {
    const r = await this.read(subject);
    delete r.pilotTemplate; delete r.pilotChallenge; delete r.pilotModel; delete r.pilotTemplateExpires;
    delete r.pilotConsentAt; delete r.pilotConsentVersion; delete r.pilotLastAt;
    delete r.pilotLastDistance; delete r.pilotLastQuality;
    await this.save(subject, r, subject, "pilot-consent", "revoked-template-deleted");
  }
  async pilotChallenge(subject: string, purpose: "enroll" | "verify") {
    const r = await this.read(subject);
    if (!r.pilotConsentAt || r.pilotConsentVersion !== PILOT_CONSENT_VERSION) {
      throw identityError("Autoriza primero la prueba experimental en esta pantalla.", 403);
    }
    if ((r.pilotLockedUntil ?? 0) > this.now()) throw identityError("Demasiados intentos. Espera 15 minutos.", 429);
    if (purpose === "enroll" && r.pilotTemplate) throw identityError("Ya hay una muestra piloto. Revócala para reemplazarla.", 409);
    if (purpose === "verify" && (!r.pilotTemplate || r.pilotModel !== this.engine.model || (r.pilotTemplateExpires ?? 0) <= this.now())) {
      throw identityError("Primero enrola tu rostro en el piloto.", 403);
    }
    r.pilotAttempts = (r.pilotAttempts ?? 0) + 1;
    if (r.pilotAttempts > 5) {
      r.pilotLockedUntil = this.now() + 900_000; r.pilotAttempts = 0;
      await this.save(subject, r, subject, "pilot-challenge", "locked");
      throw identityError("Demasiados intentos. Espera 15 minutos.", 429);
    }
    const direction = randomInt(2) ? "left" : "right";
    r.pilotChallenge = {
      id: randomUUID(),
      actions: ["center", direction, "center", direction === "left" ? "right" : "left", "center"],
      step: 0, issued: this.now(), expires: this.now() + 90_000, purpose,
    };
    await this.save(subject, r, subject, "pilot-challenge", purpose);
    return { id: r.pilotChallenge.id, action: r.pilotChallenge.actions[0], step: 0, purpose, threshold: pilotThreshold() };
  }
  async pilotFrame(subject: string, id: string, image: Buffer) {
    const r = await this.read(subject); const c = r.pilotChallenge;
    if (!r.pilotConsentAt || r.pilotConsentVersion !== PILOT_CONSENT_VERSION || !c || c.id !== id || c.expires <= this.now()) {
      throw identityError("Reto vencido o utilizado. Solicita uno nuevo.", 409);
    }
    if (this.now() - c.issued < 300) throw identityError("Espera a completar el movimiento indicado.");
    let score = 0;
    let qualityReport: ReturnType<typeof pilotQualityReport> | undefined;
    try {
      const sample = await this.engine.analyze(image, c.purpose === "enroll");
      qualityReport = pilotQualityReport(sample);
      const guide = quality(sample, c.actions[c.step]);
      if (guide) throw identityError(guide);
      if (!actionMatches(c.actions[c.step], sample)) throw identityError("No se detectó el movimiento solicitado. Reinicia la prueba.");
      if (!c.baseline) c.baseline = sample.descriptor;
      const limit = pilotThreshold();
      score = distance(c.purpose === "enroll" ? c.baseline : (r.pilotTemplate ?? c.baseline), sample.descriptor);
      if (distance(c.baseline, sample.descriptor) > limit) throw identityError("Los fotogramas no parecen de la misma persona.");
      const rejected = score > limit;
      c.step++;
      const report = {
        quality: qualityReport,
        distance: Number(score.toFixed(3)),
        threshold: limit,
        result: rejected ? "rejected" : "passed",
        experimental: true,
      };
      if (rejected) {
        delete r.pilotChallenge;
        await this.save(subject, r, subject, "pilot-verify", "rejected", score);
        return { done: false, rejected: true, ...report, message: "El resultado supera el umbral experimental. La identidad no está validada; puedes intentarlo de nuevo." };
      }
      if (c.step === c.actions.length) {
        if (c.purpose === "enroll") {
          r.pilotTemplate = c.baseline; r.pilotModel = this.engine.model;
          r.pilotTemplateExpires = this.now() + pilotRetentionDays() * 86400_000;
        }
        r.pilotLastAt = this.now(); r.pilotLastDistance = score; r.pilotLastQuality = qualityReport.light;
        delete r.pilotChallenge; r.pilotAttempts = 0;
        await this.save(subject, r, subject, c.purpose === "enroll" ? "pilot-enroll" : "pilot-verify", "passed", score);
        return {
          done: true, ...report,
          message: c.purpose === "enroll"
            ? "Muestra piloto guardada. La identidad sigue sin validar."
            : "Tu rostro coincide con la muestra piloto. La identidad sigue sin validar.",
        };
      }
      c.id = randomUUID(); c.issued = this.now();
      await this.save(subject, r, subject, "pilot-challenge-step", "passed", score);
      return { done: false, id: c.id, action: c.actions[c.step], step: c.step, ...report };
    } catch (error) {
      delete r.pilotChallenge;
      await this.save(subject, r, subject, "pilot-verify", "rejected", score);
      if ((error as any).status) {
        (error as any).quality = qualityReport;
        (error as any).distance = Number(score.toFixed(3));
      }
      throw error;
    } finally { image.fill(0); }
  }
  async challenge(subject: string, purpose: "enroll" | "verify") {
    threshold();
    const r = await this.read(subject);
    if (!r.consentAt || r.revoked || r.consentVersion !== CONSENT_VERSION) throw identityError("Autoriza primero el tratamiento biométrico o solicita revisión manual.", 403);
    if ((r.lockedUntil ?? 0) > this.now()) throw identityError("Demasiados intentos. Espera 15 minutos.", 429);
    if (purpose === "enroll" && r.template) throw identityError("Ya hay una plantilla. Revoca y solicita nuevo enrolamiento para reemplazarla.", 409);
    if (purpose === "verify" && (!r.template || !r.approvedName || r.model !== this.engine.model)) throw identityError("Necesitas un enrolamiento documental aprobado con el modelo actual.", 403);
    // Starting a challenge also counts; repeatedly abandoning cannot reset attempts.
    r.attempts = (r.attempts ?? 0) + 1;
    if (r.attempts > 5) { r.lockedUntil = this.now() + 900_000; r.attempts = 0; await this.save(subject, r, subject, "challenge", "locked"); throw identityError("Demasiados intentos. Espera 15 minutos.", 429); }
    const direction = randomInt(2) ? "left" : "right";
    r.challenge = { id: randomUUID(), actions: ["center", direction, "center", direction === "left" ? "right" : "left", "center"], step: 0, issued: this.now(), expires: this.now() + 90_000, purpose };
    await this.save(subject, r, subject, "challenge", purpose);
    return { id: r.challenge.id, action: r.challenge.actions[0], step: 0 };
  }
  async frame(subject: string, id: string, image: Buffer) {
    const limit = threshold();
    const r = await this.read(subject); const c = r.challenge;
    if (!r.consentAt || r.revoked || !c || c.id !== id || c.expires <= this.now()) throw identityError("Reto vencido o utilizado. Solicita uno nuevo.", 409);
    if (this.now() - c.issued < 300) throw identityError("Espera a completar el movimiento indicado.");
    let score: number | undefined;
    try {
      const sample = await this.engine.analyze(image, c.purpose === "enroll");
      const guide = quality(sample, c.actions[c.step]);
      if (guide) throw identityError(guide);
      if (!actionMatches(c.actions[c.step], sample)) throw identityError("No se detectó el movimiento solicitado. Reinicia el reto.");
      if (!c.baseline) c.baseline = sample.descriptor;
      score = distance(r.template ?? c.baseline, sample.descriptor);
      if (score > limit || distance(c.baseline, sample.descriptor) > limit) throw identityError("No pudimos confirmar tu identidad.");
      c.step++;
      if (c.step === c.actions.length) {
        if (c.purpose === "enroll") {
          r.template = c.baseline; r.model = this.engine.model; r.templateExpires = this.now() + 30 * 86400_000;
          // Re-enrollment always needs a fresh document review.
          delete r.approvedName; delete r.approvedBy; delete r.documentRef; r.validUntil = 0;
        } else {
          r.method = "face"; r.verifiedAt = this.now();
          // Random recheck is a server-side deadline, never trusted client randomness.
          r.validUntil = Math.min(this.now() + Math.round(ttl() * (0.5 + randomInt(501) / 1000)), r.templateExpires!);
        }
        delete r.challenge; r.attempts = 0;
        await this.save(subject, r, subject, c.purpose, "passed", score);
        return { done: true, pendingApproval: c.purpose === "enroll" };
      }
      c.id = randomUUID(); c.issued = this.now();
      await this.save(subject, r, subject, "challenge-step", "passed", score);
      return { done: false, id: c.id, action: c.actions[c.step], step: c.step };
    } catch (error) {
      delete r.challenge; r.validUntil = 0;
      await this.save(subject, r, subject, c.purpose, "rejected", score);
      if ((error as any).status) throw error;
      throw identityError("No pudimos procesar el rostro. Revisa luz, distancia y posición.");
    } finally { image.fill(0); }
  }
}
