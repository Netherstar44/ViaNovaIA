import type { Express, RequestHandler } from "express";
import { z } from "zod";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { requireAuth, requireRole } from "../security.js";
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
};

export function registerIdentityRoutes(app: Express, service = identities, access: PilotAccess = pilotAccess) {
  const accountLimit = rateLimit({ windowMs: 900_000, limit: 30, keyGenerator: (req: any) => String(req.user.id), standardHeaders: "draft-7", legacyHeaders: false });
  const ipLimit = rateLimit({ windowMs: 900_000, limit: 90, keyGenerator: req => ipKeyGenerator(req.ip || "0.0.0.0"), standardHeaders: "draft-7", legacyHeaders: false });
  app.use("/api/identity", requireAuth);
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
      faceReady: manualReady && calibration.ready && consentReady && service.engine.available !== false,
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
  let processing = false;
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
