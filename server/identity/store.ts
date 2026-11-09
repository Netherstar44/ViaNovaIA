import { sql } from "drizzle-orm";
import { getDb } from "../storage.js";
import { seal, unseal } from "./crypto.js";
export type Challenge = { id: string; actions: string[]; step: number; expires: number; issued: number; baseline?: number[]; purpose: "enroll" | "verify" };
/** Reto separado del flujo oficial: nunca escribe validUntil, method ni approvedName. */
export type PilotChallenge = { id: string; actions: string[]; step: number; expires: number; issued: number; baseline?: number[]; purpose: "enroll" | "verify" };
/**
 * Reto de acceso facial. Es independiente del reto de verificación: nunca
 * escribe verifiedAt, validUntil ni method. Solo prueba que la persona que
 * intenta entrar coincide con la plantilla ya guardada en la cuenta.
 */
export type LoginChallenge = { id: string; actions: string[]; step: number; expires: number; issued: number; baseline?: number[] };
export type IdentityRecord = {
  revision: number; consentAt?: number; consentVersion?: string; revoked?: boolean;
  approvedName?: string; approvedBy?: string; documentRef?: string; manualRequested?: boolean;
  template?: number[]; model?: string; templateExpires?: number;
  verifiedAt?: number; validUntil?: number; method?: "face" | "manual";
  attempts?: number; lockedUntil?: number; challenge?: Challenge;
  loginChallenge?: LoginChallenge; loginAttempts?: number; loginLockedUntil?: number;
  pilotConsentAt?: number; pilotConsentVersion?: string;
  pilotTemplate?: number[]; pilotModel?: string; pilotTemplateExpires?: number;
  pilotChallenge?: PilotChallenge; pilotAttempts?: number; pilotLockedUntil?: number;
  pilotLastAt?: number; pilotLastDistance?: number; pilotLastQuality?: number;
};
export type IdentityAudit = { actor: string; subject: string; event: string; result: string; score?: number };
export interface IdentityStore {
  get(subject: string): Promise<IdentityRecord>;
  save(subject: string, record: IdentityRecord, audit: IdentityAudit): Promise<void>;
}
export const identityStore: IdentityStore = {
  async get(subject) {
    const result = await getDb().execute(sql`SELECT revision, sealed FROM identity_verifications WHERE username = ${subject}`);
    const row = ((result as any).rows ?? result as any)[0];
    return row ? { ...unseal<IdentityRecord>(row.sealed, subject), revision: Number(row.revision) } : { revision: 0 };
  },
  async save(subject, record, audit) {
    // One SQL statement: CAS state and audit are committed together. A raced
    // revocation cannot resurrect a template from an in-flight inference.
    const encrypted = seal({ ...record, revision: record.revision + 1 }, subject);
    // Any pending challenge carries a descriptor in memory. The row must not
    // outlive the last biometric deadline, including the facial-login reto.
    const deadlines = [record.templateExpires, record.challenge?.expires, record.loginChallenge?.expires]
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const purgeAfter = deadlines.length ? new Date(Math.min(...deadlines)) : null;
    const result = await getDb().execute(sql`
      WITH saved AS (
        INSERT INTO identity_verifications (username, revision, sealed, valid_until, method, template_expires, purge_after)
        SELECT ${subject}, 1, ${encrypted}, ${record.validUntil ? new Date(record.validUntil) : null}, ${record.method ?? null}, ${record.templateExpires ? new Date(record.templateExpires) : null}, ${purgeAfter}
        WHERE ${record.revision} = 0
        ON CONFLICT (username) DO UPDATE SET revision = identity_verifications.revision + 1,
          sealed = EXCLUDED.sealed, valid_until = EXCLUDED.valid_until, method = EXCLUDED.method, template_expires = EXCLUDED.template_expires, purge_after = EXCLUDED.purge_after
        WHERE identity_verifications.revision = ${record.revision}
        RETURNING username
      ), updated AS (
        UPDATE identity_verifications SET revision = revision + 1, sealed = ${encrypted},
          valid_until = ${record.validUntil ? new Date(record.validUntil) : null}, method = ${record.method ?? null},
          template_expires = ${record.templateExpires ? new Date(record.templateExpires) : null}
          , purge_after = ${purgeAfter}
        WHERE username = ${subject} AND revision = ${record.revision} AND ${record.revision} > 0
        RETURNING username
      )
      INSERT INTO identity_audit (actor, subject, event, result, score)
      SELECT ${audit.actor}, ${subject}, ${audit.event}, ${audit.result}, ${audit.score ?? null}
      WHERE EXISTS (SELECT 1 FROM saved UNION ALL SELECT 1 FROM updated) RETURNING id
    `);
    if (!((result as any).rows ?? result as any).length) throw Object.assign(new Error("La verificación cambió. Reintenta."), { status: 409 });
  },
};
