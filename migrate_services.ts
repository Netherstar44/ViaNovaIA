import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const connection = neon(url);
  const db = drizzle({ client: connection });

  try {
    console.log("Ejecutando migraciones SQL manuales...");
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE service_category AS ENUM ('hotel', 'restaurant', 'recreation', 'transport');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS services (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_username text NOT NULL,
        category service_category NOT NULL,
        name text NOT NULL,
        description text,
        image_url text,
        location_lat text,
        location_lng text,
        rating integer,
        created_at timestamp DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS comments (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        location_id text NOT NULL,
        author_username text NOT NULL,
        content text NOT NULL,
        rating integer,
        created_at timestamp DEFAULT now()
      );
    `);

    console.log("Migración completada con éxito.");
  } catch (err) {
    console.error("Error en migración:", err);
  }
}

run().then(() => process.exit(0));
