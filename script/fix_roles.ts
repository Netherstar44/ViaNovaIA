import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

async function run() {
  const client = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client });
  await db.execute(sql`UPDATE users SET role_changed_at = NOW() WHERE role_changed_at IS NULL`);
  console.log("Done: all existing users marked with roleChangedAt");
}

run().catch((e) => { console.error(e); process.exit(1); });
