import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = neon(url);

  console.log("Adding missing columns to users table if missing...");
  try {
    await sql`ALTER TABLE users ADD COLUMN name text;`;
  } catch (err: any) {}
  
  try {
    await sql`ALTER TABLE users ADD COLUMN avatar_url text;`;
    console.log("Added 'avatar_url' column.");
  } catch (err: any) {}

  try {
    await sql`ALTER TABLE users ADD COLUMN location_lat text;`;
    console.log("Added 'location_lat' column.");
  } catch (err: any) {}

  try {
    await sql`ALTER TABLE users ADD COLUMN location_lng text;`;
    console.log("Added 'location_lng' column.");
  } catch (err: any) {}

  console.log("Creating 'comments' table if missing...");
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS comments (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        location_id text NOT NULL,
        author_username text NOT NULL,
        content text NOT NULL,
        rating integer,
        created_at timestamp DEFAULT now()
      );
    `;
    console.log("Created 'comments' table.");
  } catch (err: any) {
    console.log("Error creating 'comments' table:", err.message);
  }

  console.log("Creating 'notifications' table if missing...");
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_username text NOT NULL,
        traveler_username text,
        type text NOT NULL,
        details text NOT NULL,
        is_read text DEFAULT 'false',
        created_at timestamp DEFAULT now()
      );
    `;
    console.log("Created 'notifications' table.");
  } catch (err: any) {
    console.log("Error creating 'notifications' table:", err.message);
  }

  console.log("Migration script finished successfully.");
}

main().catch(console.error);
