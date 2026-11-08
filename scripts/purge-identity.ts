import "dotenv/config";
import { purgeExpiredIdentities } from "../server/identity/retention.js";
// Run every five minutes on the compatible server; no automatic production migration.
await purgeExpiredIdentities();
console.info("Retención comprobada; sin datos personales en salida.");
