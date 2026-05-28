import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Starting manual migration for Phase 5 (Admin & Security)...");

  try {
    console.log("1. Adding 'admin' to user_role enum...");
    await sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin'`;
    console.log("✅ Enum updated.");
  } catch (err: any) {
    console.warn("⚠️ Note: 'admin' might already exist in enum.", err.message);
  }

  try {
    console.log("2. Adding security fields to users table...");
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified TEXT DEFAULT 'false'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_until TIMESTAMP`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB`;
    console.log("✅ Security fields added.");
  } catch (err: any) {
    console.error("❌ Error adding fields:", err.message);
  }

  console.log("Migration finished.");
  process.exit(0);
}

migrate();
