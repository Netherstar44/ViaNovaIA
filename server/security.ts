import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { sql } from "drizzle-orm";
import { getJwtSecret, isOriginAllowed, isProduction } from "./config.js";
import { WorkerMemoryStore } from "./rate-limit-store.js";

export type AuthUser = {
  id: string;
  username: string;
  role: string;
  jti?: string;
  exp?: number;
  iat?: number;
};

export const PROVIDER_ROLES = ["hotel", "restaurant", "recreation", "taxi", "translator"] as const;
export const VALID_ROLES = ["traveler", ...PROVIDER_ROLES, "admin"] as const;

export type PublicUser = {
  id?: string;
  username?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  roles?: string[];
  avatarUrl?: string | null;
  bio?: string | null;
  roleChangedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

/**
 * Allowlist estricta de campos públicos de usuario.
 * Nunca devolver password, verificationToken, failedLoginAttempts, lockUntil,
 * twoFactorEnabled, deletedAt ni preferences.
 */
const PUBLIC_USER_FIELDS = [
  "id",
  "username",
  "name",
  "email",
  "role",
  "roles",
  "avatarUrl",
  "avatar_url",
  "bio",
  "roleChangedAt",
  "role_changed_at",
  "createdAt",
  "created_at",
] as const;

export function sanitizeUser(user: any): PublicUser | null {
  if (!user || typeof user !== "object") return null;

  const safe: Record<string, unknown> = {};
  for (const field of PUBLIC_USER_FIELDS) {
    if (user[field] !== undefined) safe[field] = user[field];
  }

  // Normalizar snake_case a camelCase para respuestas estables.
  const normalized: PublicUser = {
    id: safe.id as string | undefined,
    username: safe.username as string | undefined,
    name: (safe.name as string | null | undefined) ?? null,
    email: (safe.email as string | null | undefined) ?? null,
    role: (safe.role as string | null | undefined) ?? null,
    avatarUrl: (safe.avatarUrl ?? safe.avatar_url ?? null) as string | null,
    bio: (safe.bio as string | null | undefined) ?? null,
    roleChangedAt: (safe.roleChangedAt ?? safe.role_changed_at ?? null) as Date | string | null,
    createdAt: (safe.createdAt ?? safe.created_at ?? null) as Date | string | null,
  };

  if (Array.isArray(safe.roles)) {
    normalized.roles = safe.roles.filter((role): role is string => typeof role === "string");
  }

  return normalized;
}

export function isOwnerOrAdmin(user: AuthUser | undefined, ownerUsername: string | undefined | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Boolean(ownerUsername && user.username === ownerUsername);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    // Lax evita CSRF cross-site. El APK usa Authorization: Bearer.
    sameSite: "lax" as const,
    maxAge: Number(process.env.SESSION_IDLE_MINUTES || 120) * 60 * 1000,
    path: "/",
  };
}

export function signToken(user: { id: string; username: string; role?: string | null }): string {
  const ttl = process.env.JWT_EXPIRES_IN || "2h";
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role || "traveler",
      jti: crypto.randomUUID(),
    },
    getJwtSecret(),
    { expiresIn: ttl as jwt.SignOptions["expiresIn"] },
  );
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return (req as any).cookies?.token;
}

/**
 * Solo los clientes nativos reciben el JWT en el cuerpo. El navegador usa
 * exclusivamente la cookie HttpOnly para que JavaScript no pueda robarla.
 */
export function isNativeAuthClient(req: Request): boolean {
  const platform = String(req.headers["x-client-platform"] || "").trim().toLowerCase();
  if (platform === "capacitor") return true;
  const origin = String(req.headers.origin || "").trim().toLowerCase();
  return origin === "capacitor://localhost" || origin === "https://localhost";
}

async function isTokenRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  // Los tests unitarios no tienen base de datos.
  if (process.env.NODE_ENV === "test") return false;
  const { getDb } = await import("./storage.js");
  const db = getDb();
  const result = await db.execute(sql`SELECT 1 FROM revoked_tokens WHERE jti = ${jti} AND expires_at > now() LIMIT 1`);
  const rows = (result as any).rows ?? (result as any) ?? [];
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Autenticación obligatoria. Acepta cookie HttpOnly o Authorization: Bearer.
 * Verifica además que el token no haya sido revocado en logout.
 */
export async function requireAuth(req: any, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "No autenticado" });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    if (!decoded?.id || !decoded?.username) {
      return res.status(401).json({ message: "Sesión inválida o expirada" });
    }

    try {
      if (await isTokenRevoked(decoded.jti)) {
        return res.status(401).json({ message: "Sesión revocada" });
      }
    } catch (err: any) {
      if (process.env.NODE_ENV !== "test") {
        console.error("[security] no se pudo verificar la revocación del token:", err?.message || err);
        return res.status(503).json({ message: "No se pudo verificar la sesión" });
      }
    }

    req.user = decoded;
    if ((req as any).cookies?.token) {
      res.cookie("token", token, cookieOptions());
    }
    return next();
  } catch {
    return res.status(401).json({ message: "Sesión inválida o expirada" });
  }
}

