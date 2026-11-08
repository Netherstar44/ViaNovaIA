import { randomInt, randomUUID } from "node:crypto";
import { CONSENT_VERSION, type PublicIdentity } from "../../shared/identity.js";
import { actionMatches, distance, isCurrent, quality, type FaceEngine } from "./policy.js";
import { identityStore, type IdentityRecord, type IdentityStore } from "./store.js";

export function identityError(message: string, status = 400) { return Object.assign(new Error(message), { status }); }
function threshold(): number {
  const value = Number(process.env.FACE_DISTANCE_THRESHOLD);
  if (!(value > 0 && value < 1) || !process.env.FACE_CALIBRATION_ID) throw identityError("La verificación facial requiere calibración. Solicita revisión manual.", 503);
  return value;
}
function ttl(): number {
  const minutes = Number(process.env.FACE_VALIDITY_MINUTES ?? 30);
  return Math.max(1, Math.min(120, Number.isFinite(minutes) ? minutes : 30)) * 60_000;
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
    if (r.templateExpires && r.templateExpires <= this.now() && (r.template || r.challenge)) {
      delete r.template; delete r.challenge; delete r.templateExpires; r.validUntil = 0;
      await this.save(subject, r, subject, "retention", "deleted");
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
