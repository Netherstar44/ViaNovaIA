/**
 * Refresh Token Rotation Service.
 *
 * Flujo:
 * 1. Login → genera access token (15min) + refresh token (30d)
 * 2. /api/auth/refresh → consume refresh token, genera nuevos par (rotation)
 * 3. Si un refresh token ya usado se reutiliza → revoca toda la familia (breach detected)
 */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getDb } from "../storage.js";
import { refreshTokens, users } from "../shared/schema.js";
import { eq, and, isNull, lt } from "drizzle-orm";

// Lazy JWT secret — must NOT be evaluated at module load time because ESM
// hoists imports before index.ts can call dotenv.config().  The first call
// to getJwtSecret() (which happens at request time) will read the env var
// that dotenv already populated.
let _cachedSecret: string | null = null;
export function getJwtSecret(): string {
  if (!_cachedSecret) {
    _cachedSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
    if (!process.env.JWT_SECRET) {
      console.warn("[refresh-tokens] JWT_SECRET env var not set – using ephemeral secret");
    }
  }
  return _cachedSecret;
}

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

/**
 * Hash a refresh token with SHA-256 for storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a short-lived access token (15 min).
 */
export function generateAccessToken(user: { id: string; username: string; role: string | null }): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate a refresh token (opaque random string) and store its SHA-256 hash.
 */
export async function createRefreshToken(
  userId: string,
  opts: { family?: string; userAgent?: string; ipAddress?: string } = {}
): Promise<{ rawToken: string; family: string }> {
  const db = getDb();
  const rawToken = crypto.randomBytes(48).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const family = opts.family || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    family,
    expiresAt,
    userAgent: opts.userAgent,
    ipAddress: opts.ipAddress,
  });

  return { rawToken, family };
}

/**
 * Rotate a refresh token: consume the old one, issue a new one.
 * If the old token was already revoked → theft detected → revoke entire family.
 *
 * Returns null if the token is invalid/expired/stolen.
 */
export async function rotateRefreshToken(
  rawToken: string,
  opts: { userAgent?: string; ipAddress?: string } = {}
): Promise<{
  accessToken: string;
  rawRefreshToken: string;
  user: { id: string; username: string; role: string | null };
} | null> {
  const db = getDb();
  const tokenHash = hashToken(rawToken);

  // Find the token
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));

  const existing = rows[0];
  if (!existing) return null; // Token not found

  // Check if already revoked → THEFT DETECTED
  if (existing.revokedAt) {
    // Revoke the entire family
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.family, existing.family), isNull(refreshTokens.revokedAt)));
    return null;
  }

  // Check expiry
  if (new Date() > new Date(existing.expiresAt)) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
    return null;
  }

  // Get user
  const userRows = await db.select().from(users).where(eq(users.id, existing.userId));
  const user = userRows[0];
  if (!user) return null;

  // Create new refresh token in the same family
  const { rawToken: newRawToken } = await createRefreshToken(user.id, {
    family: existing.family,
    userAgent: opts.userAgent,
    ipAddress: opts.ipAddress,
  });

  // Revoke the old token and point to the new one
  const newHash = hashToken(newRawToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), replacedByHash: newHash })
    .where(eq(refreshTokens.tokenHash, tokenHash));

  // Generate new access token
  const accessToken = generateAccessToken(user);

  return {
    accessToken,
    rawRefreshToken: newRawToken,
    user: { id: user.id, username: user.username, role: user.role },
  };
}

/**
 * Revoke all refresh tokens for a user (e.g. on logout-all, password change).
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/**
 * Revoke a specific token family (e.g. on single-device logout).
 */
export async function revokeTokenFamily(family: string): Promise<void> {
  const db = getDb();
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.family, family), isNull(refreshTokens.revokedAt)));
}

/**
 * Clean up expired tokens (run periodically or on startup).
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const db = getDb();
  const result = await db
    .delete(refreshTokens)
    .where(lt(refreshTokens.expiresAt, new Date()))
    .returning({ id: refreshTokens.id });
  return result.length;
}
