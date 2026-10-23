import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const SENSITIVE_KEYS = /^(password|token|authorization|verificationtoken|verification_token|details|email|phone|bankaccount|bank_account|newpassword|code|jti|authorization)$/i;

export function redactForLog(value: unknown, depth = 0): unknown {
  if (value == null || depth > 5) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactForLog(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.test(key)) {
        output[key] = "[REDACTED]";
      } else if (/token|secret|password|email|phone/i.test(key)) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = redactForLog(entry, depth + 1);
      }
    }
    return output;
  }
  if (typeof value === "string") {
    return value
      .replace(/([?&](?:token|reset_token|code|access_token)=)[^&\s]+/gi, "$1[REDACTED]")
      .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/g, "Bearer [REDACTED]")
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]")
      .replace(/\+?\d[\d\s()-]{7,}\d/g, "[PHONE]");
  }
  return value;
}

function write(level: "info" | "warn" | "error", payload: Record<string, unknown>) {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    ...payload,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Logging estructurado sin cuerpos de respuesta ni PII.
 * Solo método, ruta sin query, status, duración y request-id.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = String(req.headers["x-request-id"] || crypto.randomUUID());
  res.setHeader("X-Request-Id", requestId);
  (req as any).requestId = requestId;

  res.on("finish", () => {
    if (!req.path.startsWith("/api")) return;
    write("info", {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}

export function logSecurityEvent(event: string, details: Record<string, unknown> = {}) {
  write("warn", {
    event,
    ...redactForLog(details) as Record<string, unknown>,
  });
}

export function logServerError(error: any, requestId?: string) {
  write("error", {
    requestId,
    name: error?.name,
    message: redactForLog(error?.message || String(error)),
    stack: process.env.NODE_ENV === "production" ? undefined : redactForLog(error?.stack),
  });
}
