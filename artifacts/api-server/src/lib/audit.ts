/**
 * Servicio de auditoría — registra acciones de usuarios en action_logs.
 */
import { getDb } from "../storage.js";
import { actionLogs, type InsertActionLog } from "../shared/schema.js";
import { desc, eq } from "drizzle-orm";
import type { Request } from "express";

export type AuditAction =
  | "login"
  | "login_failed"
  | "logout"
  | "register"
  | "password_reset_request"
  | "password_reset_complete"
  | "password_change"
  | "profile_update"
  | "role_change"
  | "2fa_enable"
  | "2fa_disable"
  | "account_delete"
  | "token_refresh"
  | "token_revoke";

/**
 * Extrae IP y User-Agent de un request Express.
 */
function extractRequestMeta(req?: Request) {
  if (!req) return { ipAddress: undefined, userAgent: undefined };
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    undefined;
  const ua = req.headers["user-agent"] || undefined;
  return { ipAddress: ip, userAgent: ua };
}

/**
 * Registra una acción en la tabla action_logs.
 */
export async function logAction(
  action: AuditAction,
  opts: {
    userId?: string;
    username?: string;
    details?: Record<string, any>;
    status?: "success" | "failure";
    req?: Request;
  } = {}
): Promise<void> {
  try {
    const db = getDb();
    const { ipAddress, userAgent } = extractRequestMeta(opts.req);
    await db.insert(actionLogs).values({
      userId: opts.userId,
      username: opts.username,
      action,
      details: opts.details as any,
      ipAddress,
      userAgent,
      status: opts.status || "success",
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error("[AUDIT] Failed to log action:", err);
  }
}

/**
 * Obtiene los últimos N logs de un usuario.
 */
export async function getUserAuditLogs(userId: string, limit = 50) {
  const db = getDb();
  return db
    .select()
    .from(actionLogs)
    .where(eq(actionLogs.userId, userId))
    .orderBy(desc(actionLogs.createdAt))
    .limit(limit);
}
