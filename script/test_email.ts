import "dotenv/config";
import { sendWelcomeEmail } from "../server/mailer";

async function test() {
  await sendWelcomeEmail("vianovahackathon@gmail.com", "Test Logo");
  console.log("Email sent! Check inbox for logo.");
}

test().catch(e => { console.error(e); process.exit(1); });
