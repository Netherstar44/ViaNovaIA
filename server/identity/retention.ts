import { sql } from "drizzle-orm";
import { getDb } from "../storage.js";
import { identities } from "./routes.js";
export async function purgeExpiredIdentities(): Promise<void> {
  const result = await getDb().execute(sql`SELECT username FROM identity_verifications WHERE purge_after <= now() LIMIT 500`);
  for (const row of ((result as any).rows ?? result as any)) await identities.read(row.username);
}
