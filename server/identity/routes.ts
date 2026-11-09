import type { Express, RequestHandler } from "express";
import { z } from "zod";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { normalizeEmail, requireAuth, requireRole, sanitizeSingleLine } from "../security.js";
import { faceLoginIpLimiter, faceLoginLimiter } from "../rate-limits.js";
import { CONSENT_VERSION, PILOT_CONSENT_VERSION } from "../../shared/identity.js";
import { FACE_MODEL, type FaceEngine } from "./policy.js";
import { calibrationGate } from "./calibration.js";
import { IdentityService, identityError } from "./service.js";
import { pilotAccess, type PilotInvite } from "./pilot-access.js";

let nodeEngine: FaceEngine | undefined;
/** Installed only by the Node server entry. Workers never imports native canvas/TFJS. */
export function configureFaceEngine(engine: FaceEngine): void { nodeEngine = engine; }
export const identities = new IdentityService({
  model: FACE_MODEL,
  get available() { return !!nodeEngine; },
  async analyze(image, enrollment) {
    if (!nodeEngine) throw identityError("El motor requiere un servidor Node 22. Solicita revisión manual.", 503);
    return nodeEngine.analyze(image, enrollment);
  },
});
export function requireCurrentIdentity(service = identities): RequestHandler {
  return async (req: any, res, next) => {
    try {
      if (!(await service.public(req.user.username)).verified) return res.status(403).json({ message: "Verifica tu identidad para recibir solicitudes." });
      next();
    } catch { res.status(503).json({ message: "No se pudo comprobar la identidad." }); }
  };
}

export type PilotAccess = {
  get(username: string): Promise<PilotInvite | null>;
  list(): Promise<PilotInvite[]>;
  invite(username: string, actor: string, note: string | null): Promise<void>;
  revoke(username: string): Promise<boolean>;
};

