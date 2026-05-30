import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const connection = neon(url);
  const db = drizzle({ client: connection });

  console.log("Agregando columnas faltantes a la tabla users...");

  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS city text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences jsonb`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_until timestamp`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS identification_number text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_location boolean DEFAULT false`);

  console.log("Columnas agregadas correctamente.");
}

run().then(() => process.exit(0)).catch(console.error);