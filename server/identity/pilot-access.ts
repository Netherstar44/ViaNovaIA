import { sql } from "drizzle-orm";
import { getDb } from "../storage.js";

export type PilotInvite = {
  username: string;
  invitedBy: string;
  note: string | null;
  createdAt: string;
};

type Row = Record<string, any>;

function rows(result: any): Row[] {
  const value = (result as any)?.rows ?? result;
  return Array.isArray(value) ? value : [];
}

function toInvite(row: Row): PilotInvite {
  return {
    username: String(row.username),
    invitedBy: String(row.invitedBy ?? ""),
    note: row.note ? String(row.note) : null,
    createdAt: String(row.createdAt ?? ""),
  };
}

/** Sin base de datos o sin tabla, la respuesta segura es "sin acceso". */
export async function getPilotInvite(username: string): Promise<PilotInvite | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const result = await getDb().execute(sql`
      SELECT username, invited_by AS "invitedBy", note, created_at AS "createdAt"
      FROM identity_pilot_access
      WHERE username = ${username} AND revoked_at IS NULL
      LIMIT 1
    `);
    const row = rows(result)[0];
    return row ? toInvite(row) : null;
  } catch (error: any) {
    console.error("[identity] no se pudo consultar la allowlist del piloto:", error?.message || error);
    return null;
  }
}

export async function listPilotInvites(): Promise<PilotInvite[]> {
  const result = await getDb().execute(sql`
    SELECT username, invited_by AS "invitedBy", note, created_at AS "createdAt"
    FROM identity_pilot_access
    WHERE revoked_at IS NULL
    ORDER BY created_at DESC
    LIMIT 200
  `);
  return rows(result).map(toInvite);
}

export async function invitePilot(username: string, actor: string, note: string | null): Promise<void> {
  await getDb().execute(sql`
    INSERT INTO identity_pilot_access (username, invited_by, note)
    VALUES (${username}, ${actor}, ${note})
    ON CONFLICT (username) DO UPDATE
      SET invited_by = EXCLUDED.invited_by, note = EXCLUDED.note, revoked_at = NULL, created_at = now()
  `);
}

export async function revokePilotInvite(username: string): Promise<boolean> {
  const result = await getDb().execute(sql`
    UPDATE identity_pilot_access SET revoked_at = now()
    WHERE username = ${username} AND revoked_at IS NULL
    RETURNING username
  `);
  return rows(result).length > 0;
}

export const pilotAccess = {
  get: getPilotInvite,
  list: listPilotInvites,
  invite: invitePilot,
  revoke: revokePilotInvite,
};
