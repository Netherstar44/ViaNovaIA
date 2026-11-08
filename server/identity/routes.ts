import type { Express, RequestHandler } from "express";
import { z } from "zod";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { requireAuth, requireRole } from "../security.js";
import { CONSENT_VERSION } from "../../shared/identity.js";
import { FACE_MODEL, type FaceEngine } from "./policy.js";
import { IdentityService, identityError } from "./service.js";

let nodeEngine: FaceEngine | undefined;
/** Installed only by the Node server entry. Workers never imports native canvas/TFJS. */
export function configureFaceEngine(engine: FaceEngine): void { nodeEngine = engine; }
export const identities = new IdentityService({
  model: FACE_MODEL,
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
const input = {
  consent: z.object({ version: z.literal(CONSENT_VERSION), accepted: z.literal(true) }).strict(),
  challenge: z.object({ purpose: z.enum(["enroll", "verify"]) }).strict(),
  frame: z.object({ id: z.uuid(), jpeg: z.string().min(16).max(320_000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict(),
  approval: z.object({ name: z.string().trim().min(3).max(120).regex(/^[\p{L}\p{M} .'-]+$/u), documentRef: z.string().trim().min(6).max(160), method: z.enum(["face", "manual"]), documentChecked: z.literal(true) }).strict(),
};
export function registerIdentityRoutes(app: Express, service = identities) {
  const accountLimit = rateLimit({ windowMs: 900_000, limit: 30, keyGenerator: (req: any) => String(req.user.id), standardHeaders: "draft-7", legacyHeaders: false });
  const ipLimit = rateLimit({ windowMs: 900_000, limit: 90, keyGenerator: req => ipKeyGenerator(req.ip || "0.0.0.0"), standardHeaders: "draft-7", legacyHeaders: false });
  app.use("/api/identity", requireAuth);
  const route = (handler: (req: any) => Promise<unknown>): RequestHandler => async (req, res) => {
    try { res.json(await handler(req)); }
    catch (error: any) {
      const status = [400, 403, 409, 429, 503].includes(error?.status) ? error.status : 503;
      // No native decoder stack or image/descriptor in logs or responses.
      res.status(status).json({ message: status === 503 ? "Verificación no disponible. Solicita revisión manual al administrador." : error.message });
    }
  };
  const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw identityError("Datos de verificación inválidos.");
    return parsed.data;
  };
  app.get("/api/identity/me", route(async req => {
    const r = await service.read(req.user.username);
    return { identity: await service.public(req.user.username), consent: !!r.consentAt && !r.revoked && r.consentVersion === CONSENT_VERSION, enrolled: !!r.template, pendingApproval: !!r.template && !r.approvedName, manualRequested: !!r.manualRequested };
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
