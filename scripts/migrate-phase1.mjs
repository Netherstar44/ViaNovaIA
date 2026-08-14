/**
 * Phase 1 migration script — run once via:
 *   node scripts/migrate-phase1.mjs
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("▶ Running Phase 1 migrations…");

  // 1. Add 'translator' to user_role enum safely
  await sql`
    DO $$ BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'translator';
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `;
  console.log("  ✓ user_role enum: translator added");

  // 2. Create persistent chat_messages table (isolated by userId)
  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id          varchar   PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     varchar   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role        text      NOT NULL CHECK (role IN ('user','assistant')),
      content     text      NOT NULL,
      image       text,
      created_at  timestamp DEFAULT now()
    );
  `;
  console.log("  ✓ chat_messages table created (or already exists)");

  // 3. Fast per-user index
  await sql`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id
      ON chat_messages(user_id, created_at DESC);
  `;
  console.log("  ✓ idx_chat_messages_user_id index created");

  console.log("\n✅ Phase 1 migration complete!");
}

run().catch((err) => { console.error("❌ Migration failed:", err); process.exit(1); });
