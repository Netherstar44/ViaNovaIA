import type { Express, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAuth } from "../security.js";
import { storage } from "../storage.js";
import { authLimiter, loginIpLimiter } from "../rate-limits.js";
import { issueSession, isLocalPasswordHash } from "../auth-session.js";
import { beginTwoFactorChallenge } from "../two-factor.js";
import {
  MAX_PASSKEYS_PER_USER,
  REAUTH_PURPOSES,
  countPasskeys,
  findPasskeyByCredentialId,
  getWebAuthnConfig,
  insertPasskey,
  issueReauthToken,
  listPasskeys,
  removePasskey,
  saveChallenge,
  takeChallenge,
  toPublicPasskey,
  touchPasskey,
} from "./service.js";

const purposeSchema = z.enum(REAUTH_PURPOSES);

const registrationCreate = z.object({
  challengeId: z.uuid(),
  response: z.record(z.string(), z.unknown()),
  label: z.string().trim().max(60).optional(),
  reauthToken: z.string().min(20).max(200),
}).strict();

const loginVerify = z.object({
  challengeId: z.uuid(),
  response: z.record(z.string(), z.unknown()),
}).strict();

const reauthVerify = z.object({
  purpose: purposeSchema,
  challengeId: z.uuid(),
  response: z.record(z.string(), z.unknown()),
}).strict();

const reauthPassword = z.object({
  purpose: purposeSchema,
  password: z.string().min(1).max(128),
}).strict();

const reauthOptions = z.object({ purpose: purposeSchema }).strict();

const webauthnLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 40,
  keyGenerator: (req) => ipKeyGenerator(req.ip || "0.0.0.0"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ message: "Demasiados intentos. Espera unos minutos." }),
});

function parse<T>(schema: z.ZodType<T>, body: unknown, res: Response): T | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ message: "Datos no válidos" });
    return null;
  }
  return parsed.data;
}

function defaultLabel(userAgent: string | undefined): string {
  const value = String(userAgent || "");
  if (/iPhone|iPad|iPod/i.test(value)) return "iPhone / iPad";
  if (/Android/i.test(value)) return "Dispositivo Android";
  if (/Macintosh|Mac OS X/i.test(value)) return "Mac";
  if (/Windows/i.test(value)) return "Windows";
  if (/Linux/i.test(value)) return "Linux";
  return "Este dispositivo";
}

function noStore(res: Response) {
  res.set("Cache-Control", "no-store");
}

