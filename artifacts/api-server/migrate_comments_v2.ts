/**
 * migrate_comments_v2.ts
 * Migración segura para corregir el módulo de comentarios de restaurante.
 * - Sincroniza el schema Drizzle con la BD real.
 * - Agrega columnas faltantes para edición (10 min window), respuestas anidadas y analytics de vistas.
 * Usa ADD COLUMN IF NOT EXISTS → 100% seguro en re-ejecuciones.
 */
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  console.log("🔧 Running ViaNovaIA Comments v2 Migration...\n");

  try {
    await client.query("BEGIN");

    // ── 1. Asegurar columnas ya existentes en DB pero no en schema ─────────
    await client.query(`
      ALTER TABLE comments
        ADD COLUMN IF NOT EXISTS reply_content text,
        ADD COLUMN IF NOT EXISTS reply_created_at timestamp,
        ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false;
    `);
    console.log("✅ Columnas reply_content, reply_created_at, hidden aseguradas.");

    // ── 2. Nuevas columnas para edición temporal (10 min) ──────────────────
    await client.query(`
      ALTER TABLE comments
        ADD COLUMN IF NOT EXISTS updated_at timestamp;
    `);
    console.log("✅ Columna updated_at agregada.");

    // ── 3. Soporte para respuestas anidadas de usuarios (no solo restaurante) ─
    await client.query(`
      ALTER TABLE comments
        ADD COLUMN IF NOT EXISTS parent_comment_id varchar REFERENCES comments(id) ON DELETE CASCADE;
    `);
    console.log("✅ Columna parent_comment_id agregada (respuestas anidadas).");

    // ── 4. Tabla service_views para analytics reales ───────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_views (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id varchar NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        viewer_username text,
        view_type text NOT NULL DEFAULT 'profile',
        created_at timestamp DEFAULT now()
      );
    `);
    console.log("✅ Tabla service_views asegurada (analytics reales).");

    // ── 5. Índices para performance ────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_location_id ON comments(location_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id ON comments(parent_comment_id);
    `);
    // Only create service_views index if column exists
    const svCols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'service_views';
    `);
    const svColNames = svCols.rows.map((r: any) => r.column_name);
    console.log("service_views columns:", svColNames);
    if (svColNames.includes("created_at")) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_service_views_created_at ON service_views(created_at);
      `);
    }
    if (svColNames.includes("service_id")) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_service_views_service_id ON service_views(service_id);
      `);
    }
    console.log("✅ Índices creados.");


    await client.query("COMMIT");
    console.log("\n✅ Migración completada exitosamente.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error en migración, rollback aplicado:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
