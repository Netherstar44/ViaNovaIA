import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  console.log("🔧 Running ViaNovaIA Multimedia System Migration (Clean)...\n");

  try {
    await client.query("BEGIN");

    // 1. Create asset_type enum safely
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_type') THEN 
          CREATE TYPE asset_type AS ENUM ('IMAGE', 'VIDEO', 'IMAGE_360', 'MODEL_3D', 'VR_TOUR'); 
        END IF; 
      END $$;
    `);
    console.log("✅ Enum asset_type ensured.");

    // 2. Drop existing media_assets table if any, to avoid partial/incorrect definitions
    await client.query(`DROP TABLE IF EXISTS media_assets CASCADE;`);
    console.log("✅ Dropped old media_assets table if existed.");

    // 3. Create media_assets table
    await client.query(`
      CREATE TABLE media_assets (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        owner_role text NOT NULL,
        entity_type text NOT NULL,
        entity_id varchar,
        title text,
        description text,
        asset_type asset_type NOT NULL,
        file_url text NOT NULL,
        thumbnail_url text,
        cloudinary_public_id text NOT NULL,
        mime_type text NOT NULL,
        file_size integer NOT NULL,
        width integer,
        height integer,
        duration integer,
        is_360 boolean NOT NULL DEFAULT false,
        is_vr boolean NOT NULL DEFAULT false,
        status text NOT NULL DEFAULT 'active',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    console.log("✅ Table media_assets created.");

    // 4. Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_media_assets_owner_id ON media_assets(owner_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_media_assets_entity ON media_assets(entity_type, entity_id);
    `);
    console.log("✅ Indexes for media_assets created.");

    await client.query("COMMIT");
    console.log("\n✅ Multimedia migration completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error during migration, rollback applied:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
