/**
 * Phase 6 migration — social relationships, DMs, profile and security fields.
 * Run: node scripts/migrate-phase6.mjs
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("▶ Running Phase 6 (social + security) migrations…");

  await sql`
    CREATE TABLE IF NOT EXISTS social_blocks (
      id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      blocker_id  varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id  varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  timestamp DEFAULT now(),
      UNIQUE(blocker_id, blocked_id)
    );
  `;
  console.log("  ✓ social_blocks table");

  await sql`
    CREATE TABLE IF NOT EXISTS social_reports (
      id           varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id  varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reported_id  varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason       text NOT NULL,
      details      text,
      status       text NOT NULL DEFAULT 'pending',
      created_at   timestamp DEFAULT now()
    );
  `;
  console.log("  ✓ social_reports table");

  await sql`
    CREATE TABLE IF NOT EXISTS social_messages (
      id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_username    text NOT NULL,
      recipient_username text NOT NULL,
      content            text NOT NULL,
      is_read            text NOT NULL DEFAULT 'false',
      created_at         timestamp DEFAULT now()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_messages_pair
    ON social_messages(sender_username, recipient_username, created_at DESC);
  `;
  console.log("  ✓ social_messages table");

  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bio text,
      ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp,
      ADD COLUMN IF NOT EXISTS two_factor_enabled text DEFAULT 'false',
      ADD COLUMN IF NOT EXISTS premium_plan text DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS deleted_at timestamp;
  `;
  console.log("  ✓ users profile/security columns");

  console.log("\n✅ Phase 6 migration complete!");
}

run().catch((err) => { console.error("❌ Migration failed:", err); process.exit(1); });
