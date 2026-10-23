import type { Express } from "express";
import { storage, getDb } from "../storage.js";
import { registerTaxiRoutes } from "./taxi.routes.js";
import { getRideById } from "../taxi.storage.js";
import { bookingsRouter } from "./bookings.routes.js";
import { socialRouter } from "./social.routes.js";
import { ensureAnalyticsSchema, getDashboardAnalytics, VALID_ROLES } from "../analytics.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import { insertServiceSchema, insertCommentSchema, comments, users } from "../../shared/schema.js";
import { and, eq, sql as drizzleSql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendWelcomeEmail, sendPasswordResetEmail, sendPasswordChangedEmail, sendCustomEmail } from "../mailer.js";
import { getAppBaseUrl, getGoogleRedirectUri, getGoogleAllowedClientIds } from "../config.js";
import {
  requireAuth,
  optionalAuth,
  requireRole,
  requireSelfOrAdmin,
  gone,
  sanitizeUser,
  signToken,
  cookieOptions,
  validatePassword,
  validateAvatarUrl,
  encryptSensitive,
  sanitizePaymentMethod,
  hashResetToken,
  generateResetToken,
  escapeHtml,
  sanitizeSingleLine,
  isValidHttpUrl,
  isValidUsername,
  isValidEmail,
  normalizeEmail,
  safeEqualString,
  revokeTokenFromRequest,
  isNativeAuthClient,
  PROVIDER_ROLES,
  isOwnerOrAdmin,
  type AuthUser,
} from "../security.js";
import { verifyGoogleIdToken, assertVerifiedGoogleProfile } from "../google-auth.js";
import { validateUpload } from "../upload-validation.js";
import { logSecurityEvent } from "../observability.js";
import {
  authLimiter,
  registerLimiter,
  twoFactorLimiter,
  verifyEmailLimiter,
  forgotPasswordLimiter,
  resetTokenLimiter,
  uploadLimiter,
  chatLimiter,
  writeLimiter,
  bookingRequestLimiter,
  mapsLimiter,
  publicReadLimiter,
} from "../rate-limits.js";
// Filtro básico de groserías (reemplaza 'bad-words' por problemas de ESM)
class Filter {
  private words: string[] = [];
  addWords(...words: string[]) {
    this.words.push(...words.map(w => w.toLowerCase()));
  }
  isProfane(text: string) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return this.words.some(word => lowerText.includes(word));
  }
  clean(text: string) {
    if (!text) return text;
    let result = text;
    this.words.forEach(word => {
      const regex = new RegExp(word, 'gi');
      result = result.replace(regex, '*'.repeat(word.length));
    });
    return result;
  }
}

// Instanciar filtro de groserías y añadir palabras en español
const profanityFilter = new Filter();
profanityFilter.addWords('puta', 'mierda', 'malparido', 'gonorrea', 'hijueputa', 'pendejo', 'imbecil', 'marica', 'maricón', 'zorra', 'perra');

// Limiter para endpoints sensibles: ver ../rate-limits.ts

// Configuración estricta de multer para seguridad
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB (video); las rutas validan límites por tipo
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
      'model/gltf-binary', 'model/gltf+json', 'application/octet-stream',
    ];
    // La extensión por sí sola no basta: el contenido se valida por magic bytes.
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de archivo no soportado o inválido"));
    }
  }
});
// Hash password with $2a$ prefix for pgcrypto compatibility (mobile app uses pgcrypto)
async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(plain, salt);
  // bcryptjs v3 produces $2b$, but pgcrypto only reads $2a$ — they are identical
  return hash.replace(/^\$2b\$/, "$2a$");
}

// Configure Cloudinary from env
function configureCloudinary() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
}

/**
 * Valida el contenido real del archivo y lo sube a Cloudinary.
 * La carpeta siempre se deriva del usuario autenticado, nunca del body.
 */
async function uploadValidatedFile(
  file: Express.Multer.File,
  folder: string,
  resourceType: "image" | "video" | "raw" = "image",
): Promise<{ url: string; publicId: string }> {
  const validation = validateUpload({
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
  });
  if (!validation.ok) {
    throw Object.assign(new Error(validation.reason), { status: 415 });
  }
  configureCloudinary();
  const uploaded: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, quality: "auto:good" },
      (error, result) => (error || !result ? reject(error) : resolve(result)),
    );
    stream.end(file.buffer);
  });
  return { url: uploaded.secure_url, publicId: uploaded.public_id };
}

/** Migración idempotente de columnas usadas por órdenes e idempotencia. */
let commerceSchemaPromise: Promise<void> | null = null;
async function ensureCommerceSchema(): Promise<void> {
  if (!commerceSchemaPromise) {
    commerceSchemaPromise = (async () => {
      const db = getDb();
      await db.execute(drizzleSql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text`);
      await db.execute(drizzleSql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_intent text`);
      await db.execute(drizzleSql`
        CREATE UNIQUE INDEX IF NOT EXISTS orders_buyer_idempotency_idx
        ON orders (buyer_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL
      `);
      await db.execute(drizzleSql`
        CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_intent_idx
        ON orders (payment_intent)
        WHERE payment_intent IS NOT NULL
      `);
      await db.execute(drizzleSql`
        CREATE UNIQUE INDEX IF NOT EXISTS earnings_ride_id_idx
        ON earnings (ride_id)
      `);
    })().catch((err) => {
      commerceSchemaPromise = null;
      throw err;
    });
  }
  return commerceSchemaPromise;
}

// sanitizeUser proviene de ../security.js (allowlist estricta de campos públicos).

// Helper: guarantee every account has at least one row in user_roles.
// This keeps the multi-role switcher working for accounts created before
// the multi-role module existed (and for Google sign-ups).
async function ensureUserHasRoleRecord(user: any) {
  if (!user?.id) return;
  try {
    const existing = await storage.getUserRoles(user.id);
    if (existing.length === 0) {
      await storage.addUserRole({ userId: user.id, role: (user.role || "traveler") as any });
    }
  } catch (err: any) {
    console.warn("[roles] no se pudo inicializar el rol del usuario:", err?.message || err);
  }
}

function money(value: unknown, currency = "COP") {
  return `$${Number(value || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })} ${currency}`;
}

// Keep latitude/longitude columns consistent (they are stored as text) and
// reject coordinates Leaflet cannot render. This prevents a single bad service
// row from breaking the public map for every visitor.
function normalizeServiceCoordinates(data: Record<string, any>): Record<string, any> {
  const hasLat = data.locationLat !== undefined && data.locationLat !== null && data.locationLat !== "";
  const hasLng = data.locationLng !== undefined && data.locationLng !== null && data.locationLng !== "";

  if (!hasLat && !hasLng) {
    const { locationLat: _lat, locationLng: _lng, ...rest } = data;
    return rest;
  }

  if (hasLat !== hasLng) {
    throw Object.assign(new Error("Debes enviar latitud y longitud juntas"), { status: 400 });
  }

  const lat = Number(data.locationLat);
  const lng = Number(data.locationLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw Object.assign(new Error("Coordenadas inválidas: latitud entre -90 y 90 y longitud entre -180 y 180"), { status: 400 });
  }

  return { ...data, locationLat: String(lat), locationLng: String(lng) };
}

function buildChatSuggestions(scope: string, role: string, destinationCity: string, language: string) {
  const city = destinationCity ? ` en ${destinationCity}` : "";
  if (language === "en") {
    if (scope === "business") return ["How much did I sell this month?", "Which products are low on stock?", "How can I improve my margin?", "Summarize my customers"];
    if (scope === "admin") return ["Revenue by role", "Top providers", "Stock alerts", "New users this month"];
    return [`Plan 2 days${city}`, "Best hotels nearby", "Budget-friendly restaurants", "Activities for families"];
  }
  if (scope === "business") {
    return ["¿Cuánto vendí este mes?", "¿Qué productos tienen bajo stock?", "¿Cómo mejoro mi margen?", "Resumen de mis clientes"];
  }
  if (scope === "admin") {
    return ["Ingresos por rol", "Mejores proveedores", "Alertas de stock", "Nuevos usuarios del mes"];
  }
  return [`Plan de 2 días${city}`, "Hoteles recomendados", "Restaurantes económicos", "Actividades para familias"];
}

function buildLocalAnalyticsReply(scope: string, role: string, metrics: any, topProducts: any[], lowStock: any[], language: string) {
  if (language === "en") {
    if (scope === "business") {
      return `I can't reach the AI service right now, but here is your latest business snapshot (${role}):\n\n- Revenue: ${money(metrics.revenue)}\n- Costs: ${money(metrics.expenses)}\n- Profit: ${money(metrics.profit)} (${metrics.margin}% margin)\n- Orders: ${metrics.orders} · Pending: ${metrics.pendingOrders}\n- Stock: ${metrics.totalStock} units · Low stock: ${metrics.lowStock} · Out of stock: ${metrics.outOfStock}\n\nTop products:\n${topProducts.slice(0, 4).map((p) => `- ${p.name}: ${money(p.revenue)}`).join("\n") || "- No sales recorded yet"}\n\n${lowStock.length ? `Restock priority: ${lowStock.slice(0, 3).map((p) => `${p.name} (${p.stock})`).join(", ")}.` : "Your stock levels look healthy."}`;
    }
    if (scope === "admin") {
      return `The AI service is unavailable, but here is the platform snapshot:\n\n- Revenue: ${money(metrics.revenue)}\n- Profit: ${money(metrics.profit)}\n- Users: ${metrics.users} · Providers: ${metrics.providers}\n- Orders: ${metrics.orders} · Stock: ${metrics.totalStock}\n- Low stock alerts: ${metrics.lowStock} · Out of stock: ${metrics.outOfStock}`;
    }
    return `The AI service is unavailable, but here is your travel snapshot:\n\n- Total spent: ${money(metrics.totalSpent)}\n- Orders: ${metrics.orders} · Bookings: ${metrics.bookings} · Rides: ${metrics.rides}\n- Level: ${metrics.level} (${metrics.loyaltyPoints} points)\n\nTell me your destination whenever you're ready.`;
  }

  if (scope === "business") {
    return `No pude conectar con el servicio de IA, pero este es tu resumen de negocio (${role}) con datos reales:\n\n- Ingresos: ${money(metrics.revenue)}\n- Gastos: ${money(metrics.expenses)}\n- Ganancia: ${money(metrics.profit)} (margen ${metrics.margin}%)\n- Órdenes: ${metrics.orders} · Pendientes: ${metrics.pendingOrders}\n- Stock: ${metrics.totalStock} unidades · Bajo stock: ${metrics.lowStock} · Agotados: ${metrics.outOfStock}\n\nTop productos:\n${topProducts.slice(0, 4).map((p) => `- ${p.name}: ${money(p.revenue)}`).join("\n") || "- Aún no hay ventas registradas"}\n\n${lowStock.length ? `Prioriza reponer: ${lowStock.slice(0, 3).map((p) => `${p.name} (${p.stock})`).join(", ")}.` : "Tu inventario está saludable."}`;
  }
  if (scope === "admin") {
    return `El servicio de IA no está disponible, pero este es el panorama de la plataforma:\n\n- Ingresos: ${money(metrics.revenue)}\n- Ganancia: ${money(metrics.profit)}\n- Usuarios: ${metrics.users} · Proveedores: ${metrics.providers}\n- Órdenes: ${metrics.orders} · Stock: ${metrics.totalStock}\n- Alertas de stock bajo: ${metrics.lowStock} · Agotados: ${metrics.outOfStock}`;
  }
  return `El servicio de IA no está disponible, pero este es tu resumen como viajero:\n\n- Total gastado: ${money(metrics.totalSpent)}\n- Compras: ${metrics.orders} · Reservas: ${metrics.bookings} · Viajes: ${metrics.rides}\n- Nivel: ${metrics.level} (${metrics.loyaltyPoints} puntos)\n\nDime tu destino cuando quieras y te ayudo a planear.`;
}

// Autenticación y sanitización centralizadas en ../security.js.
export { requireAuth };

