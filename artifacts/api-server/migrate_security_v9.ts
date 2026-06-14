/**
 * Migración de seguridad v9.0
 * Ejecutar: npx tsx migrate_security_v9.ts
 *
 * Crea las tablas y columnas necesarias para:
 * - Refresh Token Rotation
 * - 2FA TOTP
 * - Auditoría de acciones
 * - E2EE Key Pairs (preparación)
 */
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
import pg from "pg";

const { Pool } = pg;

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── 1. Campos 2FA en users ──────────────────────────────────────────
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS totp_secret TEXT,
        ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;
    `);
    console.log("✅ users: campos 2FA agregados");

    // ── 2. Tabla refresh_tokens ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        family TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        replaced_by_hash TEXT,
        user_agent TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family);
    `);
    console.log("✅ refresh_tokens: tabla creada");

    // ── 3. Tabla action_logs ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS action_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        username TEXT,
        action TEXT NOT NULL,
        details JSONB,
        ip_address TEXT,
        user_agent TEXT,
        status TEXT DEFAULT 'success',
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_action_logs_user ON action_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_action_logs_action ON action_logs(action);
      CREATE INDEX IF NOT EXISTS idx_action_logs_created ON action_logs(created_at);
    `);
    console.log("✅ action_logs: tabla creada");

    // ── 4. Tabla user_key_pairs (E2EE preparación) ───────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_key_pairs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        public_key TEXT NOT NULL,
        encrypted_private_key TEXT NOT NULL,
        algorithm TEXT DEFAULT 'X25519',
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP
      );
    `);
    console.log("✅ user_key_pairs: tabla creada");

    await client.query("COMMIT");
    console.log("\n🎉 Migración de seguridad v9.0 completada exitosamente.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error en migración:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
