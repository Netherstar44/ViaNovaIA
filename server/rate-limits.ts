import crypto from "crypto";
import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import { createRateLimitStore } from "./security.js";

/**
 * Limitadores centralizados. La clave combina IP y cuenta cuando existe para
 * que un atacante no pueda repartir intentos entre varias IPs ni bloquear a
 * todos los usuarios de una red.
 */
function store() {
  return createRateLimitStore() as Options["store"];
}

function accountHash(value: unknown): string {
  return crypto.createHash("sha256").update(String(value ?? "").trim().toLowerCase()).digest("hex").slice(0, 24);
}

function ip(req: any): string {
  return ipKeyGenerator(String(req.ip || "0.0.0.0"));
}

function userOrIp(req: any): string {
  const id = req.user?.id || req.user?.username;
  return id ? `user:${accountHash(id)}` : ip(req);
}

function jsonHandler(message: string) {
  return (_req: any, res: any) => res.status(429).json({ message });
}

const common = () => ({
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  // express-rate-limit exige una instancia de store por limitador.
  store: store(),
});

export const authLimiter = rateLimit({
  ...common(),
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `login:${ip(req)}:${accountHash(req.body?.username || req.body?.email)}`,
  handler: jsonHandler("Demasiados intentos. Por favor, inténtalo de nuevo más tarde."),
});

export const registerLimiter = rateLimit({
  ...common(),
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `register:${ip(req)}`,
  handler: jsonHandler("Demasiadas cuentas creadas desde esta conexión. Inténtalo más tarde."),
});

export const twoFactorLimiter = rateLimit({
  ...common(),
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `2fa:${ip(req)}:${accountHash(req.body?.username)}`,
  handler: jsonHandler("Demasiados códigos incorrectos. Espera 15 minutos e inténtalo de nuevo."),
});

export const verifyEmailLimiter = rateLimit({
  ...common(),
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `verify-email:${ip(req)}:${accountHash(req.body?.username)}`,
  handler: jsonHandler("Demasiados intentos de verificación. Inténtalo más tarde."),
});

export const forgotPasswordLimiter = rateLimit({
  ...common(),
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `forgot:${ip(req)}:${accountHash(req.body?.email)}`,
  handler: jsonHandler("Demasiadas solicitudes de recuperación. Inténtalo más tarde."),
});

export const resetTokenLimiter = rateLimit({
  ...common(),
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `reset-token:${ip(req)}`,
  handler: jsonHandler("Demasiados intentos. Inténtalo más tarde."),
});

export const uploadLimiter = rateLimit({
  ...common(),
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: userOrIp,
  handler: jsonHandler("Límite de subida de archivos alcanzado."),
});

export const chatLimiter = rateLimit({
  ...common(),
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: userOrIp,
  handler: jsonHandler("Demasiados mensajes. Espera un momento."),
});

export const writeLimiter = rateLimit({
  ...common(),
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: userOrIp,
  handler: jsonHandler("Demasiadas solicitudes. Espera unos minutos."),
});

/** Cambios de perfil: más estricto que el límite general de escritura. */
export const profileLimiter = rateLimit({
  ...common(),
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: userOrIp,
  handler: jsonHandler("Demasiados cambios de perfil. Espera unos minutos."),
});

/** Pagos: evita fuerza bruta de referencias y creación masiva de intents. */
export const paymentLimiter = rateLimit({
  ...common(),
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyGenerator: userOrIp,
  handler: jsonHandler("Demasiados intentos de pago. Espera unos minutos."),
});

export const bookingRequestLimiter = rateLimit({
  ...common(),
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: userOrIp,
  handler: jsonHandler("Demasiadas solicitudes de reserva. Inténtalo más tarde."),
});

export const mapsLimiter = rateLimit({
  ...common(),
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => `maps:${ip(req)}`,
  handler: jsonHandler("Demasiadas solicitudes de mapas. Inténtalo más tarde."),
});

export const publicReadLimiter = rateLimit({
  ...common(),
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: (req) => `read:${ip(req)}`,
  handler: jsonHandler("Demasiadas solicitudes. Inténtalo más tarde."),
});
