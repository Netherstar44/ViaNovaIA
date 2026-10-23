import cors, { type CorsOptions } from "cors";
import type { Express, NextFunction, Request, Response } from "express";
import { getAllowedOrigins, isOriginAllowed, isProduction } from "./config.js";

/**
 * CORS con allowlist explícita. Un origen desconocido no recibe cabeceras
 * ACAO, por lo que el navegador no puede leer la respuesta.
 */
export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true); // same-origin / clientes nativos
    return callback(null, isOriginAllowed(origin));
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "Stripe-Signature", "X-Client-Platform"],
  exposedHeaders: ["X-Request-Id", "RateLimit", "RateLimit-Policy", "Retry-After"],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

export function buildCsp(): string {
  const prod = isProduction();
  const scriptSrc = prod
    ? "script-src 'self' 'wasm-unsafe-eval'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https: wss: ws:",
    "worker-src 'self' blob:",
    "frame-src 'self' https:",
    "manifest-src 'self'",
  ].join("; ");
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self), microphone=(self), camera=(self), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", buildCsp());
  if (isProduction()) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

/** Aplica CORS, cabeceras y límites básicos a una app Express. */
export function applyHttpSecurity(app: Express) {
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cors(corsOptions));
  app.use(securityHeaders);
  app.use((req, res, next) => {
    // Limita el tamaño de cuerpos para evitar agotamiento de memoria.
    if (req.headers["content-length"] && Number(req.headers["content-length"]) > 2 * 1024 * 1024) {
      return res.status(413).json({ message: "Cuerpo de solicitud demasiado grande" });
    }
    return next();
  });
}

export function allowedOriginsForLog(): string[] {
  return getAllowedOrigins();
}