/** Autenticación opcional para endpoints públicos con datos ampliados para el dueño. */
export async function optionalAuth(req: any, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    if (decoded?.id && decoded?.username) {
      // Un token revocado nunca debe conservar privilegios en un endpoint
      // público aunque la firma siga siendo válida.
      if (!(await isTokenRevoked(decoded.jti))) req.user = decoded;
    }
  } catch {
    // Token inválido, expirado o base de datos caída: continuar como anónimo.
  }
  return next();
}

export async function loadUserRoles(username: string): Promise<string[]> {
  const { storage } = await import("./storage.js");
  const user = await storage.getUserByUsername(username);
  if (!user) return [];
  const records = await storage.getUserRoles(user.id);
  return Array.from(new Set([user.role, ...records.map((record) => String(record.role))].filter(Boolean) as string[]));
}

/**
 * RBAC server-side. Debe ejecutarse después de requireAuth.
 * En tests se puede inyectar req.userRoles para evitar la base de datos.
 */
export function requireRole(...allowedRoles: string[]) {
  return async (req: any, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "No autenticado" });
    try {
      const roles: string[] = Array.isArray(req.userRoles)
        ? req.userRoles
        : await loadUserRoles(req.user.username);
      req.userRoles = roles;
      if (roles.includes("admin") && allowedRoles.includes("admin")) return next();
      if (roles.some((role) => allowedRoles.includes(role)) || roles.includes("admin")) return next();
      return res.status(403).json({ message: "No tienes permiso para esta acción" });
    } catch (err: any) {
      console.error("[security] error cargando roles:", err?.message || err);
      return res.status(503).json({ message: "No se pudieron verificar los permisos" });
    }
  };
}

/** Solo el propio usuario o un administrador. */
export function requireSelfOrAdmin(getUsername: (req: Request) => string | undefined) {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "No autenticado" });
    const username = getUsername(req);
    if (isOwnerOrAdmin(req.user, username)) return next();
    return res.status(403).json({ message: "No puedes acceder a los datos de otra cuenta" });
  };
}

/** Devuelve 404 si la ruta no existe. Se usa para eliminar endpoints legacy. */
export function gone(res: Response, message = "Endpoint eliminado por seguridad") {
  return res.status(410).json({ message });
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/** Comparación en tiempo constante para códigos y tokens. */
export function safeEqualString(a: unknown, b: unknown): boolean {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function isValidUsername(value: unknown): boolean {
  const username = String(value ?? "");
  return /^[a-zA-Z0-9_.-]{3,40}$/.test(username);
}

export function isValidEmail(value: unknown): boolean {
  const email = normalizeEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Revoca el JWT actual (logout / cambio de contraseña). */
export async function revokeTokenFromRequest(req: Request): Promise<void> {
  const token = extractToken(req);
  if (!token) return;
  // Los tests unitarios no tienen base de datos.
  if (process.env.NODE_ENV === "test") return;
  const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
  if (!decoded?.jti || !decoded?.exp) return;
  const { getDb } = await import("./storage.js");
  const db = getDb();
  await db.execute(sql`
    INSERT INTO revoked_tokens (jti, expires_at)
    VALUES (${decoded.jti}, to_timestamp(${decoded.exp}))
    ON CONFLICT (jti) DO NOTHING
  `);
}

/* ── CSRF ──────────────────────────────────────────────────────────────────── */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Valida Origin/Referer en mutaciones.
 * - Origen permitido: continúa.
 * - Origen desconocido: 403.
 * - Sin Origin/Referer: solo se permite con Bearer (clientes nativos) o sin cookie
 *   de sesión (login/registro públicos).
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.path === "/api/stripe/webhook" || req.originalUrl.startsWith("/api/stripe/webhook")) return next();

  const origin = req.get("origin");
  const referer = req.get("referer");
  const hasBearer = Boolean(req.headers.authorization?.startsWith("Bearer "));

  if (origin) {
    return isOriginAllowed(origin)
      ? next()
      : res.status(403).json({ message: "Origen no permitido" });
  }

  if (referer) {
    let refererOrigin: string | undefined;
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      refererOrigin = undefined;
    }
    return isOriginAllowed(refererOrigin)
      ? next()
      : res.status(403).json({ message: "Origen no permitido" });
  }

  if (hasBearer) return next();
  if ((req as any).cookies?.token) {
    return res.status(403).json({ message: "Falta validación de origen (CSRF)" });
  }
  return next();
}

/* ── Rate limiting ─────────────────────────────────────────────────────────── */

