import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

async function migrate() {
  const client = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client });

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE users ADD COLUMN role_changed_at timestamp;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `);
  console.log("✅ role_changed_at column added");
}

migrate().catch((e) => { console.error(e); process.exit(1); });
