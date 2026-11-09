import type { NextFunction, Request, Response } from "express";
import { consumeReauthToken, type ReauthPurpose } from "./service.js";

/**
 * Exige un token de reautenticación recién emitido para ESTA operación.
 * El token se consume en el servidor: un booleano o un token de otra operación
 * del frontend nunca autoriza el cambio.
 */
export function requireReauth(purpose: ReauthPurpose) {
  return async (req: any, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "No autenticado" });
    try {
      const ok = await consumeReauthToken(req.user.id, purpose, (req as any).body?.reauthToken);
      if (!ok) {
        return res.status(403).json({
          message: "Confirma de nuevo tu identidad para continuar con este cambio.",
          code: "REAUTH_REQUIRED",
          purpose,
        });
      }
      return next();
    } catch (error: any) {
      console.error("[passkeys] no se pudo comprobar la reautenticación:", error?.message || error);
      return res.status(503).json({ message: "No se pudo comprobar la confirmación. Reintenta." });
    }
  };
}

export type ReauthRequest = Request & { user?: { id?: string } };