type RateLimitStore = {
  init?: (options: any) => void;
  increment: (key: string) => Promise<{ totalHits: number; resetTime: Date }>;
  decrement: (key: string) => Promise<void>;
  resetKey: (key: string) => Promise<void>;
  localKeys?: boolean;
};

/**
 * Store distribuido opcional sobre Upstash Redis REST.
 * Si no hay credenciales o falla la red, cae al store en memoria.
 */
export class UpstashRateLimitStore implements RateLimitStore {
  localKeys = false;
  private fallback = new WorkerMemoryStore();
  private windowMs = 60_000;
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, "");
    this.token = token;
  }

  init(options: any = {}) {
    if (options.windowMs) this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  async increment(key: string) {
    const script =
      "local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; local t=redis.call('PTTL',KEYS[1]); return {c,t}";
    try {
      const response = await fetch(`${this.url}/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["EVAL", script, "1", key, String(this.windowMs)]),
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) throw new Error(`Upstash HTTP ${response.status}`);
      const data: any = await response.json();
      const [totalHits, ttl] = Array.isArray(data?.result) ? data.result : [];
      if (typeof totalHits !== "number") throw new Error("Respuesta Upstash inválida");
      return {
        totalHits,
        resetTime: new Date(Date.now() + Math.max(Number(ttl) || this.windowMs, 1)),
      };
    } catch (err: any) {
      console.warn("[rate-limit] Upstash no disponible, usando memoria local:", err?.message || err);
      return this.fallback.increment(key);
    }
  }

  async decrement(key: string) {
    try {
      await fetch(`${this.url}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(["DECR", key]),
        signal: AbortSignal.timeout(2_000),
      });
    } catch {
      await this.fallback.decrement(key);
    }
  }

  async resetKey(key: string) {
    try {
      await fetch(`${this.url}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(["DEL", key]),
        signal: AbortSignal.timeout(2_000),
      });
    } catch {
      await this.fallback.resetKey(key);
    }
  }
}

export function createRateLimitStore(): RateLimitStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashRateLimitStore(url, token);
  return new WorkerMemoryStore();
}
/* ── Validación / criptografía de datos sensibles ───────────────────────────── */

export const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "qwerty123",
  "abc12345",
  "iloveyou",
  "admin123",
  "vianova123",
  "colombia",
  "traveler",
  "hotel1234",
  "taxi1234",
]);

export function validatePassword(password: unknown, username?: string): { ok: boolean; message?: string } {
  const value = String(password ?? "");
  if (value.length < 8) return { ok: false, message: "La contraseña debe tener al menos 8 caracteres" };
  if (value.length > 128) return { ok: false, message: "La contraseña es demasiado larga" };
  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    return { ok: false, message: "La contraseña es demasiado común. Elige una más segura" };
  }
  if (username && value.toLowerCase().includes(String(username).toLowerCase())) {
    return { ok: false, message: "La contraseña no puede contener el nombre de usuario" };
  }
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return { ok: false, message: "La contraseña debe incluir letras y números" };
  }
  return { ok: true };
}

export function validateAvatarUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > 1000) throw new Error("La URL del avatar es demasiado larga");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("La URL del avatar no es válida");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Solo se permiten URLs http(s) para el avatar");
  }
  return parsed.toString();
}

function paymentKey(): Buffer {
  const secret = process.env.PAYMENT_ENCRYPTION_KEY || getJwtSecret();
  return crypto.createHash("sha256").update(`vianova-payment:${secret}`).digest();
}

export function encryptSensitive(plaintext: unknown): string | null {
  const value = String(plaintext ?? "").trim();
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", paymentKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSensitive(value: unknown): string | null {
  const raw = String(value ?? "");
  if (!raw) return null;
  if (!raw.startsWith("enc:v1:")) return raw; // dato legacy en texto plano
  try {
    const [, , ivB64, tagB64, dataB64] = raw.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", paymentKey(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Enmascara cualquier detalle de pago: solo deja los últimos 4 caracteres. */
export function maskPaymentDetails(value: unknown): string {
  const plaintext = decryptSensitive(value);
  if (!plaintext) return "****";
  const compact = plaintext.replace(/\s+/g, "");
  const last4 = compact.slice(-4);
  return `****${last4}`;
}

/** Nunca devolver detalles completos de un método de pago. */
export function sanitizePaymentMethod(method: any) {
  if (!method || typeof method !== "object") return method;
  const { details, ...rest } = method;
  return {
    ...rest,
    details: maskPaymentDetails(details),
    hasDetails: Boolean(details),
  };
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex"); // 256 bits
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeSingleLine(value: unknown, max = 200): string {
  return String(value ?? "")
    .replace(/[\r\n\u0000]/g, " ")
    .trim()
    .slice(0, max);
}

export function isValidHttpUrl(value: unknown, allowedHosts?: string[]): boolean {
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (allowedHosts && !allowedHosts.includes(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}
