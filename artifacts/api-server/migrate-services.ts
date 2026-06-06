import { getDb } from "./src/storage.js";
import { sql } from "drizzle-orm";
import 'dotenv/config';

async function run() {
  const db = getDb();
  console.log("Running ALTER TABLE commands...");
  try {
    await db.execute(sql`
      ALTER TABLE services
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS price_range TEXT,
      ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
      ADD COLUMN IF NOT EXISTS payment_methods TEXT,
      ADD COLUMN IF NOT EXISTS food_categories JSONB,
      ADD COLUMN IF NOT EXISTS accepts_orders BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS room_service BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS room_service_schedule TEXT,
      ADD COLUMN IF NOT EXISTS hotel_menu_support BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS has_vr BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS has_ar BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS vr_type TEXT,
      ADD COLUMN IF NOT EXISTS vr_model_url TEXT,
      ADD COLUMN IF NOT EXISTS vr_interior_url TEXT,
      ADD COLUMN IF NOT EXISTS external_vr_url TEXT,
      ADD COLUMN IF NOT EXISTS menu_data JSONB,
      ADD COLUMN IF NOT EXISTS media_gallery JSONB,
      ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
    `);
    console.log("Success!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
