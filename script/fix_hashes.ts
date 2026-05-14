import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function run() {
  const sql = neon(process.env.DATABASE_URL!);
  
  // Convert $2b$ to $2a$ — they are identical algorithms, just different version markers
  // pgcrypto's crypt() only recognizes $2a$
  const result = await sql`
    UPDATE users 
    SET password = '$2a$' || substring(password from 5) 
    WHERE password LIKE '$2b$%'
  `;
  
  console.log("Converted $2b$ hashes to $2a$ format");
  
  // Verify
  const users = await sql`SELECT username, substring(password, 1, 7) as prefix FROM users WHERE password LIKE '$2%'`;
  for (const u of users) {
    console.log(`  ${u.username}: ${u.prefix}`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
