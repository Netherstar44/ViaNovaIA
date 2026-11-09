import type { Request, Response } from "express";
import { cookieOptions, isNativeAuthClient, sanitizeUser, signToken } from "./security.js";

/**
 * Emite la sesión igual para contraseña, 2FA y passkey: cookie HttpOnly en el
 * navegador y JWT solo para el cliente nativo. Nunca devuelve el hash ni datos
 * internos del usuario.
 */
export function issueSession(req: Request, res: Response, user: any) {
  const token = signToken(user);
  res.cookie("token", token, cookieOptions());
  res.set("Cache-Control", "no-store");
  const payload: Record<string, unknown> = { user: sanitizeUser(user) };
  if (isNativeAuthClient(req)) payload.token = token;
  return res.json(payload);
}

export function isLocalPasswordHash(value: unknown): boolean {
  return /^\$2[aby]\$/.test(String(value ?? ""));
}
