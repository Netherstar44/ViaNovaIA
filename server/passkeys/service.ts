import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getAllowedOrigins, getAppBaseUrl } from "../config.js";
import { getDb } from "../storage.js";

export const REAUTH_PURPOSES = [
  "passkey-register",
  "passkey-remove",
  "password-change",
  "recovery-email",
  "two-factor",
] as const;

export type ReauthPurpose = (typeof REAUTH_PURPOSES)[number];

export function isReauthPurpose(value: unknown): value is ReauthPurpose {
  return typeof value === "string" && (REAUTH_PURPOSES as readonly string[]).includes(value);
}

/** Confirmación válida durante 5 minutos y para una sola operación. */
export const REAUTH_TTL_MS = 5 * 60_000;
/** El reto WebAuthn caduca aunque el usuario abandone el diálogo. */
export const CHALLENGE_TTL_MS = 5 * 60_000;
export const MAX_PASSKEYS_PER_USER = 10;

type Row = Record<string, any>;

function rows(result: any): Row[] {
  const value = (result as any)?.rows ?? result;
  return Array.isArray(value) ? value : [];
}

export type WebAuthnConfig = {
  rpName: string;
  rpID: string;
  /** Orígenes exactos aceptados; nunca se deriva del Host de la petición. */
  expectedOrigin: string[];
};

export function getWebAuthnConfig(): WebAuthnConfig {
  const base = getAppBaseUrl();
  let host = "localhost";
  try {
    host = new URL(base).hostname.toLowerCase();
  } catch {
    host = "localhost";
  }
  const configuredRp = String(process.env.WEBAUTHN_RP_ID || "").trim().toLowerCase();
  const origins = new Set<string>([base]);
  for (const origin of getAllowedOrigins()) {
    if (origin.startsWith("https://") || origin.startsWith("http://")) origins.add(origin);
  }
  return {
    rpName: "VIANova IA",
    rpID: configuredRp || host,
    expectedOrigin: Array.from(origins),
  };
}