const input = {
  consent: z.object({ version: z.literal(CONSENT_VERSION), accepted: z.literal(true) }).strict(),
  challenge: z.object({ purpose: z.enum(["enroll", "verify"]) }).strict(),
  frame: z.object({ id: z.uuid(), jpeg: z.string().min(16).max(320_000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict(),
  approval: z.object({ name: z.string().trim().min(3).max(120).regex(/^[\p{L}\p{M} .'-]+$/u), documentRef: z.string().trim().min(6).max(160), method: z.enum(["face", "manual"]), documentChecked: z.literal(true) }).strict(),
  pilotConsent: z.object({ version: z.literal(PILOT_CONSENT_VERSION), accepted: z.literal(true) }).strict(),
  pilotChallenge: z.object({ purpose: z.enum(["enroll", "verify"]) }).strict(),
  invite: z.object({ username: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9_.@-]+$/), note: z.string().trim().max(160).optional() }).strict(),
  faceLoginChallenge: z.object({ identifier: z.string().trim().min(3).max(254) }).strict(),
  faceLoginFrame: z.object({ identifier: z.string().trim().min(3).max(254), id: z.uuid(), jpeg: z.string().min(16).max(320_000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict(),
};

/** Cuenta mínima que necesita el acceso facial. Nunca se expone al cliente. */
export type FaceLoginUser = {
  id: string; username: string; email?: string | null;
  deletedAt?: unknown; lockUntil?: Date | string | null; twoFactorEnabled?: string | null;
  [key: string]: unknown;
};
/** Inyectable para pruebas HTTP sin base de datos ni correo real. */
export type FaceLoginDependencies = {
  findUser(identifier: string): Promise<FaceLoginUser | null>;
  resetLock(user: FaceLoginUser): Promise<void>;
  beginTwoFactor(user: FaceLoginUser): Promise<unknown>;
  issueSession(req: any, res: any, user: FaceLoginUser): Promise<unknown> | unknown;
};
const defaultFaceLoginDependencies: FaceLoginDependencies = {
  async findUser(identifier) {
    const { storage } = await import("../storage.js");
    const user = await storage.getUserByUsername(identifier);
    if (user) return user as FaceLoginUser;
    return identifier.includes("@") ? (await storage.getUserByEmail(identifier) as FaceLoginUser | null) : null;
  },
  async resetLock(user) {
    const { getDb } = await import("../storage.js");
    const { sql } = await import("drizzle-orm");
    await getDb().execute(sql`UPDATE users SET failed_login_attempts = 0, lock_until = NULL WHERE id = ${user.id}`);
  },
  async beginTwoFactor(user) {
    const { beginTwoFactorChallenge } = await import("../two-factor.js");
    return beginTwoFactorChallenge(user);
  },
  issueSession(req, res, user) {
    return import("../auth-session.js").then(({ issueSession }) => issueSession(req, res, user, { done: true }));
  },
};
const GENERIC_FACE_LOGIN = "No pudimos iniciar sesión con tu rostro.";
function normalizedIdentifier(raw: unknown): string {
  const value = sanitizeSingleLine(raw, 254);
  if (!value) return "";
  return value.includes("@") ? normalizeEmail(value) : value;
}
function accountLockResponse(user: FaceLoginUser) {
  const until = user.lockUntil ? new Date(user.lockUntil).getTime() : 0;
  if (!Number.isFinite(until) || until <= Date.now()) return null;
  const minutes = Math.max(1, Math.ceil((until - Date.now()) / 60_000));
  return { status: 423, message: `Cuenta bloqueada temporalmente. Intenta de nuevo en ${minutes} minuto(s).` };
}

export function registerIdentityRoutes(app: Express, service = identities, access: PilotAccess = pilotAccess, faceLogin: FaceLoginDependencies = defaultFaceLoginDependencies) {
  const accountLimit = rateLimit({ windowMs: 900_000, limit: 30, keyGenerator: (req: any) => String(req.user.id), standardHeaders: "draft-7", legacyHeaders: false });
  const ipLimit = rateLimit({ windowMs: 900_000, limit: 90, keyGenerator: req => ipKeyGenerator(req.ip || "0.0.0.0"), standardHeaders: "draft-7", legacyHeaders: false });
  const route = (handler: (req: any) => Promise<unknown>): RequestHandler => async (req, res) => {
    try { res.json(await handler(req)); }
    catch (error: any) {
      const status = [400, 403, 404, 409, 429, 503].includes(error?.status) ? error.status : 503;
      // No native decoder stack or image/descriptor in logs or responses.
      const quality = (error as any)?.quality;
      const distance = (error as any)?.distance;
      res.status(status).json({
        message: status === 503 ? "Verificación no disponible. Solicita revisión manual al administrador." : error.message,
        ...(quality ? { quality, distance } : {}),
      });
    }
  };
  const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw identityError("Datos de verificación inválidos.");
    return parsed.data;
  };
  const requirePilot: RequestHandler = async (req: any, res, next) => {
    try {
      if (!(await access.get(req.user.username))) {
        return res.status(403).json({ message: "Esta cuenta no está invitada al piloto experimental." });
      }
      return next();
    } catch {
      return res.status(503).json({ message: "No se pudo comprobar la invitación al piloto." });
    }
  };
  const isAdmin = (req: any) => {
    if (req.user.role !== "admin") throw identityError("Cambia a tu sesión administrativa.", 403);
  };
  // Una sola inferencia a la vez para identidad, piloto y acceso facial.
  let processing = false;
  /** El acceso facial nunca enumera cuentas ni revela si hay plantilla. */
  const faceLoginError = (res: any, error: any) => {
    const rawStatus = Number(error?.status);
    const status = [400, 401, 403, 409, 423, 429, 503].includes(rawStatus) ? rawStatus : 503;
    res.set("Cache-Control", "no-store");
    if (status === 401 || status === 403) return res.status(401).json({ message: GENERIC_FACE_LOGIN });
    if (status === 503) return res.status(503).json({ message: "El acceso facial no está disponible. Usa tu contraseña." });
    return res.status(status).json({ message: error?.message || GENERIC_FACE_LOGIN });
  };
  const resolveFaceLoginUser = async (raw: unknown): Promise<FaceLoginUser | null> => {
    const identifier = normalizedIdentifier(raw);
    if (!identifier) return null;
    const user = await faceLogin.findUser(identifier);
    return user && !user.deletedAt ? user : null;
  };

  /* ── Acceso facial público 1:1 (sin sesión previa) ──────────────────────── */
  app.post("/api/identity/login/challenge", faceLoginLimiter, faceLoginIpLimiter, async (req, res) => {
    try {
      const data = parse(input.faceLoginChallenge, req.body);
      const user = await resolveFaceLoginUser(data.identifier);
      if (!user) return res.status(401).json({ message: GENERIC_FACE_LOGIN });
      const locked = accountLockResponse(user);
      if (locked) return res.status(locked.status).json({ message: locked.message });
      res.set("Cache-Control", "no-store");
      return res.json(await service.faceLoginChallenge(user.username));
    } catch (error: any) { return faceLoginError(res, error); }
  });
  app.post("/api/identity/login/frame", faceLoginLimiter, faceLoginIpLimiter, async (req, res) => {
    try {
      const data = parse(input.faceLoginFrame, req.body);
      const user = await resolveFaceLoginUser(data.identifier);
      if (!user) return res.status(401).json({ message: GENERIC_FACE_LOGIN });
      const locked = accountLockResponse(user);
      if (locked) return res.status(locked.status).json({ message: locked.message });
      if (processing) throw identityError("El motor está ocupado. Reintenta el reto en unos segundos.", 429);
      processing = true;
      let result: any;
      try { result = await service.faceLoginFrame(user.username, data.id, Buffer.from(data.jpeg, "base64")); }
      finally { processing = false; }
      if (!result?.done) { res.set("Cache-Control", "no-store"); return res.json(result); }
      // El rostro es un factor: la sesión sigue pasando por 2FA si está activo.
      await faceLogin.resetLock(user);
      if (String(user.twoFactorEnabled) === "true") {
        res.set("Cache-Control", "no-store");
        return res.json({ done: true, ...(await faceLogin.beginTwoFactor(user) as Record<string, unknown>) });
      }
      return await faceLogin.issueSession(req, res, user);
    } catch (error: any) { return faceLoginError(res, error); }
  });

  app.use("/api/identity", requireAuth);

  app.get("/api/identity/me", route(async req => {
    const r = await service.read(req.user.username);
    const manualReady = /^[a-f\d]{64}$/i.test(process.env.BIOMETRIC_ENCRYPTION_KEY ?? '');
    const calibration = calibrationGate();
    const consentReady = process.env.NODE_ENV !== 'production' || process.env.FACE_CONSENT_LEGAL_APPROVED === 'true';
    const invite = await access.get(req.user.username).catch(() => null);
    const pilot = await service.pilotStatus(req.user.username).catch(() => null);
    return {
      identity: await service.public(req.user.username),
      consent: !!r.consentAt && !r.revoked && r.consentVersion === CONSENT_VERSION,
      enrolled: !!r.template,
      pendingApproval: !!r.template && !r.approvedName,
      manualRequested: !!r.manualRequested,
      manualReady,
      faceReady: manualReady && (calibration.ready || calibration.development) && consentReady && service.engine.available !== false,
      // El cliente necesita saber si esto es una prueba local o producción
      // aprobada. Nunca se envía el umbral ni el identificador de calibración.
      calibration: {
        ready: calibration.ready,
        development: calibration.development,
        reason: calibration.ready || calibration.development ? null : calibration.reason,
      },
      faceLogin: service.faceLoginStatus(r),
      pilot: {
        invited: !!invite,
        consent: pilot?.consent ?? false,
        enrolled: pilot?.enrolled ?? false,
        // El piloto no depende de la calibración ni del consentimiento legal:
        // es una prueba etiquetada que nunca concede identidad verificada.
        ready: !!invite && manualReady && pilot?.ready === true,
        model: pilot?.model ?? null,
        threshold: pilot?.threshold ?? null,
        retentionDays: pilot?.retentionDays ?? 0,
        last: pilot?.last ?? null,
      },
    };
  }));
  app.post("/api/identity/consent", accountLimit, route(async req => {
    if (process.env.NODE_ENV === "production" && process.env.FACE_CONSENT_LEGAL_APPROVED !== "true") throw identityError("Consentimiento legal pendiente de revisión.", 503);
    parse(input.consent, req.body); await service.consent(req.user.username); return { ok: true };
  }));
  app.delete("/api/identity/consent", route(async req => { await service.revoke(req.user.username); return { ok: true }; }));
  app.post("/api/identity/manual", accountLimit, route(async req => { await service.manual(req.user.username); return { ok: true }; }));
  app.post("/api/identity/challenge", accountLimit, ipLimit, route(req => service.challenge(req.user.username, parse(input.challenge, req.body).purpose)));
  app.post("/api/identity/frame", accountLimit, ipLimit, route(async req => {
    const data = parse(input.frame, req.body);
    if (processing) throw identityError("El motor está ocupado. Reintenta el reto en unos segundos.", 429);
    processing = true;
    try { return await service.frame(req.user.username, data.id, Buffer.from(data.jpeg, "base64")); }
    finally { processing = false; }
  }));

  /* ── Piloto experimental por invitación ─────────────────────────────────── */
  app.post("/api/identity/pilot/consent", requirePilot, accountLimit, route(async req => {
    const data = parse(input.pilotConsent, req.body);
    await service.pilotConsent(req.user.username, data.version);
    return { ok: true };
  }));
  app.delete("/api/identity/pilot/consent", requirePilot, route(async req => {
    await service.pilotRevoke(req.user.username);
    return { ok: true };
  }));
  app.post("/api/identity/pilot/challenge", requirePilot, accountLimit, ipLimit, route(req =>
    service.pilotChallenge(req.user.username, parse(input.pilotChallenge, req.body).purpose)));
  app.post("/api/identity/pilot/frame", requirePilot, accountLimit, ipLimit, route(async req => {
    const data = parse(input.frame, req.body);
    if (processing) throw identityError("El motor está ocupado. Reintenta el reto en unos segundos.", 429);
    processing = true;
    try { return await service.pilotFrame(req.user.username, data.id, Buffer.from(data.jpeg, "base64")); }
    finally { processing = false; }
  }));

  /* ── Administración de la allowlist del piloto ──────────────────────────── */
  app.get("/api/identity/admin/pilot", requireRole("admin"), route(async req => {
    isAdmin(req);
    return { invites: await access.list() };
  }));
  app.post("/api/identity/admin/pilot", requireRole("admin"), accountLimit, route(async req => {
    isAdmin(req);
    const data = parse(input.invite, req.body);
    const { storage } = await import("../storage.js");
    const target = await storage.getUserByUsername(data.username);
    if (!target || target.deletedAt) throw identityError("Esa cuenta no existe.", 404);
    await access.invite(target.username, req.user.username, data.note ?? null);
    return { ok: true, username: target.username };
  }));
  app.delete("/api/identity/admin/pilot/:username", requireRole("admin"), route(async req => {
    isAdmin(req);
    const username = String(req.params.username);
    if (!/^[A-Za-z0-9_.@-]{3,80}$/.test(username)) throw identityError("Usuario inválido.");
    const removed = await access.revoke(username);
    if (!removed) throw identityError("Esa cuenta no estaba invitada.", 404);
    return { ok: true };
  }));

  // RBAC from DB + active session role: neither client roles nor username confer admin access.
  app.post("/api/identity/admin/:username/approve", requireRole("admin"), accountLimit, route(async req => {
    if (req.user.role !== "admin") throw identityError("Cambia a tu sesión administrativa.", 403);
    const data = parse(input.approval, req.body);
    if (!/^[\w.-]{3,40}$/.test(req.params.username)) throw identityError("Usuario inválido.");
    const { storage } = await import("../storage.js");
    if (!await storage.getUserByUsername(req.params.username)) throw identityError("Cuenta no disponible.");
    await service.approve(req.params.username, req.user.username, data.name, data.documentRef, data.method);
    return { ok: true };
  }));
}
