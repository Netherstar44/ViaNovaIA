import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function run() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  console.log("pgcrypto extension enabled");
  
  // Test that crypt works
  const test = await sql`SELECT crypt('test123', gen_salt('bf', 12)) as hash`;
  console.log("Test hash:", test[0].hash);
  
  // Verify it can compare
  const verify = await sql`SELECT (crypt('test123', ${test[0].hash}) = ${test[0].hash}) as match`;
  console.log("Verify:", verify[0].match);
}

run().catch(e => { console.error(e); process.exit(1); });
