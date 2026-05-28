import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function run() {
  const sql = neon(process.env.DATABASE_URL!);
  
  // Get a real user's password hash to test
  const users = await sql`SELECT username, password FROM users LIMIT 3`;
  for (const u of users) {
    console.log(`User: ${u.username}, Hash prefix: ${u.password.substring(0, 7)}`);
  }
  
  // The existing hashes use $2a$ (bcryptjs) which pgcrypto's crypt() supports
  // $2b$ hashes might need conversion, but bcryptjs v2 uses $2a$ by default
}

run().catch(e => { console.error(e); process.exit(1); });
