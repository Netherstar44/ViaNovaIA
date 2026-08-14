import "dotenv/config";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

async function test() {
  const sql = neon(process.env.DATABASE_URL!);
  
  // Get a test user
  const users = await sql`SELECT username, password FROM users WHERE password LIKE '$2a$%' LIMIT 1`;
  if (users.length === 0) { console.log("No users found"); return; }
  
  const user = users[0];
  console.log(`Testing bcryptjs with $2a$ hash for user: ${user.username}`);
  console.log(`Hash: ${user.password.substring(0, 10)}...`);
  
  // bcryptjs should handle both $2a$ and $2b$ — verify
  const fakeCheck = await bcrypt.compare("wrong_password", user.password);
  console.log("Wrong password check:", fakeCheck); // should be false
  
  // Also test pgcrypto
  const pgTest = await sql`SELECT (crypt('wrong_password', ${user.password}) = ${user.password}) as match`;
  console.log("pgcrypto wrong password check:", pgTest[0].match); // should be false
  
  console.log("✅ Both systems work with $2a$ format");
}

test().catch(e => { console.error(e); process.exit(1); });