export type StoredPasskey = {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: string | null;
  backedUp: boolean;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export type PublicPasskey = {
  id: string;
  label: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

/** La clave pública y el contador jamás salen del servidor. */
export function toPublicPasskey(row: StoredPasskey): PublicPasskey {
  return {
    id: row.id,
    label: row.label,
    deviceType: row.deviceType,
    backedUp: row.backedUp,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  };
}

function normalizePasskey(row: Row): StoredPasskey {
  let transports: string[] = [];
  try {
    const parsed = JSON.parse(String(row.transports || "[]"));
    if (Array.isArray(parsed)) transports = parsed.filter((value) => typeof value === "string");
  } catch {
    transports = [];
  }
  return {
    id: String(row.id),
    userId: String(row.userId),
    credentialId: String(row.credentialId),
    publicKey: String(row.publicKey),
    counter: Number(row.counter) || 0,
    transports,
    deviceType: row.deviceType ? String(row.deviceType) : null,
    backedUp: row.backedUp === true || row.backedUp === "true",
    label: row.label ? String(row.label) : null,
    createdAt: String(row.createdAt),
    lastUsedAt: row.lastUsedAt ? String(row.lastUsedAt) : null,
  };
}

const PASSKEY_COLUMNS = sql`id, user_id AS "userId", credential_id AS "credentialId", public_key AS "publicKey",
  counter, transports, device_type AS "deviceType", backed_up AS "backedUp",
  label, created_at AS "createdAt", last_used_at AS "lastUsedAt"`;

export async function listPasskeys(userId: string): Promise<StoredPasskey[]> {
  const result = await getDb().execute(sql`
    SELECT ${PASSKEY_COLUMNS} FROM user_passkeys WHERE user_id = ${userId} ORDER BY created_at ASC
  `);
  return rows(result).map(normalizePasskey);
}

export async function findPasskeyByCredentialId(credentialId: string): Promise<StoredPasskey | undefined> {
  const result = await getDb().execute(sql`
    SELECT ${PASSKEY_COLUMNS} FROM user_passkeys WHERE credential_id = ${credentialId} LIMIT 1
  `);
  const row = rows(result)[0];
  return row ? normalizePasskey(row) : undefined;
}

export async function insertPasskey(input: {
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: string | null;
  backedUp: boolean;
  label: string | null;
}): Promise<string> {
  const result = await getDb().execute(sql`
    INSERT INTO user_passkeys
      (user_id, credential_id, public_key, counter, transports, device_type, backed_up, label)
    VALUES (
      ${input.userId}, ${input.credentialId}, ${input.publicKey}, ${input.counter},
      ${JSON.stringify(input.transports)}, ${input.deviceType}, ${input.backedUp}, ${input.label}
    )
    RETURNING id
  `);
  return String(rows(result)[0]?.id ?? "");
}

export async function touchPasskey(id: string, counter: number): Promise<void> {
  await getDb().execute(sql`
    UPDATE user_passkeys SET counter = ${counter}, last_used_at = now() WHERE id = ${id}
  `);
}

export async function removePasskey(userId: string, id: string): Promise<boolean> {
  const result = await getDb().execute(sql`
    DELETE FROM user_passkeys WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `);
  return rows(result).length > 0;
}

export async function countPasskeys(userId: string): Promise<number> {
  const result = await getDb().execute(sql`
    SELECT count(*)::int AS total FROM user_passkeys WHERE user_id = ${userId}
  `);
  return Number(rows(result)[0]?.total) || 0;
}

export type ChallengeKind = "registration" | "authentication" | "reauth";

export async function saveChallenge(input: {
  userId: string | null;
  kind: ChallengeKind;
  challenge: string;
  purpose?: string | null;
}): Promise<string> {
  const id = randomUUID();
  await getDb().execute(sql`
    INSERT INTO webauthn_challenges (id, user_id, kind, challenge, purpose, expires_at)
    VALUES (${id}, ${input.userId}, ${input.kind}, ${input.challenge}, ${input.purpose ?? null}, ${new Date(Date.now() + CHALLENGE_TTL_MS)})
  `);
  return id;
}

/**
 * Consume el reto con un único DELETE ... RETURNING. Si falla la verificación,
 * el reto ya no existe: no se puede reintentar ni reutilizar.
 */
export async function takeChallenge(id: string, kind: ChallengeKind): Promise<{
  challenge: string;
  userId: string | null;
  purpose: string | null;
} | undefined> {
  const result = await getDb().execute(sql`
    DELETE FROM webauthn_challenges
    WHERE id = ${id} AND kind = ${kind} AND expires_at > now()
    RETURNING challenge, user_id AS "userId", purpose
  `);
  const row = rows(result)[0];
  if (!row) return undefined;
  return {
    challenge: String(row.challenge),
    userId: row.userId ? String(row.userId) : null,
    purpose: row.purpose ? String(row.purpose) : null,
  };
}

export function hashReauthToken(token: string): string {
  return createHash("sha256").update(String(token)).digest("hex");
}

export async function issueReauthToken(userId: string, purpose: ReauthPurpose): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await getDb().execute(sql`
    INSERT INTO reauth_tokens (token_hash, user_id, purpose, expires_at)
    VALUES (${hashReauthToken(token)}, ${userId}, ${purpose}, ${new Date(Date.now() + REAUTH_TTL_MS)})
  `);
  return token;
}

/** Un token sirve una sola vez y solo para la operación con la que se emitió. */
export async function consumeReauthToken(
  userId: string,
  purpose: ReauthPurpose,
  token: unknown,
): Promise<boolean> {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return false;
  const result = await getDb().execute(sql`
    UPDATE reauth_tokens SET used_at = now()
    WHERE token_hash = ${hashReauthToken(token)}
      AND user_id = ${userId}
      AND purpose = ${purpose}
      AND used_at IS NULL
      AND expires_at > now()
    RETURNING token_hash
  `);
  return rows(result).length > 0;
}