export async function registerRoutes(app: Express): Promise<Express> {
  configureCloudinary();

  /**
   * La cookie HttpOnly es el mecanismo de sesión web. Solo el APK recibe
   * además el JWT en JSON, porque el WebView nativo no comparte cookies de
   * forma fiable y guarda el token en almacenamiento cifrado del sistema.
   */
  const sendAuthenticated = (req: any, res: any, user: any) => {
    const token = signToken(user);
    res.cookie("token", token, cookieOptions());
    res.set("Cache-Control", "no-store");
    const payload: Record<string, unknown> = { user: sanitizeUser(user) };
    if (isNativeAuthClient(req)) payload.token = token;
    return res.json(payload);
  };

  app.use("/api/bookings", bookingsRouter);
  app.use("/api/social", socialRouter);

  // Health
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // ── ANALYTICS: dashboard general por rol (consumidor / negocio / admin) ────
  app.get("/api/analytics/dashboard", requireAuth, async (req: any, res, next) => {
    try {
      const username = String(req.query.username || "");
      if (req.user.username !== username) {
        const viewer = await storage.getUserByUsername(req.user.username);
        if (!viewer || viewer.role !== "admin") {
          return res.status(403).json({ message: "No puedes consultar analíticas de otra cuenta" });
        }
      }
      const role = req.query.role ? String(req.query.role) : undefined;
      const days = req.query.days ? parseInt(String(req.query.days)) : 30;
      const dashboard = await getDashboardAnalytics({ username, role, days });
      res.json(dashboard);
    } catch (err: any) {
      if (err?.status) return res.status(err.status).json({ message: err.message });
      next(err);
    }
  });

  // ─── AUTH: Register (always traveler) ────────────────────────────────────────
  app.post("/api/auth/register", registerLimiter, async (req, res, next) => {
    try {
      const body = req.body || {};
      const username = sanitizeSingleLine(body.username, 40);
      const email = normalizeEmail(body.email);
      const password = String(body.password ?? "");
      const name = sanitizeSingleLine(body.name, 120) || username;

      if (!username || !email || !password) {
        return res.status(400).json({ message: "username, email y password son obligatorios" });
      }
      if (!isValidUsername(username)) {
        return res.status(400).json({ message: "El usuario debe tener entre 3 y 40 caracteres (letras, números, punto, guion o guion bajo)" });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "El correo electrónico no es válido" });
      }
      const passwordCheck = validatePassword(password, username);
      if (!passwordCheck.ok) {
        return res.status(400).json({ message: passwordCheck.message });
      }
      if (body.acceptTerms !== true && body.acceptTerms !== "true") {
        return res.status(400).json({ message: "Debes aceptar los términos y la política de privacidad" });
      }

      const [existingUser, existingEmail] = await Promise.all([
        storage.getUserByUsername(username),
        storage.getUserByEmail(email),
      ]);
      if (existingUser) {
        return res.status(409).json({ message: "El nombre de usuario ya está registrado" });
      }
      if (existingEmail) {
        return res.status(409).json({ message: "El correo electrónico ya está registrado" });
      }

      const hashedPassword = await hashPassword(password);
      const verificationToken = crypto.randomInt(100000, 999999).toString();

      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name,
        email,
        role: "traveler",
        authProvider: "local",
        verificationToken,
        termsAcceptedAt: new Date(),
      });

      await ensureUserHasRoleRecord(user);

      sendWelcomeEmail(email, name).catch((err) => {
        console.error("Error enviando email de bienvenida:", err.message);
      });

      sendCustomEmail({
        to: email,
        subject: "Verifica tu correo en VIANova",
        html: `<p>Hola ${escapeHtml(name)},</p><p>Tu código de verificación es: <strong>${verificationToken}</strong></p>`,
      }).catch((err) => console.error("Error enviando código de verificación:", err?.message || err));

      return sendAuthenticated(req, res, user);
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Verify Email ────────────────────────────────────────────────────
  app.post("/api/auth/verify-email", verifyEmailLimiter, async (req, res, next) => {
    try {
      const username = sanitizeSingleLine(req.body?.username, 40);
      const token = sanitizeSingleLine(req.body?.token, 12);
      if (!username || !token) return res.status(400).json({ message: "username y token requeridos" });

      const user = await storage.getUserByUsername(username);
      // Respuesta genérica: no revelar si el username existe ni si ya estaba
      // verificado. Así este endpoint no se convierte en un oráculo de cuentas.
      if (!user) return res.status(400).json({ message: "Código inválido o expirado" });

      if (user.isVerified === "true") {
        return res.json({ message: "Correo verificado exitosamente" });
      }

      if (!safeEqualString(user.verificationToken, token)) {
        return res.status(400).json({ message: "Código inválido o expirado" });
      }

      const db = getDb();
      await db.execute(drizzleSql`UPDATE users SET is_verified = 'true', verification_token = NULL WHERE id = ${user.id}`);
      
      res.json({ message: "Correo verificado exitosamente" });
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Login ─────────────────────────────────────────────────────────────
  app.post("/api/auth/login", authLimiter, async (req, res, next) => {
    try {
      const rawIdentifier = sanitizeSingleLine(req.body?.username, 254);
      const password = String(req.body?.password ?? "");
      if (!rawIdentifier || !password) {
        return res.status(400).json({ message: "username y password son obligatorios" });
      }
      if (password.length > 128) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      const identifier = rawIdentifier.includes("@") ? normalizeEmail(rawIdentifier) : rawIdentifier;
      let user = await storage.getUserByUsername(identifier);
      if (!user && identifier.includes("@")) {
        user = await storage.getUserByEmail(identifier);
      }
      if (!user || user.deletedAt) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      if (user.lockUntil && new Date(user.lockUntil).getTime() > Date.now()) {
        const minutes = Math.max(1, Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 60000));
        return res.status(423).json({ message: `Cuenta bloqueada temporalmente. Intenta de nuevo en ${minutes} minuto(s).` });
      }

      const valid = /^\$2[aby]\$/.test(String(user.password || ""))
        ? await bcrypt.compare(password, user.password)
        : false;
      if (!valid) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
        const db = getDb();
        await db.execute(drizzleSql`
          UPDATE users
          SET failed_login_attempts = ${attempts}, lock_until = ${lockUntil}, updated_at = now()
          WHERE id = ${user.id}
        `);
        if (lockUntil) {
          return res.status(423).json({ message: "Demasiados intentos fallidos. La cuenta estará bloqueada 15 minutos." });
        }
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      const db = getDb();
      await db.execute(drizzleSql`
        UPDATE users SET failed_login_attempts = 0, lock_until = NULL WHERE id = ${user.id}
      `);

      if (String(user.twoFactorEnabled) === "true") {
        const code = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await db.execute(drizzleSql`
          UPDATE users
          SET verification_token = ${`2fa:${hashResetToken(code)}:${expiresAt}`}, two_factor_attempts = 0
          WHERE id = ${user.id}
        `);
        if (user.email) {
          sendCustomEmail({
            to: user.email,
            subject: "Tu código de verificación VIANova",
            html: `<p>Hola ${escapeHtml(user.name || user.username)},</p><p>Tu código de verificación en dos pasos es: <strong>${code}</strong></p><p>Expira en 10 minutos.</p>`,
          }).catch((err) => console.error("Error enviando código 2FA:", err.message));
        }
        return res.json({ requires2FA: true, username: user.username, message: "Ingresa el código enviado a tu correo." });
      }

      return sendAuthenticated(req, res, user);
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Me & Logout ──────────────────────────────────────────────────────
  // Optional auth: anonymous visitors are a normal state, not an error. Returning
  // 200 with user:null avoids noisy 401 responses in the browser console while
  // protected endpoints keep using requireAuth.
  app.get("/api/auth/me", optionalAuth, async (req: any, res) => {
    if (!req.user) return res.json({ user: null });
    try {
      const user = await storage.getUserByUsername(req.user.username);
      if (!user || user.deletedAt) {
        res.clearCookie("token", cookieOptions());
        return res.json({ user: null });
      }
      return res.json({ user: sanitizeUser(user) });
    } catch {
      return res.json({ user: null });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      await revokeTokenFromRequest(req);
    } catch (err: any) {
      console.warn("[auth] no se pudo revocar el token:", err?.message || err);
    }
    res.clearCookie("token", cookieOptions());
    res.json({ message: "Sesión cerrada" });
  });

  // ─── AUTH: Two-factor verification ─────────────────────────────────────────
  app.post("/api/auth/verify-2fa", twoFactorLimiter, async (req, res, next) => {
    try {
      const username = sanitizeSingleLine(req.body?.username, 40);
      const code = sanitizeSingleLine(req.body?.code, 6);
      if (!username || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ message: "username y código obligatorios" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user || user.deletedAt) return res.status(401).json({ message: "Código inválido o expirado" });

      const [prefix, savedHash, expiresAt] = String(user.verificationToken || "").split(":");
      const expired = !expiresAt || Date.now() > new Date(expiresAt).getTime();
      const attempts = Number(user.twoFactorAttempts || 0) + 1;
      if (prefix !== "2fa" || expired || attempts > 5 || !safeEqualString(savedHash, hashResetToken(code))) {
        const db = getDb();
        await db.execute(drizzleSql`
          UPDATE users
          SET two_factor_attempts = ${attempts},
              verification_token = CASE WHEN ${attempts > 5} THEN NULL ELSE verification_token END
          WHERE id = ${user.id}
        `);
        return res.status(401).json({ message: "Código inválido o expirado" });
      }

      const db = getDb();
      await db.execute(drizzleSql`
        UPDATE users
        SET verification_token = NULL, two_factor_attempts = 0, failed_login_attempts = 0, lock_until = NULL
        WHERE id = ${user.id}
      `);
      return sendAuthenticated(req, res, user);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/auth/2fa", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserByUsername(req.user.username);
      res.json({ enabled: String(user?.twoFactorEnabled) === "true" });
    } catch {
      res.status(500).json({ message: "Error interno" });
    }
  });

  app.patch("/api/auth/2fa", requireAuth, async (req: any, res) => {
    try {
      const enabled = req.body?.enabled === true || req.body?.enabled === "true";
      const user = await storage.getUserByUsername(req.user.username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const isLocal = /^\$2[aby]\$/.test(String(user.password || ""));
      if (isLocal) {
        const password = String(req.body?.password ?? "");
        const valid = password ? await bcrypt.compare(password, user.password) : false;
        if (!valid) return res.status(401).json({ message: "Confirma tu contraseña para cambiar la verificación en dos pasos" });
      }

      const db = getDb();
      await db.execute(drizzleSql`
        UPDATE users SET two_factor_enabled = ${enabled ? "true" : "false"}, two_factor_attempts = 0
        WHERE id = ${user.id}
      `);
      res.json({ enabled });
    } catch {
      res.status(500).json({ message: "No se pudo actualizar la verificación en dos pasos" });
    }
  });

  // ─── USER: Delete account (right to be forgotten) ──────────────────────────
  app.delete("/api/user/account", requireAuth, async (req: any, res, next) => {
    try {
      const { password, confirm } = req.body || {};
      const user = await storage.getUserByUsername(req.user.username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const isLocal = /^\$2[aby]\$/.test(String(user.password || ""));
      if (isLocal) {
        const valid = password ? await bcrypt.compare(String(password), user.password) : false;
        if (!valid) return res.status(401).json({ message: "Contraseña incorrecta" });
      } else if (confirm !== "ELIMINAR") {
        return res.status(400).json({ message: "Escribe ELIMINAR para confirmar la eliminación de una cuenta de Google" });
      }

      const db = getDb();
      const username = user.username;
      const safe = async (query: any) => {
        try { await query; } catch { /* table may not exist yet */ }
      };

      await safe(db.execute(drizzleSql`DELETE FROM social_messages WHERE sender_username = ${username} OR recipient_username = ${username}`));
      await safe(db.execute(drizzleSql`DELETE FROM social_likes WHERE user_id = ${user.id}`));
      await safe(db.execute(drizzleSql`DELETE FROM social_comments WHERE user_id = ${user.id}`));
      await safe(db.execute(drizzleSql`DELETE FROM social_posts WHERE user_id = ${user.id}`));
      await safe(db.execute(drizzleSql`DELETE FROM social_followers WHERE follower_id = ${user.id} OR following_id = ${user.id}`));
      await safe(db.execute(drizzleSql`DELETE FROM social_blocks WHERE blocker_id = ${user.id} OR blocked_id = ${user.id}`));
      await safe(db.execute(drizzleSql`DELETE FROM social_reports WHERE reporter_id = ${user.id} OR reported_id = ${user.id}`));
      await safe(db.execute(drizzleSql`DELETE FROM notifications WHERE provider_username = ${username} OR traveler_username = ${username}`));
      await safe(db.execute(drizzleSql`DELETE FROM reviews WHERE author_username = ${username} OR target_username = ${username}`));
      await safe(db.execute(drizzleSql`DELETE FROM payment_methods WHERE username = ${username}`));
      await safe(db.execute(drizzleSql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`));
      await safe(db.execute(drizzleSql`DELETE FROM user_roles WHERE user_id = ${user.id}`));
      await safe(db.execute(drizzleSql`DELETE FROM chat_messages WHERE user_id = ${user.id}`));
      await safe(db.execute(drizzleSql`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ${user.id})`));
      await safe(db.execute(drizzleSql`DELETE FROM conversations WHERE user_id = ${user.id}`));
      await safe(db.execute(drizzleSql`DELETE FROM media WHERE user_id = ${user.id}`));
      await safe(db.execute(drizzleSql`UPDATE rides SET traveler_username = 'Cuenta eliminada' WHERE traveler_username = ${username}`));
      await safe(db.execute(drizzleSql`UPDATE rides SET taxi_username = 'Cuenta eliminada' WHERE taxi_username = ${username}`));
      await db.execute(drizzleSql`DELETE FROM users WHERE id = ${user.id}`);
      try { await revokeTokenFromRequest(req); } catch { /* la cuenta ya no existe */ }

      res.clearCookie("token", cookieOptions());
      res.json({ message: "Cuenta eliminada correctamente" });
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Google Mobile (ID Token verification) ────────────────────────────
  app.post("/api/auth/google/mobile", authLimiter, async (req, res, next) => {
    try {
      const idToken = String(req.body?.idToken ?? "");
      if (!idToken || idToken.length > 10_000) {
        return res.status(400).json({ message: "idToken es obligatorio" });
      }

      let googleUser;
      try {
        googleUser = await verifyGoogleIdToken(idToken, { allowedClientIds: getGoogleAllowedClientIds() });
      } catch (err: any) {
        logSecurityEvent("google_token_invalid", { reason: err?.message });
        return res.status(401).json({ message: "Token de Google inválido o expirado" });
      }

      const email = normalizeEmail(googleUser.email);
      const name = sanitizeSingleLine(googleUser.name || googleUser.given_name || email.split("@")[0], 120);
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "No se pudo obtener el email de Google" });
      }

      let user = await storage.getUserByEmail(email);
      if (user?.deletedAt) return res.status(403).json({ message: "Esta cuenta fue eliminada" });

      if (!user) {
        let username = "";
        for (let attempt = 0; attempt < 5 && !username; attempt++) {
          const candidate = sanitizeSingleLine(`${email.split("@")[0]}_${crypto.randomBytes(3).toString("hex")}`, 40);
          if (isValidUsername(candidate) && !(await storage.getUserByUsername(candidate))) username = candidate;
        }
        if (!username) return res.status(503).json({ message: "No se pudo crear la cuenta. Intenta de nuevo." });

        const randomPassword = crypto.randomBytes(32).toString("hex");
        const hashedPassword = await hashPassword(randomPassword);
        user = await storage.createUser({
          username,
          password: hashedPassword,
          name,
          email,
          role: "traveler",
          authProvider: "google",
        });
        await ensureUserHasRoleRecord(user);
      }

      return sendAuthenticated(req, res, user);
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Forgot Password ──────────────────────────────────────────────────
  app.post("/api/auth/forgot-password", forgotPasswordLimiter, async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "El correo electrónico es obligatorio" });
      }

      const genericMessage = "Si existe una cuenta con ese correo, te enviamos un código de recuperación.";
      const user = await storage.getUserByEmail(email);
      const isLocal = Boolean(user && /^\$2[aby]\$/.test(String(user.password || "")));

      if (user && isLocal && !user.deletedAt) {
        const token = generateResetToken();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await storage.createPasswordResetToken(user.id, hashResetToken(token), expiresAt);
        sendPasswordResetEmail(email, user.name || user.username, token).catch((err) => {
          console.error("Error enviando email de reset:", err.message);
        });
      }

      res.json({ message: genericMessage });
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Verify Reset Token ───────────────────────────────────────────────
  app.post("/api/auth/verify-reset-token", resetTokenLimiter, async (req, res, next) => {
    try {
      const token = sanitizeSingleLine(req.body?.token, 128);
      if (!token) return res.status(400).json({ message: "Token obligatorio" });

      const tokenHash = hashResetToken(token);
      const resetToken = await storage.getPasswordResetToken(tokenHash);
      if (!resetToken) {
        return res.status(400).json({ valid: false, message: "Código inválido o ya fue utilizado" });
      }
      if (new Date() > new Date(resetToken.expiresAt)) {
        await storage.deletePasswordResetToken(tokenHash);
        return res.status(400).json({ valid: false, message: "El código ha expirado. Solicita uno nuevo." });
      }
      res.json({ valid: true, message: "Código verificado correctamente" });
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Reset Password ───────────────────────────────────────────────────
  app.post("/api/auth/reset-password", resetTokenLimiter, async (req, res, next) => {
    try {
      const token = sanitizeSingleLine(req.body?.token, 128);
      const newPassword = String(req.body?.newPassword ?? "");

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token y nueva contraseña son obligatorios" });
      }

      const tokenHash = hashResetToken(token);
      const resetToken = await storage.getPasswordResetToken(tokenHash);
      if (!resetToken) {
        return res.status(400).json({ message: "Código inválido o ya fue utilizado" });
      }
      if (new Date() > new Date(resetToken.expiresAt)) {
        await storage.deletePasswordResetToken(tokenHash);
        return res.status(400).json({ message: "El código ha expirado. Solicita uno nuevo." });
      }

      const user = await storage.getUser(resetToken.userId);
      if (!user) return res.status(400).json({ message: "Código inválido o ya fue utilizado" });

      const passwordCheck = validatePassword(newPassword, user.username);
      if (!passwordCheck.ok) return res.status(400).json({ message: passwordCheck.message });

      const hashed = await hashPassword(newPassword);
      await storage.updateUserPassword(resetToken.userId, hashed);

      const db = getDb();
      await db.execute(drizzleSql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`);

      if (user.email) {
        const emergencyToken = generateResetToken();
        const emergencyExpires = new Date(Date.now() + 15 * 60 * 1000);
        await storage.createPasswordResetToken(user.id, hashResetToken(emergencyToken), emergencyExpires);
        const emergencyUrl = `${getAppBaseUrl()}/login#reset_token=${encodeURIComponent(emergencyToken)}`;
        sendPasswordChangedEmail(user.email, user.name || user.username, emergencyUrl).catch((err) => {
          console.error("Error enviando email de cambio:", err.message);
        });
      }

      res.json({ message: "Contraseña actualizada exitosamente. Ya puedes iniciar sesión." });
    } catch (err) {
      next(err);
    }
  });

  // ─── USER: Change Role (15 day cooldown) ───────────────────────────────────
  app.patch(
    "/api/users/role",
    requireAuth,
    requireSelfOrAdmin((req) => sanitizeSingleLine(req.body?.username, 40)),
    async (req: any, res, next) => {
      try {
        const username = sanitizeSingleLine(req.body?.username ?? req.user.username, 40);
        const role = String(req.body?.role ?? "");
        if (!username || !role) {
          return res.status(400).json({ message: "username y role son obligatorios" });
        }
        if (!VALID_ROLES.includes(role as any) || role === "admin") {
          return res.status(400).json({ message: "Rol inválido" });
        }

        const user = await storage.getUserByUsername(username);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        if (req.user.role !== "admin" && user.roleChangedAt) {
          const diff = Date.now() - new Date(user.roleChangedAt).getTime();
          const days = diff / (1000 * 60 * 60 * 24);
          if (days < 15) {
            const remaining = Math.ceil(15 - days);
            return res.status(429).json({ message: `Debes esperar ${remaining} día(s) más para cambiar tu rol.` });
          }
        }

        const updated = await storage.updateUserRole(user.id, role);
        await storage.addUserRole({ userId: user.id, role: role as any });
        res.json({ user: sanitizeUser(updated) });
      } catch (err) {
        next(err);
      }
    },
  );

  // Endpoint legacy POST /api/users eliminado: permitía crear cuentas sin verificación.

  // ---------------------------------------------------------------------------
  // Google OAuth integration
  // ---------------------------------------------------------------------------

  app.get("/api/auth/google", authLimiter, async (req, res, next) => {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.status(503).json({ message: "Google OAuth no está configurado" });
      }
      const redirectUri = getGoogleRedirectUri();
      const code = sanitizeSingleLine(req.query.code, 2048);

      if (!code) {
        const state = crypto.randomBytes(32).toString("hex");
        res.cookie("oauth_state", state, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 10 * 60 * 1000,
          path: "/api/auth/google",
        });
        const scope = encodeURIComponent("openid email profile");
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}&prompt=select_account`;
        return res.redirect(authUrl);
      }

      const expectedState = (req as any).cookies?.oauth_state;
      const receivedState = sanitizeSingleLine(req.query.state, 128);
      res.clearCookie("oauth_state", { path: "/api/auth/google" });
      if (!expectedState || !receivedState || !safeEqualString(expectedState, receivedState)) {
        logSecurityEvent("google_oauth_state_invalid", { ip: req.ip });
        return res.status(400).json({ message: "Estado OAuth inválido. Intenta de nuevo." });
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const tokenData: any = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenData.access_token) {
        console.error("Google token exchange failed:", tokenRes.status);
        return res.status(400).json({ message: "No se pudo completar el inicio de sesión con Google" });
      }

      const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!profileRes.ok) {
        return res.status(400).json({ message: "No se pudo validar el perfil de Google" });
      }
      const profile: any = await profileRes.json();
      const { email: verifiedEmail, name: verifiedName } = assertVerifiedGoogleProfile(profile);
      const email = normalizeEmail(verifiedEmail);
      if (!isValidEmail(email)) return res.status(400).json({ message: "Email de Google inválido" });

      let user = await storage.getUserByEmail(email);
      if (user?.deletedAt) return res.status(403).json({ message: "Esta cuenta fue eliminada" });
      if (!user) {
        let username = "";
        for (let attempt = 0; attempt < 5 && !username; attempt++) {
          const candidate = `user_${crypto.randomBytes(4).toString("hex")}`;
          if (!(await storage.getUserByUsername(candidate))) username = candidate;
        }
        if (!username) return res.status(503).json({ message: "No se pudo crear la cuenta" });
        const hashed = await hashPassword(`google_oauth_${crypto.randomUUID()}`);
        user = await storage.createUser({
          username,
          password: hashed,
          name: sanitizeSingleLine(verifiedName || email, 120),
          email,
          role: "traveler",
          authProvider: "google",
        });
        await ensureUserHasRoleRecord(user);

        sendWelcomeEmail(email, verifiedName || email).catch((err) => {
          console.error("Error enviando email de bienvenida (Google):", err.message);
        });
      }

      const token = signToken(user);
      res.cookie("token", token, cookieOptions());

      // No colocamos datos personales en la URL: el cliente consulta
      // /api/auth/me usando la cookie HttpOnly recién emitida.
      return res.redirect(`${getAppBaseUrl()}/login#google=1`);
    } catch (err) {
      console.error("Auth google error:", err);
      next(err);
    }
  });

  // Cloudinary upload with category folder
  app.post("/api/upload", requireAuth, uploadLimiter, upload.single("file"), async (req: any, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: "file required" });

      const validation = validateUpload({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
      });
      if (!validation.ok) {
        return res.status(415).json({ message: validation.reason });
      }

      const category = sanitizeSingleLine(req.body?.category || "otros", 40).replace(/[^a-zA-Z0-9_-]/g, "");
      const folder = `vianova/${category || "otros"}/${req.user.id}`;

      const uploaded: any = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: validation.kind === "video" ? "video" : validation.kind === "model" ? "raw" : "image" },
          (error, result) => (error || !result ? reject(error) : resolve(result)),
        );
        stream.end(req.file!.buffer);
      });

      return res.json({
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        folder,
      });
    } catch (err) {
      next(err);
    }
  });

  // Service management (CRUD - minimal)
  app.post("/api/services", requireAuth, requireRole(...PROVIDER_ROLES), writeLimiter, async (req: any, res, next) => {
    try {
      const body = { ...(req.body || {}) };
      const requestedProvider = sanitizeSingleLine(body.providerUsername, 40);
      if (requestedProvider && requestedProvider !== req.user.username && req.user.role !== "admin") {
        return res.status(403).json({ message: "No puedes crear servicios para otra cuenta" });
      }
      body.providerUsername = req.user.role === "admin" && requestedProvider ? requestedProvider : req.user.username;
      // La calificación solo la calculan las reseñas, nunca el proveedor.
      delete body.rating;

      const normalized = normalizeServiceCoordinates(body);
      const parsed = insertServiceSchema.parse(normalized);
      const created = await storage.insertService(parsed);
      res.json({ service: created });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      if (err?.status === 400) return res.status(400).json({ message: err.message });
      next(err);
    }
  });

  app.get("/api/services", publicReadLimiter, async (req, res, next) => {
    try {
      const category = sanitizeSingleLine(req.query?.category, 30);
      if (!category) return res.status(400).json({ message: "category required" });
      if (![...PROVIDER_ROLES, "transport"].includes(category as any)) {
        return res.status(400).json({ message: "Categoría inválida" });
      }
      const list = await storage.listServicesByCategory(category);
      res.json({ services: list });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/services/provider/:username", publicReadLimiter, async (req, res, next) => {
    try {
      const username = sanitizeSingleLine(req.params.username, 40);
      if (!isValidUsername(username)) return res.status(400).json({ message: "Usuario inválido" });
      const list = await storage.listProviderServices(username);
      res.json({ services: list });
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/services/:id", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const service = await storage.getService(req.params.id);
      if (!service) return res.status(404).json({ message: "Servicio no encontrado" });
      if (!isOwnerOrAdmin(req.user, service.providerUsername)) {
        return res.status(403).json({ message: "No puedes modificar un servicio de otra cuenta" });
      }
      // Allowlist explícita: evita mass assignment de rating, id, owner, createdAt.
      const allowedFields = [
        "category", "name", "description", "imageUrl", "locationLat", "locationLng",
        "price", "currency", "priceType", "duration", "minCapacity", "maxCapacity",
        "difficulty", "minAge", "included", "whatToBring", "schedule", "parentHotelId",
      ] as const;
      const data: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (req.body?.[field] !== undefined) data[field] = req.body[field];
      }
      const parsed = insertServiceSchema.partial().parse(normalizeServiceCoordinates(data));
      const updated = await storage.updateService(req.params.id, parsed);
      res.json({ service: updated });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      if (err?.status === 400) return res.status(400).json({ message: err.message });
      next(err);
    }
  });

  app.delete("/api/services/:id", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const service = await storage.getService(req.params.id);
      if (!service) return res.status(404).json({ message: "Servicio no encontrado" });
      if (!isOwnerOrAdmin(req.user, service.providerUsername)) {
        return res.status(403).json({ message: "No puedes eliminar un servicio de otra cuenta" });
      }
      await storage.deleteService(req.params.id, service.providerUsername);
      res.json({ success: true, message: "Servicio eliminado" });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/comments", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const body = { ...(req.body || {}), authorUsername: req.user.username };
      const parsed = insertCommentSchema.parse(body);
      const cleanContent = profanityFilter.clean(String(parsed.content).slice(0, 1000));
      const created = await storage.insertComment({ ...parsed, content: cleanContent });
      res.json({ comment: created });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      next(err);
    }
  });

  app.get("/api/comments/ratings", publicReadLimiter, async (req, res, next) => {
    try {
      const raw = sanitizeSingleLine(req.query?.locationIds, 4000);
      const locationIds = [...new Set(
        String(raw || "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 100),
      )];
      if (locationIds.length === 0) return res.json({ ratings: {} });

      const rows = await storage.listCommentRatings(locationIds);
      const ratings = Object.fromEntries(
        rows.map((row) => [
          row.locationId,
          { average: Number(row.average.toFixed(1)), count: row.count },
        ]),
      );
      res.json({ ratings });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/comments", publicReadLimiter, async (req, res, next) => {
    try {
      const locationId = sanitizeSingleLine(req.query?.locationId, 100);
      if (!locationId) return res.status(400).json({ message: "locationId required" });
      const list = await storage.listCommentsByLocation(locationId);
      res.json({ comments: list });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/comments/:id", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const db = getDb();
      const ownership = req.user.role === "admin"
        ? eq(comments.id, req.params.id)
        : and(eq(comments.id, req.params.id), eq(comments.authorUsername, req.user.username));
      const deleted = await db.delete(comments).where(ownership).returning({ id: comments.id });
      if (!deleted.length) return res.status(404).json({ message: "Comentario no encontrado" });
      res.json({ success: true, message: "Comentario eliminado" });
    } catch (err) {
      next(err);
    }
  });

  // ─── Migration endpoint ────────────────────────────────────────────────────
  // Endpoint /api/migrate eliminado: las migraciones se ejecutan solo por script controlado.

  // Groq chat endpoints
  app.get("/api/chat/history", requireAuth, async (req: any, res, next) => {
    try {
      const user = await storage.getUserByUsername(req.user.username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const conversation = await storage.upsertConversation(user.id);
      // getMessages already returns chronological order (reversed inside storage)
      const msgs = await storage.getMessages(conversation.id, 60);
      // Normalize to the shape the RideHistory page expects
      const normalized = msgs.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        image: m.metadata?.image ?? null,
        createdAt: m.createdAt,
      }));
      res.json(normalized);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/chat", requireAuth, chatLimiter, async (req: any, res, next) => {
    try {
      const body = req.body || {};
      let message = sanitizeSingleLine(body.message, 4000);
      const location = body.location;
      const history = Array.isArray(body.history) ? body.history.slice(-30) : [];
      const destinationCity = sanitizeSingleLine(body.destinationCity, 80);
      const language = sanitizeSingleLine(body.language, 10) || "es";
      const requestedRole = sanitizeSingleLine(body.role, 20);
      const name = sanitizeSingleLine(body.name, 120);
      if (!message) return res.status(400).json({ message: "message required" });

      message = profanityFilter.clean(message);

      // Identidad y roles salen exclusivamente del token y la base de datos.
      const chatUser = await storage.getUserByUsername(req.user.username);
      if (!chatUser || chatUser.deletedAt) return res.status(401).json({ message: "Sesión inválida" });
      const uid = chatUser.id;

      let roleNames: string[] = [];
      try {
        roleNames = (await storage.getUserRoles(chatUser.id)).map((r: any) => String(r.role));
      } catch {
        roleNames = [];
      }
      if (roleNames.length === 0) {
        try {
          await storage.addUserRole({ userId: chatUser.id, role: (chatUser.role || "traveler") as any });
          roleNames = [chatUser.role || "traveler"];
        } catch {
          roleNames = [chatUser.role || "traveler"];
        }
      }
      const baseRole = String(chatUser.role || "traveler");
      let activeRole = baseRole;
      if (requestedRole && VALID_ROLES.includes(requestedRole as any)) {
        const allowed = roleNames.includes(requestedRole) || requestedRole === baseRole;
        const adminAllowed = requestedRole !== "admin" || baseRole === "admin";
        if (allowed && adminAllowed) activeRole = requestedRole;
      }
      const chatScope = activeRole === "admin" ? "admin" : activeRole === "traveler" ? "consumer" : "business";

      const conversation = await storage.upsertConversation(uid!);

      // Persistent memory: when the client reopens the chat it only sends the
      // greeting, so recover the previous turns from the database.
      const clientHasUserTurn = Array.isArray(history) && history.some((m: any) => m?.role === "user");
      let persistedHistory: { role: "user" | "assistant"; content: string }[] = [];
      if (!clientHasUserTurn) {
        try {
          const previous = await storage.getMessages(conversation.id, 20);
          persistedHistory = previous
            .filter((m: any) => m.role === "user" || m.role === "assistant")
            .map((m: any) => ({ role: m.role, content: String(m.content || "") }));
        } catch {
          persistedHistory = [];
        }
      }

      // Save message to DB for persistence (long-term log)
      await storage.addMessage(conversation.id, "user", message, { location, role: activeRole });

      // ── RAG: Detectar ciudad, intención y construir contexto de BD real ──────
      const COLOMBIAN_CITIES = ["cali","neiva","medellín","medellin","cartagena","santa marta","bogotá","bogota","bucaramanga","barranquilla","manizales","pereira","armenia","ibagué","ibague","villavicencio","pasto","montería","monteria","leticia","tunja","popayán","popayan","florencia","riohacha","sincelejo","valledupar","quibdó","quibdo"];
      const allText = [message, ...((Array.isArray(history) ? history : []).map((m: any) => m.content || ""))].join(" ").toLowerCase();

      // Opción explícita tiene prioridad
      const detectedCity = destinationCity
        ? destinationCity.toLowerCase()
        : (COLOMBIAN_CITIES.find(c => allText.includes(c)) ?? "");

      // Detectar intención de búsqueda (keywords sin ciudad)
      const SEARCH_KEYWORDS = ["hotel","restaurante","hospedaje","comer","dormir","actividad","taxi","transporte","tour","recreación","recreacion","piscina","habitación","mesa","reservar"];
      const hasSearchIntent = SEARCH_KEYWORDS.some(kw => allText.includes(kw));

      let servicesContext = "";

      try {
        const db = getDb();

        // ─── 1. Servicios reales de la tabla services (perfil proveedor) ─────
        let cityServices: any[] = [];
        if (detectedCity) {
          cityServices = await storage.listServicesByCity(detectedCity);
        } else if (hasSearchIntent) {
          // Si busca algo pero no dijo ciudad, traemos los mejores 15 globales
          const rows = await db.execute(drizzleSql`
            SELECT * FROM services ORDER BY rating DESC NULLS LAST LIMIT 15
          `);
          cityServices = (rows as any).rows ?? (rows as any) ?? [];
        }

        // ─── 2. Productos del Marketplace (tabla products) ────────────────────
        let marketProducts: any[] = [];
        if (detectedCity) {
          const rows = await db.execute(drizzleSql`
            SELECT p.*, u.name as provider_name
            FROM products p
            JOIN users u ON u.id = p.provider_id
            WHERE p.is_active = true
            LIMIT 20
          `);
          marketProducts = (rows as any).rows ?? (rows as any) ?? [];
        } else if (hasSearchIntent) {
          const rows = await db.execute(drizzleSql`
            SELECT p.*, u.name as provider_name
            FROM products p
            JOIN users u ON u.id = p.provider_id
            WHERE p.is_active = true
            ORDER BY p.created_at DESC
            LIMIT 12
          `);
          marketProducts = (rows as any).rows ?? (rows as any) ?? [];
        }

        // ─── 3. Construir el bloque de contexto ───────────────────────────────
        const cityLabel = detectedCity ? detectedCity.toUpperCase() : "NUESTRA PLATAFORMA";

        const fmtService = (category: string, emoji: string) =>
          cityServices
            .filter((s: any) => s.category === category)
            .map((s: any) => `  ${emoji} **${s.name}** (@${s.provider_username ?? s.providerUsername}) — $${Number(s.price ?? 0).toLocaleString("es-CO")} COP ⭐${s.rating ?? "N/A"} — ${(s.description ?? "").substring(0, 100)}`)
            .join("\n");

        const fmtProduct = (roleCategory: string, emoji: string) =>
          marketProducts
            .filter((p: any) => p.role_category === roleCategory)
            .map((p: any) => `  ${emoji} **${p.name}** (por ${p.provider_name ?? p.provider_username}) — $${Number(p.price ?? 0).toLocaleString("es-CO")} ${p.currency ?? "COP"} — ${(p.description ?? "").substring(0, 100)}`)
            .join("\n");

        const serviceLines = [
          fmtService("hotel", "🏨"),
          fmtService("restaurant", "🍽️"),
          fmtService("recreation", "🎭"),
          fmtService("transport", "🚕"),
        ].filter(l => l.trim()).join("\n");

        const productLines = [
          fmtProduct("hotel", "🏨"),
          fmtProduct("restaurant", "🍽️"),
          fmtProduct("recreation", "🎭"),
          fmtProduct("taxi", "🚕"),
          fmtProduct("translator", "🗣️"),
        ].filter(l => l.trim()).join("\n");

        if (serviceLines || productLines) {
          servicesContext = `\n\n---\n**CATÁLOGO REAL DE VIANOBA EN ${cityLabel} — USA SOLO ESTOS DATOS:**\n`;
          if (serviceLines) servicesContext += `\n### Servicios de Proveedores:\n${serviceLines}`;
          if (productLines) servicesContext += `\n\n### Productos en el Marketplace:\n${productLines}`;
          servicesContext += `\n\n> ⚠️ INSTRUCCIÓN CRÍTICA: Solo puedes recomendar los servicios y productos listados arriba. Nunca inventes hoteles, restaurantes o precios que no estén en esta lista. Si no hay datos, indica amablemente que aún no hay proveedores registrados para ese destino en VIANova.`;
        }

      } catch (ragErr) {
        // RAG es no-bloqueante: si falla, el bot responde sin contexto
        console.error("[RAG] Error al consultar BD:", ragErr);
      }

      // ── Analytics reales para el copiloto de negocio / consumidor / admin ──
      let analyticsSnapshot: any = null;
      let analyticsContext = "";
      if (chatUser?.username) {
        try {
          analyticsSnapshot = await getDashboardAnalytics({ username: chatUser.username, role: activeRole, days: 30 });
          const m = analyticsSnapshot.metrics || {};
          const top = (analyticsSnapshot.topProducts || []).slice(0, 4);
          const alerts = (analyticsSnapshot.lowStock || []).slice(0, 4);

          if (chatScope === "business") {
            analyticsContext = `\n\n---\n**DATOS REALES DEL NEGOCIO DEL USUARIO (últimos 30 días) — responde con estas cifras, nunca las inventes:**\n- Rol activo: ${activeRole}\n- Ingresos: ${money(m.revenue)}\n- Gastos: ${money(m.expenses)} (costo de producto ${money(m.cogs)} + comisión plataforma ${money(m.platformFee)})\n- Ganancia neta: ${money(m.profit)} · Margen: ${m.margin}%\n- Órdenes pagadas: ${m.paidOrders} · Pendientes: ${m.pendingOrders} · Reservas: ${m.bookings} · Viajes: ${m.rides}\n- Clientes: ${m.clients} · Ticket promedio: ${money(m.avgTicket)}\n- Productos: ${m.products} · Stock total: ${m.totalStock} · Bajo stock: ${m.lowStock} · Agotados: ${m.outOfStock}\n- Valor del inventario: ${money(m.inventoryValue)} · Calificación: ${m.rating || "sin reseñas"}\n- Top productos: ${top.map((p: any) => `${p.name} (${p.units} uds, ${money(p.revenue)}, stock ${p.stock})`).join("; ") || "sin ventas aún"}\n- Alertas de inventario: ${alerts.map((p: any) => `${p.name} (${p.stock})`).join("; ") || "ninguna"}\n\n> Cuando pregunten por ventas, gastos, ganancias, stock, productos o clientes, usa EXACTAMENTE estas cifras. Si el usuario pide acciones, prioriza: reponer stock bajo, activar órdenes pendientes y mejorar productos con mayor margen.`;
          } else if (chatScope === "admin") {
            const roles = (analyticsSnapshot.revenueByRole || []).map((r: any) => `${r.role}: ${money(r.revenue)}`).join("; ");
            analyticsContext = `\n\n---\n**DATOS GLOBALES DE LA PLATAFORMA (últimos 30 días):**\n- Ingresos: ${money(m.revenue)} · Gastos: ${money(m.expenses)} · Ganancia: ${money(m.profit)} · Margen: ${m.margin}%\n- Usuarios: ${m.users} · Nuevos: ${m.newUsers} · Proveedores: ${m.providers}\n- Órdenes: ${m.orders} · Reservas: ${m.bookings} · Viajes: ${m.rides}\n- Stock total: ${m.totalStock} · Bajo stock: ${m.lowStock} · Agotados: ${m.outOfStock}\n- Ingresos por rol: ${roles || "sin datos"}\n- Top proveedores: ${(analyticsSnapshot.topProviders || []).slice(0, 4).map((p: any) => `@${p.username} (${money(p.revenue)})`).join("; ") || "sin datos"}\n\n> Responde como analista SaaS con estas cifras. Señala riesgos y oportunidades concretas.`;
          } else {
            analyticsContext = `\n\n---\n**PERFIL DEL VIAJERO (datos reales de su cuenta):**\n- Total gastado (30 días): ${money(m.totalSpent)}\n- Compras: ${m.orders} · Reservas: ${m.bookings} · Viajes: ${m.rides} · Pendientes: ${m.pendingOrders}\n- Ticket promedio: ${money(m.avgTicket)} · Puntos: ${m.loyaltyPoints} · Nivel: ${m.level}\n- Categorías favoritas: ${(analyticsSnapshot.categoryBreakdown || []).slice(0, 3).map((c: any) => c.name).join(", ") || "aún explorando"}\n\n> Personaliza tus recomendaciones con su nivel y su historial.`;
          }
        } catch (analyticsError: any) {
          console.warn("[chat] analytics context unavailable:", analyticsError?.message || analyticsError);
        }
      }

      const travelerSysPrompt = `Eres VIANova, un conserje inteligente y experto planificador de viajes para Colombia y el mundo. Tu tono es amable, profesional y directo. Eres el asistente oficial de la plataforma VIANova.

**REGLAS CRÍTICAS DE COMPORTAMIENTO:**
1. **NO saludes en cada mensaje.** Saluda ÚNICAMENTE en el primer mensaje.
2. **LEE SIEMPRE el historial.** Si el usuario indicó su ciudad de origen, destino, presupuesto o preferencias — **BAJO NINGUNA CIRCUNSTANCIA VUELVAS A PREGUNTARLOS**. Asúmelos como válidos y avanza.
3. **DESTINO Y UBICACIÓN:** Si el usuario menciona una ciudad (ej. "voy a cartagena", "estoy en bogotá"), ESE ES SU DESTINO. NO lo preguntes de nuevo. Pasa directo a recomendar servicios.
4. **Responde de forma concisa.** Máximo 3-4 párrafos.
5. **USA SOLO los servicios y productos del catálogo real** listado al final de este prompt. NUNCA inventes establecimientos, precios o nombres.
6. **Si no hay datos** en el catálogo para ese destino, dilo honestamente: "Aún no tenemos proveedores registrados en VIANova para [ciudad], pero puedo ayudarte con recomendaciones generales."

**PROCESO DE PLANIFICACIÓN DE VIAJES:**
1. **Recolección:** Identifica presupuesto, destino, duración. Si el usuario ya mencionó el destino, NUNCA lo vuelvas a preguntar.
2. **Propuesta:** Diseña un plan usando los servicios reales de VIANova del catálogo.
3. **Confirmación:** Pregunta si el usuario aprueba el plan.
4. **Cronograma:** Si el usuario ACEPTA, genera las solicitudes en este formato exacto:

### SOLICITUDES DE RESERVA:
- [HOTEL]: Hospedaje del [Fecha inicio] al [Fecha fin] para [Nombre] en [Hotel sugerido] — $[precio] COP — @[username]
- [RESTAURANTE]: [Tipo de comida] para [Nombre] el [Fecha] a las [Hora] en [Restaurante] — $[precio] COP — @[username]
- [TAXI]: Recorrido de [Origen] a [Destino] para [Nombre] el [Fecha] a las [Hora] con [Servicio] — $[precio] COP — @[username]
- [RECREACION]: [Actividad] para [Nombre] el [Fecha] — $[precio] COP — @[username]
- [TRADUCTOR]: (Solo si el destino requiere otro idioma) Guía/traductor en [Idioma] para [Nombre].${servicesContext}`;

      const businessSysPrompt = `Eres VIANova Business Copilot, el analista de negocio y asesor estratégico de emprendedores dentro de la plataforma VIANova.
El usuario tiene activo el rol de **${activeRole}** (hotel, restaurante, recreación, taxi o traductor).

**TU MISIÓN:**
1. Responder preguntas sobre ventas, ingresos, gastos, ganancias, margen, stock, órdenes, reservas, clientes y reseñas usando EXCLUSIVAMENTE los datos reales entregados abajo.
2. Dar recomendaciones accionables y priorizadas (inventario, precios, promociones, ocupación, fidelización, tiempos de respuesta).
3. Señalar riesgos: stock bajo/agotado, órdenes pendientes, márgenes negativos, caída de demanda.
4. Si preguntan por viajes o turismo, puedes ayudar, pero tu foco principal es hacer crecer el negocio.
5. No inventes cifras. Si un dato no existe, dilo y sugiere cómo generarlo.
6. Responde conciso (máximo 4 párrafos o una lista corta). No saludes en cada mensaje.
${analyticsContext}`;

      const adminSysPrompt = `Eres VIANova SaaS Copilot, el analista ejecutivo global de la plataforma.
Responde sobre ingresos, gastos, ganancia, usuarios, proveedores, órdenes, reservas, viajes, stock y rendimiento por rol.
Usa exclusivamente los datos reales entregados abajo, detecta riesgos y oportunidades, y propone acciones concretas de crecimiento y operación.
No inventes cifras. Sé breve y ejecutivo. No saludes en cada mensaje.
${analyticsContext}`;

      const sysPrompt = chatScope === "admin"
        ? adminSysPrompt
        : chatScope === "business"
          ? businessSysPrompt
          : `${travelerSysPrompt}${analyticsContext}`;

      // ── Historial: frontend si existe; si no, memoria persistente de la BD ──
      // Groq requiere que el primer mensaje no-system sea 'user'.
      const clientHistory: { role: "user" | "assistant"; content: string }[] = Array.isArray(history)
        ? history.filter((m: any) => m.role === "user" || m.role === "assistant")
        : [];
      const sourceHistory = clientHistory.some((m) => m.role === "user") ? clientHistory : persistedHistory;
      const firstUserIdx = sourceHistory.findIndex(m => m.role === "user");
      const historyMessages = firstUserIdx >= 0 ? sourceHistory.slice(firstUserIdx).slice(-20) : [];
      const turnCount = historyMessages.length;

      const suggestions = buildChatSuggestions(chatScope, activeRole, detectedCity || destinationCity || "", language || "es");

      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        const fallbackContent = analyticsSnapshot
          ? buildLocalAnalyticsReply(chatScope, activeRole, analyticsSnapshot.metrics || {}, analyticsSnapshot.topProducts || [], analyticsSnapshot.lowStock || [], language || "es")
          : "El asistente IA no está configurado todavía. Puedes seguir usando el catálogo y tu dashboard con datos reales.";
        await storage.addMessage(conversation.id, "assistant", fallbackContent, { fallback: true, role: activeRole });
        return res.json({ reply: fallbackContent, suggestions, conversationId: conversation.id, scope: chatScope, role: activeRole, mode: "local" });
      }

      let content = "";
      try {
        const completion = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: sysPrompt },
              { role: "system", content: `Rol activo del usuario: ${activeRole}. Roles disponibles en su cuenta: ${roleNames.join(", ") || activeRole}.` },
              name ? { role: "system", content: `Nombre del usuario: ${name}` } : undefined,
              // GPS location: authoritative when provided (map works = GPS works)
              location
                ? { role: "system", content: `Ubicación GPS del usuario (CONFIABLE): lat=${(location as any).lat}, lng=${(location as any).lng}. Usa esta ubicación para tus recomendaciones.` }
                : { role: "system", content: `Ubicación GPS: No disponible. No asumas ninguna ciudad hasta que el usuario la indique.` },
              destinationCity
                ? { role: "system", content: `El usuario indicó explícitamente este destino de viaje: ${destinationCity}. Úsalo como destino principal, no lo vuelvas a preguntar.` }
                : undefined,
              // Dynamic turn counter to suppress greetings on ongoing conversations
              turnCount > 0
                ? { role: "system", content: `Esta conversación ya lleva ${turnCount} mensajes. NO saludes al usuario. Continúa el hilo directamente usando el historial.` }
                : undefined,
              // Language override
              language
                ? { role: "system", content: `You MUST respond entirely in this language code: ${language}. Translate your personality, tone, and all output (including the reservation formats) to this language.` }
                : undefined,
              ...historyMessages,
              { role: "user", content: message },
            ].filter(Boolean),
            temperature: 0.35,
            max_tokens: 1200,
          }),
        });

        if (completion.ok) {
          const data: any = await completion.json().catch(() => ({}));
          content = String(data.choices?.[0]?.message?.content || "").trim();
        } else {
          const errorBody = await completion.text().catch(() => "");
          console.warn("[chat] Groq error:", completion.status, errorBody.slice(0, 200));
        }
      } catch (aiError: any) {
        console.warn("[chat] Groq unavailable:", aiError?.message || aiError);
      }

      if (!content) {
        content = analyticsSnapshot
          ? buildLocalAnalyticsReply(chatScope, activeRole, analyticsSnapshot.metrics || {}, analyticsSnapshot.topProducts || [], analyticsSnapshot.lowStock || [], language || "es")
          : "No pude conectar con el asistente en este momento. Intenta de nuevo en unos segundos.";
      }

      const assistantMsg = await storage.addMessage(conversation.id, "assistant", content, { role: activeRole });
      res.json({
        reply: assistantMsg.content,
        suggestions,
        conversationId: conversation.id,
        scope: chatScope,
        role: activeRole,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Confirmar reservas del chatbot y notificar a proveedores ───────────────
  // Nota: /api/bookings/confirm pertenece al módulo de slots/PSE (bookingsRouter).
  app.post("/api/bookings/request", requireAuth, bookingRequestLimiter, async (req: any, res, next) => {
    try {
      const bookings = req.body?.bookings;
      if (!Array.isArray(bookings) || bookings.length === 0 || bookings.length > 20) {
        return res.status(400).json({ message: "bookings debe ser un arreglo de 1 a 20 solicitudes" });
      }

      const traveler = await storage.getUserByUsername(req.user.username);
      if (!traveler) return res.status(401).json({ message: "Sesión inválida" });
      const travelerName = sanitizeSingleLine(traveler.name || traveler.username, 120);
      const travelerEmail = isValidEmail(traveler.email) ? traveler.email : null;
      const results: { type: string; provider: string; status: string }[] = [];

      for (const booking of bookings) {
        const type = sanitizeSingleLine(booking?.type, 30);
        const providerUsername = sanitizeSingleLine(booking?.providerUsername, 40);
        const details = sanitizeSingleLine(booking?.details, 1000);
        if (!type || !providerUsername || !isValidUsername(providerUsername)) {
          results.push({ type: type || "unknown", provider: providerUsername || "unknown", status: "skipped" });
          continue;
        }

        const providerUser = await storage.getUserByUsername(providerUsername);
        if (!providerUser?.email) {
          results.push({ type, provider: providerUsername, status: "no_email" });
          continue;
        }

        try {
          await storage.insertNotification({
            providerUsername,
            travelerUsername: req.user.username,
            type,
            details,
          });
        } catch (dbErr) {
          console.error("Failed to insert notification", dbErr);
        }

        try {
          await sendCustomEmail({
            to: providerUser.email,
            subject: sanitizeSingleLine(`Nueva Solicitud de Reserva VIANova - ${travelerName}`, 150),
            html: `
              <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
                <h2 style="color:#22c55e;">Nueva Reserva en VIANova</h2>
                <p>Tienes una nueva solicitud de <strong>${escapeHtml(travelerName)}</strong>.</p>
                <div style="background:#1e293b;padding:16px;border-radius:8px;margin:16px 0;">
                  <p><strong>Tipo:</strong> ${escapeHtml(type)}</p>
                  <p><strong>Detalles:</strong> ${escapeHtml(details)}</p>
                  ${travelerEmail ? `<p><strong>Contacto del viajero:</strong> ${escapeHtml(travelerEmail)}</p>` : ""}
                </div>
                <p style="color:#94a3b8;font-size:12px;">También puedes ver esta notificación en tu panel de VIANova.</p>
              </div>
            `,
          });
          results.push({ type, provider: providerUsername, status: "sent" });
        } catch {
          results.push({ type, provider: providerUsername, status: "mail_error" });
        }
      }

      res.json({ message: "Reservas procesadas", results });
    } catch (err) {
      next(err);
    }
  });

  // ── Resolver de links cortos de Google Maps ────────────────────────────────
  // Sigue los redirects manualmente (nunca automáticos), valida cada salto
  // contra la allowlist de Google, bloquea credenciales/puertos y aplica timeout.
  app.get("/api/maps/resolve", requireAuth, mapsLimiter, async (req: any, res) => {
    const readUrl = (value: unknown): URL | null => {
      try {
        const parsed = new URL(String(value));
        if (parsed.protocol !== "https:") return null;
        if (parsed.username || parsed.password) return null;
        if (parsed.port && parsed.port !== "443") return null;
        const allowedHosts = new Set([
          "maps.app.goo.gl",
          "goo.gl",
          "g.co",
          "www.google.com",
          "google.com",
          "maps.google.com",
        ]);
        if (!allowedHosts.has(parsed.hostname.toLowerCase())) return null;
        return parsed;
      } catch {
        return null;
      }
    };

    try {
      const requested = readUrl(req.query.url);
      if (!requested) {
        return res.status(400).json({ error: "URL de Google Maps inválida" });
      }

      let current = requested;
      for (let hop = 0; hop < 5; hop++) {
        const response = await fetch(current, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(5_000),
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          },
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) break;
          const next = readUrl(new URL(location, current).toString());
          if (!next) {
            return res.status(400).json({ error: "Redirección fuera de Google Maps bloqueada" });
          }
          current = next;
          continue;
        }
        break;
      }

      return res.json({ url: current.toString() });
    } catch {
      return res.status(502).json({ error: "No se pudo resolver el link de Google Maps" });
    }
  });

  // ── USER ROLES (Multi-rol) ──────────────────────────────────────────────────

  // Listar roles de un usuario. Público solo muestra datos mínimos; el
  // auto-reparado de cuentas antiguas solo ocurre para el propio usuario.
  app.get("/api/users/:username/roles", optionalAuth, publicReadLimiter, async (req: any, res, next) => {
    try {
      if (!isValidUsername(req.params.username)) {
        return res.status(400).json({ message: "Username inválido" });
      }
      const user = await storage.getUserByUsername(req.params.username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      let roles = await storage.getUserRoles(user.id);
      const isSelf = req.user?.username === user.username || req.user?.role === "admin";
      if (roles.length === 0 && isSelf) {
        await storage.addUserRole({ userId: user.id, role: (user.role || "traveler") as any });
        roles = await storage.getUserRoles(user.id);
      }
      res.json({
        roles: roles.map((record: any) => ({
          role: record.role,
          businessName: record.businessName ?? null,
          createdAt: record.createdAt ?? null,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // Agregar un rol al usuario (solo el propio usuario o un admin).
  app.post(
    "/api/users/:username/roles",
    requireAuth,
    requireSelfOrAdmin((req) => req.params.username),
    writeLimiter,
    async (req: any, res, next) => {
      try {
        const { username } = req.params;
        if (!isValidUsername(username)) {
          return res.status(400).json({ message: "Username inválido" });
        }
        const { role, businessName, businessAddress, businessPhone, vehicleType, plate, phone, languages } = req.body || {};
        if (!role) return res.status(400).json({ message: "role es obligatorio" });

        const validRoles = VALID_ROLES.filter((r) => r !== "admin");
        if (!validRoles.includes(role)) return res.status(400).json({ message: "Rol inválido" });

        const user = await storage.getUserByUsername(username);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const roleRecord = await storage.addUserRole({
          userId: user.id,
          role,
          businessName: sanitizeSingleLine(businessName, 120) || null,
          businessAddress: sanitizeSingleLine(businessAddress, 200) || null,
          // Reutilizamos businessPhone para idiomas del traductor.
          businessPhone: sanitizeSingleLine(businessPhone || languages, 120) || null,
          vehicleType: sanitizeSingleLine(vehicleType, 40) || null,
          plate: sanitizeSingleLine(plate, 20) || null,
          phone: sanitizeSingleLine(phone, 40) || null,
        });

        const updated = await storage.setActiveRole(user.id, role);

        if (role === "taxi" && (vehicleType || plate || phone)) {
          const db = getDb();
          if (vehicleType) await db.execute(drizzleSql`UPDATE users SET vehicle_type = ${sanitizeSingleLine(vehicleType, 40)} WHERE id = ${user.id}`);
          if (plate) await db.execute(drizzleSql`UPDATE users SET plate = ${sanitizeSingleLine(plate, 20)} WHERE id = ${user.id}`);
          if (phone) await db.execute(drizzleSql`UPDATE users SET phone = ${sanitizeSingleLine(phone, 40)} WHERE id = ${user.id}`);
        }

        logSecurityEvent("roles.add", { actor: req.user.username, target: username, role });
        res.json({ role: roleRecord, user: sanitizeUser(updated) });
      } catch (err) {
        next(err);
      }
    },
  );

  // Eliminar un rol del usuario (solo el propio usuario o un admin).
  app.delete(
    "/api/users/:username/roles/:role",
    requireAuth,
    requireSelfOrAdmin((req) => req.params.username),
    writeLimiter,
    async (req: any, res, next) => {
      try {
        const { username, role } = req.params;
        if (!VALID_ROLES.includes(role as any)) {
          return res.status(400).json({ message: "Rol inválido" });
        }
        if (role === "admin" && req.user.role !== "admin") {
          return res.status(403).json({ message: "No puedes eliminar el rol admin" });
        }
        const user = await storage.getUserByUsername(username);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const roles = await storage.getUserRoles(user.id);
        if (roles.length <= 1) return res.status(400).json({ message: "No puedes eliminar tu único rol" });

        if (user.role === role) {
          const remaining = roles.find((r) => r.role !== role);
          if (remaining) await storage.setActiveRole(user.id, remaining.role);
        }

        await storage.removeUserRole(user.id, role);
        const updatedUser = await storage.getUser(user.id);
        logSecurityEvent("roles.remove", { actor: req.user.username, target: username, role });
        res.json({ success: true, user: updatedUser ? sanitizeUser(updatedUser) : null });
      } catch (err) {
        next(err);
      }
    },
  );

  // Cambiar rol activo (solo el propio usuario o un admin).
  app.patch("/api/users/active-role", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const { role } = req.body || {};
      const username = req.user.role === "admin" && req.body?.username
        ? sanitizeSingleLine(req.body.username, 40)
        : req.user.username;
      if (!role) return res.status(400).json({ message: "role es obligatorio" });
      if (!isValidUsername(username)) return res.status(400).json({ message: "Username inválido" });
      if (!VALID_ROLES.includes(role)) return res.status(400).json({ message: "Rol inválido" });

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      let roles = await storage.getUserRoles(user.id);
      if (roles.length === 0) {
        await storage.addUserRole({ userId: user.id, role: (user.role || "traveler") as any });
        roles = await storage.getUserRoles(user.id);
      }
      const hasRole = roles.some((r) => r.role === role) || user.role === role;
      if (!hasRole) return res.status(400).json({ message: "No tienes este tipo de cuenta" });
      if (role === "admin" && user.role !== "admin" && req.user.role !== "admin") {
        return res.status(403).json({ message: "No puedes activar el rol admin" });
      }

      const updated = await storage.setActiveRole(user.id, role);
      res.json({ user: sanitizeUser(updated) });
    } catch (err) {
      next(err);
    }
  });

  // ── VEHICLE DATA ──────────────────────────────────────────────────────────

  app.patch("/api/taxi/vehicle", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const username = req.user.role === "admin" && req.body?.username
        ? sanitizeSingleLine(req.body.username, 40)
        : req.user.username;
      if (!isValidUsername(username)) return res.status(400).json({ message: "Username inválido" });
      if (username !== req.user.username && req.user.role !== "admin") {
        return res.status(403).json({ message: "No puedes modificar el vehículo de otra cuenta" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const roles = await storage.getUserRoles(user.id);
      const hasTaxiRole = user.role === "taxi" || roles.some((r: any) => r.role === "taxi");
      if (!hasTaxiRole && req.user.role !== "admin") {
        return res.status(403).json({ message: "Solo los taxistas pueden actualizar estos datos" });
      }

      const vehicleType = req.body?.vehicleType !== undefined ? sanitizeSingleLine(req.body.vehicleType, 40) : undefined;
      const plate = req.body?.plate !== undefined ? sanitizeSingleLine(req.body.plate, 20).toUpperCase() : undefined;
      const phone = req.body?.phone !== undefined ? sanitizeSingleLine(req.body.phone, 40) : undefined;
      if (plate !== undefined && !/^[A-Z0-9-]{3,10}$/.test(plate)) {
        return res.status(400).json({ message: "Placa inválida" });
      }
      if (phone !== undefined && !/^[+0-9 ()-]{7,32}$/.test(phone)) {
        return res.status(400).json({ message: "Teléfono inválido" });
      }

      const db = getDb();
      if (vehicleType !== undefined) await db.execute(drizzleSql`UPDATE users SET vehicle_type = ${vehicleType} WHERE id = ${user.id}`);
      if (plate !== undefined) await db.execute(drizzleSql`UPDATE users SET plate = ${plate} WHERE id = ${user.id}`);
      if (phone !== undefined) await db.execute(drizzleSql`UPDATE users SET phone = ${phone} WHERE id = ${user.id}`);

      const roleData = await storage.getUserRoleData(user.id, "taxi");
      if (roleData) {
        await storage.updateUserRoleData(user.id, "taxi", {
          vehicleType: vehicleType ?? roleData.vehicleType,
          plate: plate ?? roleData.plate,
          phone: phone ?? roleData.phone,
        });
      }

      res.json({ ok: true, message: "Datos del vehículo actualizados" });
    } catch (err) {
      next(err);
    }
  });

  // ── REVIEWS ───────────────────────────────────────────────────────────────

  app.post("/api/reviews", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const { rideId, targetUsername, rating, comment } = req.body || {};
      const safeRideId = sanitizeSingleLine(rideId, 80);
      const numericRating = Number(rating);
      if (!safeRideId || !isValidUsername(safeRideId) || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({ message: "rideId y rating (1-5) son obligatorios" });
      }

      const ride = await getRideById(safeRideId);
      if (!ride) return res.status(404).json({ message: "Viaje no encontrado" });
      if (ride.status !== "completed") {
        return res.status(400).json({ message: "Solo puedes reseñar viajes completados" });
      }

      const authorUsername = req.user.username;
      let resolvedTarget: string | null = null;
      let authorRole: "traveler" | "taxi" | null = null;
      if (ride.travelerUsername === authorUsername && ride.taxiUsername) {
        resolvedTarget = ride.taxiUsername;
        authorRole = "traveler";
      } else if (ride.taxiUsername === authorUsername) {
        resolvedTarget = ride.travelerUsername;
        authorRole = "taxi";
      }
      if (!resolvedTarget || !authorRole) {
        return res.status(403).json({ message: "No participaste en este viaje" });
      }
      if (resolvedTarget === authorUsername) {
        return res.status(400).json({ message: "No puedes reseñarte a ti mismo" });
      }
      if (targetUsername !== undefined && targetUsername !== null && targetUsername !== "") {
        const safeTarget = sanitizeSingleLine(targetUsername, 80);
        if (!isValidUsername(safeTarget)) {
          return res.status(400).json({ message: "Destinatario inválido" });
        }
        if (safeTarget !== resolvedTarget) {
          return res.status(400).json({ message: "El destinatario no corresponde al viaje" });
        }
      }

      const already = await storage.hasReviewedRide(safeRideId, authorUsername);
      if (already) return res.status(400).json({ message: "Ya dejaste una reseña para este viaje" });

      const review = await storage.createReview({
        rideId: safeRideId,
        authorUsername,
        targetUsername: resolvedTarget,
        rating: numericRating,
        comment: sanitizeSingleLine(comment, 500) || null,
        authorRole,
      });
      res.status(201).json({ review });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/reviews/:username", publicReadLimiter, async (req, res, next) => {
    try {
      if (!isValidUsername(req.params.username)) {
        return res.status(400).json({ message: "Username inválido" });
      }
      const revs = await storage.getReviewsByUsername(req.params.username);
      const avg = await storage.getAverageRating(req.params.username);
      res.json({ reviews: revs, averageRating: avg });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/reviews/ride/:rideId", requireAuth, async (req: any, res, next) => {
    try {
      const ride = await getRideById(req.params.rideId);
      if (!ride) return res.status(404).json({ message: "Viaje no encontrado" });
      if (
        ride.travelerUsername !== req.user.username &&
        ride.taxiUsername !== req.user.username &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({ message: "No participaste en este viaje" });
      }
      const revs = await storage.getReviewsByRide(req.params.rideId);
      res.json({ reviews: revs });
    } catch (err) {
      next(err);
    }
  });

  // ── PAYMENT METHODS ───────────────────────────────────────────────────────

  // ── PAYMENT METHODS (siempre autenticado y con ownership) ─────────────────
  app.get(
    "/api/payment-methods/:username",
    requireAuth,
    requireSelfOrAdmin((req) => req.params.username),
    async (req: any, res, next) => {
      try {
        if (!isValidUsername(req.params.username)) {
          return res.status(400).json({ message: "Username inválido" });
        }
        const methods = await storage.getPaymentMethods(req.params.username);
        res.json({ methods: methods.map(sanitizePaymentMethod) });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post("/api/payment-methods", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const { username: bodyUsername, type, label, details, isDefault } = req.body || {};
      const username = req.user.role === "admin" && bodyUsername
        ? sanitizeSingleLine(bodyUsername, 40)
        : req.user.username;
      if (!isValidUsername(username)) return res.status(400).json({ message: "Username inválido" });
      if (!type || !label) return res.status(400).json({ message: "type y label son obligatorios" });

      const validTypes = ["cash", "nequi", "daviplata", "card"];
      if (!validTypes.includes(type)) return res.status(400).json({ message: "Tipo de pago inválido" });

      const safeLabel = sanitizeSingleLine(label, 60);
      const safeDetails = sanitizeSingleLine(details, 120);
      if (!safeLabel) return res.status(400).json({ message: "Etiqueta inválida" });

      const method = await storage.addPaymentMethod({
        username,
        type,
        label: safeLabel,
        details: safeDetails ? encryptSensitive(safeDetails) : null,
        isDefault: isDefault === true || isDefault === "true" ? "true" : "false",
      });
      res.status(201).json({ method: sanitizePaymentMethod(method) });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/payment-methods/:id", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const bodyUsername = req.body?.username;
      const username = req.user.role === "admin" && bodyUsername
        ? sanitizeSingleLine(bodyUsername, 40)
        : req.user.username;
      await storage.removePaymentMethod(req.params.id, username);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/payment-methods/:id/default", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const bodyUsername = req.body?.username;
      const username = req.user.role === "admin" && bodyUsername
        ? sanitizeSingleLine(bodyUsername, 40)
        : req.user.username;
      await storage.setDefaultPaymentMethod(req.params.id, username);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ── USER PROFILE ──────────────────────────────────────────────────────────
  
  app.patch("/api/user/profile", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const { name, bio, avatarUrl } = req.body || {};
      const bodyUsername = req.body?.username;
      const username = req.user.role === "admin" && bodyUsername
        ? sanitizeSingleLine(bodyUsername, 40)
        : req.user.username;
      if (!isValidUsername(username)) return res.status(400).json({ message: "Username inválido" });
      if (name !== undefined && !String(name).trim()) {
        return res.status(400).json({ message: "El nombre no puede estar vacío" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const db = getDb();
      const patch: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) patch.name = sanitizeSingleLine(name, 120);
      if (bio !== undefined) patch.bio = sanitizeSingleLine(bio, 500) || null;
      if (avatarUrl !== undefined) {
        try {
          patch.avatarUrl = validateAvatarUrl(avatarUrl);
        } catch (err: any) {
          return res.status(400).json({ message: err.message });
        }
      }

      const updatedRows = await db.update(users).set(patch).where(eq(users.id, user.id)).returning();
      res.json({ user: sanitizeUser(updatedRows[0]) });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/users/:username/profile", publicReadLimiter, async (req, res, next) => {
    try {
      if (!isValidUsername(req.params.username)) {
        return res.status(400).json({ message: "Username inválido" });
      }
      const profile = await storage.getUserProfile(req.params.username);
      if (!profile) return res.status(404).json({ message: "Usuario no encontrado" });
      res.json({ profile });
    } catch (err) {
      next(err);
    }
  });

  // ── NOTIFICATIONS (ownership derivado del token, nunca del query/body) ───
  app.get("/api/notifications", requireAuth, publicReadLimiter, async (req: any, res, next) => {
    try {
      const items = await storage.getNotificationsForUser(req.user.username);
      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const id = sanitizeSingleLine(req.params.id, 80);
      if (!id) return res.status(400).json({ message: "Notificación inválida" });
      const updated = await storage.markNotificationAsRead(
        id,
        req.user.username,
        req.user.role === "admin",
      );
      if (!updated) return res.status(404).json({ message: "Notificación no encontrada" });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  app.get("/api/admin/stats", requireAuth, requireRole("admin"), async (_req, res, next) => {
    try {
      const db = getDb();
      const [usersRes, providersRes, verifiedRes, lockedRes, logsRes] = await Promise.all([
        db.execute(drizzleSql`SELECT COUNT(*) as c FROM users`),
        db.execute(drizzleSql`SELECT COUNT(*) as c FROM users WHERE role != 'traveler' AND role != 'admin'`),
        db.execute(drizzleSql`SELECT COUNT(*) as c FROM users WHERE is_verified = 'true'`),
        db.execute(drizzleSql`SELECT COUNT(*) as c FROM users WHERE lock_until > now()`),
        db.execute(drizzleSql`
          SELECT id, failed_login_attempts as event, updated_at as timestamp
          FROM users
          WHERE failed_login_attempts > 3
          ORDER BY updated_at DESC LIMIT 10
        `),
      ]);

      res.json({
        totalUsers: Number(((usersRes as any).rows ?? usersRes)[0]?.c || 0),
        totalProviders: Number(((providersRes as any).rows ?? providersRes)[0]?.c || 0),
        verifiedUsers: Number(((verifiedRes as any).rows ?? verifiedRes)[0]?.c || 0),
        lockedAccounts: Number(((lockedRes as any).rows ?? lockedRes)[0]?.c || 0),
        // No se exponen usernames en los logs de anomalías.
        logs: ((logsRes as any).rows ?? logsRes).map((l: any) => ({
          event: `Múltiples intentos de login fallidos (${Number(l.event) || 0})`,
          timestamp: l.timestamp,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // ── E-COMMERCE: Productos y Órdenes ───────────────────────────────────────

  // GET /api/products?category=hotel&page=1&limit=12
  app.get("/api/products", publicReadLimiter, async (req, res, next) => {
    try {
      const db = getDb();
      const category = typeof req.query.category === "string" ? req.query.category : undefined;
      if (category && !PROVIDER_ROLES.includes(category as any)) {
        return res.status(400).json({ message: "Categoría inválida" });
      }
      const parsedLimit = Number.parseInt(String(req.query.limit || "12"), 10);
      const parsedOffset = Number.parseInt(String(req.query.offset || "0"), 10);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 12;
      const offset = Number.isFinite(parsedOffset) ? Math.min(Math.max(parsedOffset, 0), 100_000) : 0;

      const rows = await db.execute(drizzleSql`
        SELECT p.id, p.provider_username, p.role_category, p.name, p.description,
               p.price, p.currency, p.stock, p.cover_image, p.is_active,
               p.created_at, p.updated_at,
               u.avatar_url, u.name AS provider_name
        FROM products p
        JOIN users u ON u.id = p.provider_id
        WHERE p.is_active = true
        ${category ? drizzleSql`AND p.role_category = ${category}` : drizzleSql``}
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      const products = (rows as any).rows ?? (rows as any) ?? [];

      const countRow = await db.execute(drizzleSql`
        SELECT COUNT(*) as total FROM products
        WHERE is_active = true
        ${category ? drizzleSql`AND role_category = ${category}` : drizzleSql``}
      `);
      const total = parseInt(((countRow as any).rows ?? (countRow as any))[0]?.total ?? "0");

      res.json({ products, total, hasMore: offset + limit < total });
    } catch (err) { next(err); }
  });

  // GET /api/products/provider/:username
  // `cost` es información financiera privada: solo se incluye para el dueño o admin.
  app.get("/api/products/provider/:username", optionalAuth, publicReadLimiter, async (req: any, res, next) => {
    try {
      if (!isValidUsername(req.params.username)) {
        return res.status(400).json({ message: "Username inválido" });
      }
      await ensureAnalyticsSchema();
      const db = getDb();
      const role = typeof req.query.role === "string" ? req.query.role : undefined;
      if (role && !PROVIDER_ROLES.includes(role as any)) {
        return res.status(400).json({ message: "Categoría inválida" });
      }
      const rows = await db.execute(drizzleSql`
        SELECT p.*,
               (SELECT json_agg(json_build_object(
                         'id', m.id,
                         'url', m.file_url,
                         'type', lower(m.asset_type::text),
                         'caption', m.title,
                         'sort_order', 0
                       ) ORDER BY m.created_at ASC)
                FROM media_assets m WHERE m.entity_id = p.id AND m.entity_type = 'product') AS media
        FROM products p
        WHERE p.provider_username = ${req.params.username}
        ${role ? drizzleSql`AND p.role_category = ${role}` : drizzleSql``}
        ORDER BY p.created_at DESC
      `);
      const raw = (rows as any).rows ?? (rows as any) ?? [];
      const canSeePrivate = Boolean(
        req.user && (req.user.username === req.params.username || req.user.role === "admin"),
      );
      const products = canSeePrivate
        ? raw
        : raw.map((product: any) => {
            const { cost, provider_id, ...publicFields } = product;
            return publicFields;
          });
      res.json({ products });
    } catch (err) { next(err); }
  });

  // POST /api/products — create product with cover image
  app.post(
    "/api/products",
    requireAuth,
    requireRole(...PROVIDER_ROLES),
    writeLimiter,
    uploadLimiter,
    upload.single("coverImage"),
    async (req: any, res, next) => {
      try {
        await ensureAnalyticsSchema();
        const { name, description, price, cost, currency, stock, roleCategory } = req.body || {};
        const safeName = sanitizeSingleLine(name, 120);
        const numericPrice = Number(price);
        const numericCost = Number(cost || 0);
        const numericStock = stock === undefined || stock === "" ? -1 : Number(stock);
        const safeCurrency = sanitizeSingleLine(currency || "COP", 3).toUpperCase();

        if (!safeName || !Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice > 100_000_000) {
          return res.status(400).json({ message: "name y price válido son obligatorios" });
        }
        if (!Number.isFinite(numericCost) || numericCost < 0) {
          return res.status(400).json({ message: "Costo inválido" });
        }
        if (!Number.isInteger(numericStock) || numericStock < -1 || numericStock > 1_000_000) {
          return res.status(400).json({ message: "Stock inválido" });
        }
        if (!/^[A-Z]{3}$/.test(safeCurrency)) {
          return res.status(400).json({ message: "Moneda inválida" });
        }

        let selectedRole = sanitizeSingleLine(roleCategory || req.user.role, 30);
        if (!PROVIDER_ROLES.includes(selectedRole as any)) {
          return res.status(400).json({ message: "Categoría de proveedor inválida" });
        }
        if (req.user.role !== "admin" && selectedRole !== req.user.role) {
          const roles = await storage.getUserRoles(req.user.id);
          if (!roles.some((r: any) => r.role === selectedRole)) {
            return res.status(403).json({ message: "No tienes ese rol de proveedor" });
          }
        }
        // El body.username solo lo puede usar un admin; el resto opera con su cuenta.
        const requestedUsername = sanitizeSingleLine(req.body?.username, 40);
        const provider = req.user.role === "admin" && requestedUsername
          ? await storage.getUserByUsername(requestedUsername)
          : { id: req.user.id, username: req.user.username };
        if (!provider) return res.status(404).json({ message: "Usuario no encontrado" });

        let coverImage: string | null = null;
        if (req.file) {
          const uploaded = await uploadValidatedFile(req.file, `vianova/products/${provider.id}`, "image");
          coverImage = uploaded.url;
        } else if (req.body.coverImage) {
          if (!isValidHttpUrl(req.body.coverImage)) {
            return res.status(400).json({ message: "URL de portada inválida" });
          }
          coverImage = String(req.body.coverImage).slice(0, 1000);
        }

        const db = getDb();
        const inserted = await db.execute(drizzleSql`
          INSERT INTO products (provider_id, provider_username, role_category, name, description, price, cost, currency, stock, cover_image)
          VALUES (${provider.id}, ${provider.username}, ${selectedRole}, ${safeName}, ${sanitizeSingleLine(description, 2000) || null},
                  ${numericPrice}, ${numericCost}, ${safeCurrency}, ${numericStock}, ${coverImage})
          RETURNING *
        `);
        const product = ((inserted as any).rows ?? (inserted as any))[0];
        res.json({ product });
      } catch (err: any) {
        if (err?.status === 415) return res.status(415).json({ message: err.message });
        next(err);
      }
    },
  );

  // PATCH /api/products/:id — update product (solo dueño/admin)
  app.patch(
    "/api/products/:id",
    requireAuth,
    requireRole(...PROVIDER_ROLES),
    uploadLimiter,
    upload.single("coverImage"),
    async (req: any, res, next) => {
      try {
        await ensureAnalyticsSchema();
        const db = getDb();
        const existingRows = await db.execute(drizzleSql`
          SELECT id, provider_id FROM products WHERE id = ${req.params.id} LIMIT 1
        `);
        const existing = ((existingRows as any).rows ?? (existingRows as any))[0];
        if (!existing) return res.status(404).json({ message: "Producto no encontrado" });
        if (existing.provider_id !== req.user.id && req.user.role !== "admin") {
          return res.status(403).json({ message: "No puedes editar productos de otro proveedor" });
        }

        const { name, description, price, cost, currency, stock, isActive } = req.body || {};
        let coverImage: string | undefined;
        if (req.file) {
          const uploaded = await uploadValidatedFile(req.file, `vianova/products/${req.user.id}`, "image");
          coverImage = uploaded.url;
        }

        const numericPrice = price !== undefined && price !== "" ? Number(price) : null;
        const numericCost = cost !== undefined && cost !== "" ? Number(cost) : null;
        const numericStock = stock !== undefined && stock !== "" ? Number(stock) : null;
        if (numericPrice !== null && (!Number.isFinite(numericPrice) || numericPrice <= 0)) {
          return res.status(400).json({ message: "Precio inválido" });
        }
        if (numericCost !== null && (!Number.isFinite(numericCost) || numericCost < 0)) {
          return res.status(400).json({ message: "Costo inválido" });
        }
        if (numericStock !== null && (!Number.isInteger(numericStock) || numericStock < -1)) {
          return res.status(400).json({ message: "Stock inválido" });
        }
        const safeCurrency = currency ? sanitizeSingleLine(currency, 3).toUpperCase() : null;
        if (safeCurrency && !/^[A-Z]{3}$/.test(safeCurrency)) {
          return res.status(400).json({ message: "Moneda inválida" });
        }

        const updateRows = await db.execute(drizzleSql`
          UPDATE products SET
            name        = COALESCE(${sanitizeSingleLine(name, 120) || null}, name),
            description = COALESCE(${description !== undefined ? (sanitizeSingleLine(description, 2000) || null) : null}, description),
            price       = COALESCE(${numericPrice}, price),
            cost        = COALESCE(${numericCost}, cost),
            currency    = COALESCE(${safeCurrency}, currency),
            stock       = COALESCE(${numericStock}, stock),
            is_active   = COALESCE(${isActive != null ? (isActive === true || isActive === "true") : null}, is_active),
            cover_image = COALESCE(${coverImage || null}, cover_image),
            updated_at  = now()
          WHERE id = ${req.params.id} AND provider_id = ${existing.provider_id}
          RETURNING *
        `);
        const product = ((updateRows as any).rows ?? (updateRows as any))[0];
        if (!product) return res.status(404).json({ message: "Producto no encontrado" });
        res.json({ product });
      } catch (err: any) {
        if (err?.status === 415) return res.status(415).json({ message: err.message });
        next(err);
      }
    },
  );

  // DELETE /api/products/:id (solo dueño/admin)
  app.delete("/api/products/:id", requireAuth, requireRole(...PROVIDER_ROLES), writeLimiter, async (req: any, res, next) => {
    try {
      const db = getDb();
      const deleted = await db.execute(drizzleSql`
        DELETE FROM products
        WHERE id = ${req.params.id}
          AND (${req.user.role === "admin"} OR provider_id = ${req.user.id})
        RETURNING id
      `);
      const rows = (deleted as any).rows ?? (deleted as any) ?? [];
      if (!rows.length) return res.status(404).json({ message: "Producto no encontrado" });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/products/:id/media — add extra media asset (360, video, 3D)
  app.post(
    "/api/products/:id/media",
    requireAuth,
    requireRole(...PROVIDER_ROLES),
    uploadLimiter,
    upload.single("file"),
    async (req: any, res, next) => {
      try {
        const { mediaType, caption } = req.body || {};
        if (!req.file && !req.body.url) return res.status(400).json({ message: "file o url requerido" });

        const db = getDb();
        const productRow = await db.execute(drizzleSql`
          SELECT id, provider_id, provider_username, role_category
          FROM products WHERE id = ${req.params.id}
        `);
        const product = ((productRow as any).rows ?? (productRow as any))[0];
        if (!product) return res.status(404).json({ message: "Producto no encontrado" });
        if (product.provider_id !== req.user.id && req.user.role !== "admin") {
          return res.status(403).json({ message: "No puedes modificar la multimedia de otro proveedor" });
        }

        const allowedTypes = ["image", "video", "360_image", "3d_model", "vr_tour"];
        if (mediaType !== undefined && mediaType !== null && mediaType !== "" && !allowedTypes.includes(mediaType)) {
          return res.status(400).json({ message: "mediaType inválido" });
        }
        const safeMediaType = allowedTypes.includes(mediaType) ? mediaType : "image";

        let url: string;
        let publicId: string;
        if (req.file) {
          const resourceType = safeMediaType.includes("video") ? "video" : safeMediaType === "3d_model" ? "raw" : "image";
          const uploaded = await uploadValidatedFile(req.file, `vianova/products/media/${req.user.id}`, resourceType);
          url = uploaded.url;
          publicId = uploaded.publicId;
        } else {
          if (!isValidHttpUrl(req.body.url)) {
            return res.status(400).json({ message: "URL de multimedia inválida" });
          }
          url = String(req.body.url).slice(0, 1000);
          publicId = sanitizeSingleLine(req.body.publicId, 200) || `external-${Date.now()}`;
        }

        const assetTypeMap: Record<string, string> = {
          image: "IMAGE",
          video: "VIDEO",
          "360_image": "IMAGE_360",
          "3d_model": "MODEL_3D",
          vr_tour: "VR_TOUR",
        };
        const assetType = assetTypeMap[safeMediaType] || "IMAGE";

        const inserted = await db.execute(drizzleSql`
          INSERT INTO media_assets (
            owner_id, owner_role, entity_id, entity_type, title,
            asset_type, file_url, cloudinary_public_id, mime_type, file_size
          )
          VALUES (
            ${product.provider_id}, ${product.role_category || "traveler"}, ${req.params.id}, 'product', ${sanitizeSingleLine(caption, 200) || null},
            ${assetType}::asset_type, ${url}, ${publicId}, ${req.file?.mimetype || "application/octet-stream"}, ${req.file?.size || 0}
          )
          RETURNING id, file_url AS url, lower(asset_type::text) AS type, title AS caption, 0 AS sort_order
        `);
        res.json({ asset: ((inserted as any).rows ?? (inserted as any))[0] });
      } catch (err: any) {
        if (err?.status === 415) return res.status(415).json({ message: err.message });
        next(err);
      }
    },
  );

  // DELETE /api/products/:id/media/:assetId (solo dueño del producto/admin)
  app.delete("/api/products/:id/media/:assetId", requireAuth, requireRole(...PROVIDER_ROLES), writeLimiter, async (req: any, res, next) => {
    try {
      const db = getDb();
      const assetRow = await db.execute(drizzleSql`
        SELECT p.provider_username
        FROM media_assets m
        JOIN products p ON p.id = m.entity_id
        WHERE m.id = ${req.params.assetId}
          AND m.entity_id = ${req.params.id}
          AND m.entity_type = 'product'
        LIMIT 1
      `);
      const asset = ((assetRow as any).rows ?? (assetRow as any))[0];
      if (!asset) return res.status(404).json({ message: "Multimedia no encontrada" });
      if (!isOwnerOrAdmin(req.user, asset.provider_username)) {
        return res.status(403).json({ message: "No puedes eliminar multimedia de otro proveedor" });
      }
      await db.execute(drizzleSql`
        DELETE FROM media_assets
        WHERE id = ${req.params.assetId} AND entity_id = ${req.params.id} AND entity_type = 'product'
      `);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/orders — crear orden (comprador autenticado, stock atómico)
  app.post("/api/orders", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      await ensureCommerceSchema();
      const { productId, quantity, notes } = req.body || {};
      const safeProductId = sanitizeSingleLine(productId, 64);
      const qty = Number(quantity || 1);
      if (!safeProductId) return res.status(400).json({ message: "productId requerido" });
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ message: "Cantidad inválida (1-99)" });
      }
      const idempotencyKey = sanitizeSingleLine(
        req.get("idempotency-key") || req.body?.idempotencyKey,
        100,
      ) || null;

      const db = getDb();
      if (idempotencyKey) {
        const existing = await db.execute(drizzleSql`
          SELECT * FROM orders
          WHERE buyer_id = ${req.user.id} AND idempotency_key = ${idempotencyKey}
          LIMIT 1
        `);
        const prior = ((existing as any).rows ?? (existing as any))[0];
        if (prior) return res.json({ order: prior, idempotent: true });
      }

      const result = await db.execute(drizzleSql`
        WITH reserved AS (
          UPDATE products
          SET stock = CASE WHEN stock = -1 THEN -1 ELSE stock - ${qty} END,
              updated_at = now()
          WHERE id = ${safeProductId}
            AND is_active = true
            AND provider_id <> ${req.user.id}
            AND (stock = -1 OR stock >= ${qty})
          RETURNING id, provider_id, provider_username, name, price, currency
        ), inserted AS (
          INSERT INTO orders (buyer_id, product_id, quantity, unit_price, total, notes, idempotency_key)
          SELECT ${req.user.id}, r.id, ${qty}, r.price, (r.price * ${qty})::numeric,
                 ${sanitizeSingleLine(notes, 500) || null}, ${idempotencyKey}
          FROM reserved r
          RETURNING *
        )
        SELECT i.*, r.name AS product_name, r.provider_username, r.currency
        FROM inserted i JOIN reserved r ON r.id = i.product_id
      `);
      const order = ((result as any).rows ?? (result as any))[0];
      if (!order) {
        return res.status(409).json({ message: "Producto no disponible o stock insuficiente" });
      }

      const provider = await storage.getUserByUsername(order.provider_username);
      if (provider?.email) {
        sendCustomEmail({
          to: provider.email,
          subject: sanitizeSingleLine(`Nueva orden: ${order.product_name}`, 150),
          html: `<p>@${escapeHtml(req.user.username)} ha solicitado <strong>${qty}x ${escapeHtml(order.product_name)}</strong> — Total: $${escapeHtml(order.total)} ${escapeHtml(order.currency)}.</p>`,
        }).catch(() => {});
      }

      res.json({ order });
    } catch (err: any) {
      if (err?.code === "23505" && req.body?.idempotencyKey) {
        return res.status(409).json({ message: "Solicitud duplicada" });
      }
      next(err);
    }
  });

  // GET /api/orders/buyer/:username (solo el comprador o admin)
  app.get(
    "/api/orders/buyer/:username",
    requireAuth,
    requireSelfOrAdmin((req) => req.params.username),
    async (req: any, res, next) => {
      try {
        if (!isValidUsername(req.params.username)) {
          return res.status(400).json({ message: "Username inválido" });
        }
        const buyer = await storage.getUserByUsername(req.params.username);
        if (!buyer) return res.status(404).json({ message: "Usuario no encontrado" });
        const db = getDb();
        const rows = await db.execute(drizzleSql`
          SELECT o.*, p.name AS product_name, p.cover_image, p.provider_username
          FROM orders o JOIN products p ON p.id = o.product_id
          WHERE o.buyer_id = ${buyer.id}
          ORDER BY o.created_at DESC LIMIT 50
        `);
        res.json({ orders: (rows as any).rows ?? (rows as any) ?? [] });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/orders/provider/:username (solo el proveedor o admin)
  app.get(
    "/api/orders/provider/:username",
    requireAuth,
    requireSelfOrAdmin((req) => req.params.username),
    async (req: any, res, next) => {
      try {
        if (!isValidUsername(req.params.username)) {
          return res.status(400).json({ message: "Username inválido" });
        }
        const db = getDb();
        const rows = await db.execute(drizzleSql`
          SELECT o.*, p.name AS product_name, p.cover_image, u.username AS buyer_username
          FROM orders o
          JOIN products p ON p.id = o.product_id
          JOIN users u ON u.id = o.buyer_id
          WHERE p.provider_username = ${req.params.username}
          ORDER BY o.created_at DESC LIMIT 50
        `);
        res.json({ orders: (rows as any).rows ?? (rows as any) ?? [] });
      } catch (err) {
        next(err);
      }
    },
  );

  // PATCH /api/orders/:id/status (transiciones y reposición única)
  app.patch("/api/orders/:id/status", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      const { status } = req.body || {};
      const validStatuses = ["pending", "paid", "completed", "cancelled", "refunded"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "status inválido" });
      }

      const db = getDb();
      const rowResult = await db.execute(drizzleSql`
        SELECT o.id, o.status, o.quantity, o.buyer_id, p.id AS product_id, p.provider_id, p.stock
        FROM orders o JOIN products p ON p.id = o.product_id
        WHERE o.id = ${req.params.id}
      `);
      const order = ((rowResult as any).rows ?? (rowResult as any))[0];
      if (!order) return res.status(404).json({ message: "Orden no encontrada" });

      const isAdmin = req.user.role === "admin";
      const isBuyer = order.buyer_id === req.user.id;
      const isProvider = order.provider_id === req.user.id;
      if (!isAdmin && !isBuyer && !isProvider) {
        return res.status(403).json({ message: "No puedes modificar esta orden" });
      }

      // 'paid' solo lo puede fijar el webhook de Stripe (o un admin explícitamente).
      if (!isAdmin && status === "paid") {
        return res.status(403).json({ message: "Solo el sistema de pagos puede marcar la orden como pagada" });
      }
      const transitions: Record<string, string[]> = {
        pending: ["cancelled", "refunded", "completed"],
        paid: ["completed", "cancelled", "refunded"],
        completed: ["refunded"],
        cancelled: [],
        refunded: [],
      };
      if (!isAdmin && !transitions[order.status]?.includes(status)) {
        return res.status(400).json({ message: `Transición no permitida: ${order.status} → ${status}` });
      }
      // El comprador solo puede cancelar mientras la orden siga pendiente.
      if (!isAdmin && isBuyer && !isProvider && !(order.status === "pending" && status === "cancelled")) {
        return res.status(403).json({ message: "El comprador solo puede cancelar su orden pendiente" });
      }

      const isReleasing = ["cancelled", "refunded"].includes(status) && !["cancelled", "refunded"].includes(order.status);
      const updateResult = await db.execute(drizzleSql`
        WITH changed AS (
          UPDATE orders SET status = ${status}, updated_at = now()
          WHERE id = ${req.params.id} AND status = ${order.status}
          RETURNING id, quantity, product_id
        ), restocked AS (
          UPDATE products
          SET stock = stock + ${Number(order.quantity) || 1}, updated_at = now()
          WHERE id = ${order.product_id}
            AND ${isReleasing}
            AND stock >= 0
            AND EXISTS (SELECT 1 FROM changed)
          RETURNING id
        )
        SELECT id FROM changed
      `);
      const changed = ((updateResult as any).rows ?? (updateResult as any))[0];
      if (!changed) {
        return res.status(409).json({ message: "La orden cambió de estado. Recarga e inténtalo de nuevo." });
      }
      res.json({ success: true, restocked: isReleasing && Number(order.stock) >= 0 });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/stripe/create-checkout-session (solo el comprador autenticado)
  app.post("/api/stripe/create-checkout-session", requireAuth, writeLimiter, async (req: any, res, next) => {
    try {
      await ensureCommerceSchema();
      const { productId, quantity } = req.body || {};
      const safeProductId = sanitizeSingleLine(productId, 64);
      const qty = Number(quantity || 1);
      if (!safeProductId) return res.status(400).json({ message: "productId requerido" });
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ message: "Cantidad inválida (1-99)" });
      }
      if (!process.env.STRIPE_SECRET_KEY) {
        // Fallback dummy si no hay API key configurada.
        return res.json({ url: "/products?success=true&dummy=1" });
      }

      const db = getDb();
      const prodRow = await db.execute(drizzleSql`
        SELECT * FROM products WHERE id = ${safeProductId} AND is_active = true
      `);
      const product = ((prodRow as any).rows ?? (prodRow as any))[0];
      if (!product) return res.status(404).json({ message: "Producto no encontrado" });
      if (product.provider_id === req.user.id) {
        return res.status(400).json({ message: "No puedes comprar tu propio producto" });
      }
      if (Number(product.stock) >= 0 && Number(product.stock) < qty) {
        return res.status(409).json({ message: "Stock insuficiente" });
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: String(product.currency).toLowerCase(),
            product_data: {
              name: sanitizeSingleLine(product.name, 120),
              images: isValidHttpUrl(product.cover_image) ? [product.cover_image] : [],
            },
            unit_amount: Math.round(Number(product.price) * 100),
          },
          quantity: qty,
        }],
        mode: "payment",
        success_url: `${getAppBaseUrl()}/products?success=true`,
        cancel_url: `${getAppBaseUrl()}/products?canceled=true`,
        metadata: {
          productId: safeProductId,
          buyerUsername: req.user.username,
          buyerId: req.user.id,
          quantity: String(qty),
        },
      });

      res.json({ url: session.url });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/stripe/webhook (única fuente de verdad para órdenes pagadas)
  app.post("/api/stripe/webhook", async (req, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(503).send("Stripe not configured");
      }
      const signature = req.headers["stripe-signature"];
      if (!signature || typeof signature !== "string") {
        return res.status(400).send("Missing Stripe signature");
      }
      if (!Buffer.isBuffer(req.rawBody)) {
        return res.status(400).send("Missing raw body");
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      let event: any;
      try {
        event = stripe.webhooks.constructEvent(req.rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
      } catch {
        return res.status(400).send("Invalid Stripe signature");
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as any;
        if (session.payment_status !== "paid") {
          return res.json({ received: true, ignored: "not_paid" });
        }
        const meta = session.metadata || {};
        const qty = Number(meta.quantity || 1);
        const buyer = meta.buyerUsername ? await storage.getUserByUsername(meta.buyerUsername) : null;
        if (!buyer || (meta.buyerId && meta.buyerId !== buyer.id) || !meta.productId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
          logSecurityEvent("stripe.invalid_metadata", { eventId: event.id });
          return res.json({ received: true, ignored: "invalid_metadata" });
        }

        await ensureCommerceSchema();
        const db = getDb();
        const existing = await db.execute(drizzleSql`
          SELECT id FROM orders WHERE payment_intent = ${session.payment_intent} LIMIT 1
        `);
        if (((existing as any).rows ?? (existing as any) ?? []).length > 0) {
          return res.json({ received: true, idempotent: true });
        }

        const prodRow = await db.execute(drizzleSql`SELECT * FROM products WHERE id = ${meta.productId} LIMIT 1`);
        const product = ((prodRow as any).rows ?? (prodRow as any))[0];
        if (!product) {
          logSecurityEvent("stripe.product_missing", { eventId: event.id });
          return res.json({ received: true, ignored: "product_missing" });
        }

        const expectedAmount = Math.round(Number(product.price) * qty * 100);
        if (
          Number(session.amount_total) !== expectedAmount ||
          String(session.currency || "").toLowerCase() !== String(product.currency || "").toLowerCase()
        ) {
          logSecurityEvent("stripe.amount_mismatch", { eventId: event.id });
          return res.status(400).send("Amount mismatch");
        }

        const result = await db.execute(drizzleSql`
          WITH reserved AS (
            UPDATE products
            SET stock = CASE WHEN stock = -1 THEN -1 ELSE stock - ${qty} END,
                updated_at = now()
            WHERE id = ${product.id}
              AND is_active = true
              AND provider_id <> ${buyer.id}
              AND (stock = -1 OR stock >= ${qty})
            RETURNING id, price, currency, provider_username
          ), inserted AS (
            INSERT INTO orders (buyer_id, product_id, quantity, unit_price, total, status, payment_intent)
            SELECT ${buyer.id}, r.id, ${qty}, r.price, (r.price * ${qty})::numeric, 'paid', ${session.payment_intent}
            FROM reserved r
            RETURNING *
          )
          SELECT * FROM inserted
        `);
        const order = ((result as any).rows ?? (result as any))[0];
        if (!order) {
          logSecurityEvent("stripe.stock_unavailable", { eventId: event.id, productId: product.id });
          return res.json({ received: true, ignored: "stock_unavailable" });
        }

        const provider = await storage.getUserByUsername(product.provider_username);
        if (provider?.email) {
          sendCustomEmail({
            to: provider.email,
            subject: sanitizeSingleLine(`Pago Confirmado: ${product.name}`, 150),
            html: `<p>@${escapeHtml(buyer.username)} ha pagado por <strong>${qty}x ${escapeHtml(product.name)}</strong> — Total: $${escapeHtml(order.total)} ${escapeHtml(product.currency)}.</p>`,
          }).catch(() => {});
        }
      }

      return res.json({ received: true });
    } catch (err: any) {
      // Nunca devolver detalles internos al emisor del webhook.
      console.error("[stripe] webhook error:", err?.message || err);
      return res.status(400).send("Webhook Error");
    }
  });

  // ── Módulo Taxi ────────────────────────────────────────────────────────────
  registerTaxiRoutes(app);

  return app;
}