export function registerPasskeyRoutes(app: Express) {
  /* ── Registro de passkeys (requiere sesión + reautenticación) ───────────── */

  app.post("/api/auth/passkeys/options", requireAuth, webauthnLimit, async (req: any, res) => {
    try {
      const user = await storage.getUserByUsername(req.user.username);
      if (!user || user.deletedAt) return res.status(404).json({ message: "Cuenta no disponible" });
      if ((await countPasskeys(user.id)) >= MAX_PASSKEYS_PER_USER) {
        return res.status(409).json({ message: `Puedes registrar hasta ${MAX_PASSKEYS_PER_USER} dispositivos. Revoca uno antes de añadir otro.` });
      }
      const existing = await listPasskeys(user.id);
      const config = getWebAuthnConfig();
      const { generateRegistrationOptions } = await import("@simplewebauthn/server");
      const options = await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpID,
        userName: user.username,
        userDisplayName: user.name || user.username,
        userID: new TextEncoder().encode(user.id),
        attestationType: "none",
        excludeCredentials: existing.map((passkey) => ({
          id: passkey.credentialId,
          transports: passkey.transports,
        })),
        authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      });
      const challengeId = await saveChallenge({ userId: user.id, kind: "registration", challenge: options.challenge });
      noStore(res);
      return res.json({ options, challengeId });
    } catch (error: any) {
      console.error("[passkeys] no se pudieron generar las opciones de registro:", error?.message || error);
      return res.status(503).json({ message: "No se pudo iniciar el registro de la passkey." });
    }
  });

  app.post("/api/auth/passkeys", requireAuth, webauthnLimit, async (req: any, res) => {
    const data = parse(registrationCreate, req.body, res);
    if (!data) return;
    try {
      const user = await storage.getUserByUsername(req.user.username);
      if (!user || user.deletedAt) return res.status(404).json({ message: "Cuenta no disponible" });
      const { consumeReauthToken } = await import("./service.js");
      if (!(await consumeReauthToken(user.id, "passkey-register", data.reauthToken))) {
        return res.status(403).json({ message: "Confirma de nuevo tu identidad antes de registrar el dispositivo.", code: "REAUTH_REQUIRED" });
      }
      const challenge = await takeChallenge(data.challengeId, "registration");
      if (!challenge || challenge.userId !== user.id) {
        return res.status(400).json({ message: "El registro expiró. Inténtalo de nuevo." });
      }
      const config = getWebAuthnConfig();
      const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
      const verification = await verifyRegistrationResponse({
        response: data.response as any,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.expectedOrigin,
        expectedRPID: config.rpID,
        requireUserVerification: true,
      });
      const info = verification.registrationInfo;
      if (!verification.verified || !info) {
        return res.status(400).json({ message: "No se pudo verificar el dispositivo." });
      }
      const credential = (info as any).credential ?? {
        id: (info as any).credentialID,
        publicKey: (info as any).credentialPublicKey,
        counter: (info as any).counter ?? 0,
        transports: (info as any).transports,
      };
      if (!credential?.id || !credential?.publicKey) {
        return res.status(400).json({ message: "El dispositivo no devolvió una credencial válida." });
      }
      const label = (data.label || "").trim() || defaultLabel(req.headers["user-agent"]);
      await insertPasskey({
        userId: user.id,
        credentialId: String(credential.id),
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: Number(credential.counter) || 0,
        transports: Array.isArray(credential.transports) ? credential.transports.map(String) : [],
        deviceType: info.credentialDeviceType ? String(info.credentialDeviceType) : null,
        backedUp: info.credentialBackedUp === true,
        label: label.slice(0, 60),
      });
      noStore(res);
      return res.status(201).json({ ok: true, label: label.slice(0, 60) });
    } catch (error: any) {
      console.error("[passkeys] fallo al registrar la passkey:", error?.message || error);
      if (String(error?.code || "").includes("23505")) {
        return res.status(409).json({ message: "Ese dispositivo ya está registrado." });
      }
      return res.status(400).json({ message: "No se pudo registrar la passkey. Reintenta desde el mismo navegador." });
    }
  });

  app.get("/api/auth/passkeys", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserByUsername(req.user.username);
      if (!user) return res.status(404).json({ message: "Cuenta no disponible" });
      const items = await listPasskeys(user.id);
      noStore(res);
      return res.json({ passkeys: items.map(toPublicPasskey), max: MAX_PASSKEYS_PER_USER });
    } catch (error: any) {
      console.error("[passkeys] no se pudo listar:", error?.message || error);
      return res.status(503).json({ message: "No se pudieron consultar tus dispositivos." });
    }
  });

  app.delete("/api/auth/passkeys/:id", requireAuth, webauthnLimit, async (req: any, res) => {
    const id = String(req.params.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ message: "Dispositivo no válido" });
    const token = req.body?.reauthToken;
    try {
      const user = await storage.getUserByUsername(req.user.username);
      if (!user) return res.status(404).json({ message: "Cuenta no disponible" });
      const { consumeReauthToken } = await import("./service.js");
      if (!(await consumeReauthToken(user.id, "passkey-remove", token))) {
        return res.status(403).json({ message: "Confirma de nuevo tu identidad para revocar el dispositivo.", code: "REAUTH_REQUIRED" });
      }
      const removed = await removePasskey(user.id, id);
      if (!removed) return res.status(404).json({ message: "Ese dispositivo ya no existe." });
      return res.json({ ok: true });
    } catch (error: any) {
      console.error("[passkeys] no se pudo revocar:", error?.message || error);
      return res.status(503).json({ message: "No se pudo revocar el dispositivo." });
    }
  });

  /* ── Acceso con passkey (sin sesión previa, credencial descubrible) ─────── */

  app.post("/api/auth/passkey/options", loginIpLimiter, webauthnLimit, async (_req, res) => {
    try {
      const config = getWebAuthnConfig();
      const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
      const options = await generateAuthenticationOptions({
        rpID: config.rpID,
        userVerification: "required",
        allowCredentials: [],
      });
      const challengeId = await saveChallenge({ userId: null, kind: "authentication", challenge: options.challenge });
      noStore(res);
      return res.json({ options, challengeId });
    } catch (error: any) {
      console.error("[passkeys] no se pudieron generar las opciones de acceso:", error?.message || error);
      return res.status(503).json({ message: "El acceso con passkey no está disponible." });
    }
  });

  app.post("/api/auth/passkey/verify", loginIpLimiter, webauthnLimit, async (req, res) => {
    const data = parse(loginVerify, req.body, res);
    if (!data) return;
    try {
      const challenge = await takeChallenge(data.challengeId, "authentication");
      if (!challenge) return res.status(400).json({ message: "La solicitud expiró. Inténtalo de nuevo." });
      const credentialId = String((data.response as any).id || "");
      const stored = await findPasskeyByCredentialId(credentialId);
      if (!stored) return res.status(401).json({ message: "Passkey no reconocida." });
      const user = await storage.getUser(stored.userId);
      if (!user || user.deletedAt) return res.status(401).json({ message: "Passkey no reconocida." });
      const config = getWebAuthnConfig();
      const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
      const verification = await verifyAuthenticationResponse({
        response: data.response as any,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.expectedOrigin,
        expectedRPID: config.rpID,
        credential: {
          id: stored.credentialId,
          publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
          counter: stored.counter,
          transports: stored.transports,
        },
        requireUserVerification: true,
      });
      if (!verification.verified) return res.status(401).json({ message: "No se pudo verificar la passkey." });
      await touchPasskey(stored.id, verification.authenticationInfo.newCounter);
      if (String(user.twoFactorEnabled) === "true") {
        return res.json(await beginTwoFactorChallenge(user));
      }
      return issueSession(req, res, user);
    } catch (error: any) {
      console.error("[passkeys] fallo al verificar el acceso:", error?.message || error);
      return res.status(401).json({ message: "No se pudo verificar la passkey." });
    }
  });

  /* ── Reautenticación reciente para operaciones sensibles ───────────────── */

  app.get("/api/auth/reauth/methods", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserByUsername(req.user.username);
      if (!user) return res.status(404).json({ message: "Cuenta no disponible" });
      noStore(res);
      return res.json({
        passkeys: await countPasskeys(user.id),
        password: isLocalPasswordHash(user.password),
        ttlSeconds: 300,
      });
    } catch (error: any) {
      console.error("[passkeys] no se pudieron consultar los métodos:", error?.message || error);
      return res.status(503).json({ message: "No se pudieron consultar tus métodos de confirmación." });
    }
  });

  app.post("/api/auth/reauth/options", requireAuth, webauthnLimit, async (req: any, res) => {
    const data = parse(reauthOptions, req.body, res);
    if (!data) return;
    try {
      const user = await storage.getUserByUsername(req.user.username);
      if (!user) return res.status(404).json({ message: "Cuenta no disponible" });
      const passkeys = await listPasskeys(user.id);
      if (!passkeys.length) return res.status(409).json({ message: "No tienes passkeys registradas.", code: "NO_PASSKEYS" });
      const config = getWebAuthnConfig();
      const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
      const options = await generateAuthenticationOptions({
        rpID: config.rpID,
        userVerification: "required",
        allowCredentials: passkeys.map((passkey) => ({ id: passkey.credentialId, transports: passkey.transports })),
      });
      const challengeId = await saveChallenge({ userId: user.id, kind: "reauth", challenge: options.challenge, purpose: data.purpose });
      noStore(res);
      return res.json({ options, challengeId });
    } catch (error: any) {
      console.error("[passkeys] no se pudieron generar las opciones de confirmación:", error?.message || error);
      return res.status(503).json({ message: "No se pudo iniciar la confirmación." });
    }
  });

  app.post("/api/auth/reauth/verify", requireAuth, webauthnLimit, async (req: any, res) => {
    const data = parse(reauthVerify, req.body, res);
    if (!data) return;
    try {
      const user = await storage.getUserByUsername(req.user.username);
      if (!user) return res.status(404).json({ message: "Cuenta no disponible" });
      const challenge = await takeChallenge(data.challengeId, "reauth");
      if (!challenge || challenge.userId !== user.id || challenge.purpose !== data.purpose) {
        return res.status(400).json({ message: "La confirmación expiró. Inténtalo de nuevo." });
      }
      const stored = await findPasskeyByCredentialId(String((data.response as any).id || ""));
      if (!stored || stored.userId !== user.id) return res.status(401).json({ message: "Passkey no reconocida." });
      const config = getWebAuthnConfig();
      const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
      const verification = await verifyAuthenticationResponse({
        response: data.response as any,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.expectedOrigin,
        expectedRPID: config.rpID,
        credential: {
          id: stored.credentialId,
          publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
          counter: stored.counter,
          transports: stored.transports,
        },
        requireUserVerification: true,
      });
      if (!verification.verified) return res.status(401).json({ message: "No se pudo verificar la passkey." });
      await touchPasskey(stored.id, verification.authenticationInfo.newCounter);
      const reauthToken = await issueReauthToken(user.id, data.purpose);
      noStore(res);
      return res.json({ reauthToken, expiresIn: 300 });
    } catch (error: any) {
      console.error("[passkeys] fallo al confirmar la operación:", error?.message || error);
      return res.status(401).json({ message: "No se pudo confirmar tu identidad." });
    }
  });

  app.post("/api/auth/reauth/password", requireAuth, authLimiter, webauthnLimit, async (req: any, res) => {
    const data = parse(reauthPassword, req.body, res);
    if (!data) return;
    try {
      const user = await storage.getUserByUsername(req.user.username);
      if (!user || user.deletedAt) return res.status(404).json({ message: "Cuenta no disponible" });
      const valid = isLocalPasswordHash(user.password)
        ? await bcrypt.compare(data.password, user.password)
        : false;
      if (!valid) return res.status(401).json({ message: "La contraseña no es correcta." });
      const reauthToken = await issueReauthToken(user.id, data.purpose);
      noStore(res);
      return res.json({ reauthToken, expiresIn: 300 });
    } catch (error: any) {
      console.error("[passkeys] fallo al confirmar con contraseña:", error?.message || error);
      return res.status(503).json({ message: "No se pudo confirmar tu identidad." });
    }
  });
}
