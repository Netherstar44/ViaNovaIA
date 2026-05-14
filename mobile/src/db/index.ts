import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { DB_URL } from "../lib/config";

const sql = neon(DB_URL);
export const db = drizzle({ client: sql });
