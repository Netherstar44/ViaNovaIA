/**
 * Migración de seguridad de ViaNova.
 *
 * Uso:
 *   node scripts/security-migration.mjs            # dry-run: solo imprime el plan
 *   node scripts/security-migration.mjs --apply    # aplica DDL + cifra datos legados
 *
 * Requisitos:
 *   DATABASE_URL                 conexión PostgreSQL (Neon o compatible)
 *   JWT_SECRET                   mínimo 32 caracteres
 *   PAYMENT_ENCRYPTION_KEY       recomendado; si falta se deriva de JWT_SECRET
 *
 * Antes de --apply: hacer backup y ejecutar en una ventana de mantenimiento.
 * El script nunca imprime valores de pago, cuentas bancarias ni secretos.
 */
import "dotenv/config";
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const KNOWN_FLAGS = new Set(["--apply"]);
for (const arg of process.argv.slice(2)) {
  if (!KNOWN_FLAGS.has(arg)) {
    console.error(`Argumento desconocido: ${arg}`);
    process.exit(2);
  }
}

const ddl = [
  // ── Enums ──────────────────────────────────────────────────────────────────
  `DO $$ BEGIN
     CREATE TYPE user_role AS ENUM ('traveler', 'hotel', 'restaurant', 'recreation', 'taxi', 'translator', 'admin');
   EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'translator'`,
  `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin'`,
  `ALTER TYPE service_category ADD VALUE IF NOT EXISTS 'translator'`,
  `DO $$ BEGIN
     CREATE TYPE ride_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');
   EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN
     CREATE TYPE withdrawal_status AS ENUM ('pending', 'completed', 'rejected');
   EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN
     CREATE TYPE payment_method_type AS ENUM ('cash', 'nequi', 'daviplata', 'card');
   EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN
     CREATE TYPE asset_type AS ENUM ('IMAGE', 'VIDEO', 'IMAGE_360', 'MODEL_3D', 'VR_TOUR');
   EXCEPTION WHEN duplicate_object THEN null; END $$`,

  // ── Columnas de seguridad y perfil en users ────────────────────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified text DEFAULT 'false'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_until timestamp`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences jsonb`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled text DEFAULT 'false'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_attempts integer DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider text DEFAULT 'local'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_plan text DEFAULT 'free'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamp`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_type text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS plate text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS taxi_lat text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS taxi_lng text`,

  // ── Auth y roles ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     token text NOT NULL UNIQUE,
     expires_at timestamp NOT NULL,
     created_at timestamp DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS revoked_tokens (
     jti varchar PRIMARY KEY,
     expires_at timestamp NOT NULL,
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS revoked_tokens_expires_at_idx ON revoked_tokens (expires_at)`,
  `CREATE TABLE IF NOT EXISTS user_roles (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role user_role NOT NULL,
     business_name text,
     business_address text,
     business_phone text,
     vehicle_type text,
     plate text,
     phone text,
     created_at timestamp DEFAULT now(),
     UNIQUE(user_id, role)
   )`,
  `INSERT INTO user_roles (user_id, role)
   SELECT u.id, u.role FROM users u
   WHERE u.role IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = u.role)`,
  `INSERT INTO user_roles (user_id, role)
   SELECT u.id, 'traveler'::user_role FROM users u
   WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'traveler'::user_role)`,

  // ── Disponibilidad y reservas ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS availability_slots (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     service_id varchar NOT NULL REFERENCES services(id) ON DELETE CASCADE,
     provider_username text NOT NULL,
     slot_type text NOT NULL,
     start_time timestamp NOT NULL,
     end_time timestamp NOT NULL,
     capacity integer NOT NULL,
     booked integer DEFAULT 0,
     price integer,
     status text DEFAULT 'available',
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS availability_slots_service_start_idx
     ON availability_slots (service_id, start_time)`,
  `CREATE INDEX IF NOT EXISTS availability_slots_provider_idx
     ON availability_slots (provider_username, start_time)`,
  `CREATE TABLE IF NOT EXISTS bookings (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     slot_id varchar NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
     traveler_username text NOT NULL,
     provider_username text NOT NULL,
     units integer NOT NULL DEFAULT 1,
     total_price integer NOT NULL,
     status text DEFAULT 'pending',
     locked_until timestamp,
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS bookings_slot_status_idx ON bookings (slot_id, status)`,
  `CREATE INDEX IF NOT EXISTS bookings_traveler_idx ON bookings (traveler_username, created_at DESC)`,

  // ── Productos, multimedia y pedidos ────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS products (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     provider_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     provider_username text NOT NULL,
     role_category text NOT NULL,
     name text NOT NULL,
     description text,
     price numeric(12,2) NOT NULL DEFAULT 0,
     cost numeric(12,2) NOT NULL DEFAULT 0,
     currency text NOT NULL DEFAULT 'COP',
     stock integer NOT NULL DEFAULT -1,
     is_active boolean NOT NULL DEFAULT true,
     cover_image text,
     created_at timestamp DEFAULT now(),
     updated_at timestamp DEFAULT now()
   )`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS cost numeric(12,2) NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS products_active_created_idx ON products (is_active, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS products_provider_idx ON products (provider_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS media_assets (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     owner_role text,
     entity_id varchar NOT NULL,
     entity_type text NOT NULL,
     title text,
     asset_type asset_type NOT NULL DEFAULT 'IMAGE',
     file_url text NOT NULL,
     cloudinary_public_id text,
     mime_type text,
     file_size integer NOT NULL DEFAULT 0,
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_media_assets_entity
     ON media_assets (entity_type, entity_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS orders (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     buyer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     product_id varchar NOT NULL REFERENCES products(id) ON DELETE CASCADE,
     quantity integer NOT NULL DEFAULT 1,
     unit_price numeric(12,2) NOT NULL,
     total numeric(12,2) NOT NULL,
     status text NOT NULL DEFAULT 'pending',
     payment_intent text,
     notes text,
     created_at timestamp DEFAULT now(),
     updated_at timestamp DEFAULT now()
   )`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_intent text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS orders_buyer_idempotency_idx
     ON orders (buyer_id, idempotency_key) WHERE idempotency_key IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_orders_product_created ON orders (product_id, created_at DESC)`,

  // ── Reseñas, pagos y notificaciones ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS reviews (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     ride_id varchar NOT NULL,
     author_username text NOT NULL,
     target_username text NOT NULL,
     rating integer NOT NULL,
     comment text,
     author_role text NOT NULL,
     created_at timestamp DEFAULT now(),
     UNIQUE(ride_id, author_username)
   )`,
  `CREATE INDEX IF NOT EXISTS reviews_target_idx ON reviews (target_username, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS payment_methods (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     username text NOT NULL,
     type payment_method_type NOT NULL,
     label text NOT NULL,
     details text,
     is_default text DEFAULT 'false',
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS payment_methods_username_idx ON payment_methods (username, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS notifications (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     provider_username text NOT NULL,
     traveler_username text,
     type text NOT NULL,
     details text NOT NULL,
     is_read text DEFAULT 'false',
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS notifications_owner_idx
     ON notifications (provider_username, traveler_username, created_at DESC)`,

  // ── Taxi ───────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS rides (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     traveler_username text NOT NULL,
     taxi_username text,
     origin_lat text NOT NULL,
     origin_lng text NOT NULL,
     origin_address text,
     destination_lat text NOT NULL,
     destination_lng text NOT NULL,
     destination_address text NOT NULL,
     fare real NOT NULL,
     distance_km real,
     status ride_status NOT NULL DEFAULT 'pending',
     started_at timestamp,
     completed_at timestamp,
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS rides_traveler_idx ON rides (traveler_username, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rides_taxi_status_idx ON rides (taxi_username, status, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS earnings (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     taxi_username text NOT NULL,
     ride_id varchar NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
     amount real NOT NULL,
     created_at timestamp DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS earnings_ride_id_idx ON earnings (ride_id)`,
  `CREATE INDEX IF NOT EXISTS earnings_taxi_idx ON earnings (taxi_username, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS withdrawals (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     taxi_username text NOT NULL,
     amount real NOT NULL,
     status withdrawal_status NOT NULL DEFAULT 'pending',
     bank_account text,
     notes text,
     idempotency_key text,
     created_at timestamp DEFAULT now(),
     updated_at timestamp DEFAULT now()
   )`,
  `ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS idempotency_key text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_idempotency_key_idx
     ON withdrawals (idempotency_key) WHERE idempotency_key IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS withdrawals_taxi_idx ON withdrawals (taxi_username, created_at DESC)`,

  // ── Red social ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS social_posts (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     username text NOT NULL,
     caption text,
     media_url text,
     media_type text,
     likes_count integer NOT NULL DEFAULT 0,
     comments_count integer NOT NULL DEFAULT 0,
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_social_posts_username ON social_posts (username, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS social_likes (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     post_id varchar NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at timestamp DEFAULT now(),
     UNIQUE(post_id, user_id)
   )`,
  `CREATE TABLE IF NOT EXISTS social_comments (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     post_id varchar NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     username text NOT NULL,
     content text NOT NULL,
     created_at timestamp DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS social_followers (
     follower_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     following_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at timestamp DEFAULT now(),
     PRIMARY KEY (follower_id, following_id)
   )`,
  `CREATE TABLE IF NOT EXISTS social_blocks (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     blocker_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     blocked_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at timestamp DEFAULT now(),
     UNIQUE(blocker_id, blocked_id)
   )`,
  `CREATE TABLE IF NOT EXISTS social_reports (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     reporter_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     reported_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     reason text NOT NULL,
     details text,
     status text NOT NULL DEFAULT 'pending',
     created_at timestamp DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS social_messages (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     sender_username text NOT NULL,
     recipient_username text NOT NULL,
     content text NOT NULL,
     is_read text NOT NULL DEFAULT 'false',
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_social_messages_pair
     ON social_messages (sender_username, recipient_username, created_at DESC)`,
];

function paymentKey() {
  const secret =
    process.env.PAYMENT_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "";
  if (secret.length < 32) {
    throw new Error("PAYMENT_ENCRYPTION_KEY o JWT_SECRET debe tener al menos 32 caracteres");
  }
  return crypto.createHash("sha256").update(`vianova-payment:${secret}`).digest();
}

/** Mismo formato que server/security.ts (AES-256-GCM, base64url). */
function encryptSensitive(plaintext) {
  const value = String(plaintext ?? "").trim();
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", paymentKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function printPlan() {
  console.log("ViaNova security migration — DRY RUN");
  console.log(`Sentencias DDL: ${ddl.length}`);
  for (const [index, statement] of ddl.entries()) {
    const firstLine = statement.trim().split("\n")[0];
    console.log(`  ${String(index + 1).padStart(2, "0")}. ${firstLine}`);
  }
  console.log("\nDatos legados:");
  console.log("  - payment_methods.details: cifrar filas que no empiecen por enc:v1:");
  console.log("  - withdrawals.bank_account: cifrar filas que no empiecen por enc:v1:");
  console.log("\nNo se ha conectado a la base de datos. Ejecuta con --apply para aplicar.");
  console.log("Haz un backup antes y usa una ventana de mantenimiento.");
}

async function applyMigration(sql) {
  const tables = await sql`SELECT to_regclass('public.users') AS users, to_regclass('public.services') AS services`;
  if (!tables[0]?.users || !tables[0]?.services) {
    throw new Error("Faltan las tablas base users/services. Ejecuta primero el esquema base (drizzle push).");
  }

  console.log(`Aplicando ${ddl.length} sentencias DDL...`);
  for (const [index, statement] of ddl.entries()) {
    try {
      await sql(statement);
    } catch (error) {
      throw new Error(`Falló la sentencia ${index + 1}: ${statement.trim().split("\n")[0]}\n${error.message}`);
    }
  }
  console.log("DDL aplicado.");

  const legacyPayments = await sql`
    SELECT id, details FROM payment_methods
    WHERE details IS NOT NULL AND details <> '' AND details NOT LIKE 'enc:v1:%'
  `;
  const legacyWithdrawals = await sql`
    SELECT id, bank_account FROM withdrawals
    WHERE bank_account IS NOT NULL AND bank_account <> '' AND bank_account NOT LIKE 'enc:v1:%'
  `;
  console.log(`Cifrando ${legacyPayments.length} método(s) de pago y ${legacyWithdrawals.length} cuenta(s) bancaria(s)...`);

  for (const row of legacyPayments) {
    const encrypted = encryptSensitive(row.details);
    if (encrypted) await sql`UPDATE payment_methods SET details = ${encrypted} WHERE id = ${row.id}`;
  }
  for (const row of legacyWithdrawals) {
    const encrypted = encryptSensitive(row.bank_account);
    if (encrypted) await sql`UPDATE withdrawals SET bank_account = ${encrypted}, updated_at = now() WHERE id = ${row.id}`;
  }

  const pendingPayments = await sql`
    SELECT COUNT(*)::int AS count FROM payment_methods
    WHERE details IS NOT NULL AND details <> '' AND details NOT LIKE 'enc:v1:%'
  `;
  const pendingWithdrawals = await sql`
    SELECT COUNT(*)::int AS count FROM withdrawals
    WHERE bank_account IS NOT NULL AND bank_account <> '' AND bank_account NOT LIKE 'enc:v1:%'
  `;
  const remaining = Number(pendingPayments[0]?.count || 0) + Number(pendingWithdrawals[0]?.count || 0);
  if (remaining > 0) throw new Error(`Quedaron ${remaining} datos legados sin cifrar. Revisa los errores.`);
  console.log("Datos legados cifrados y verificados.");
}

async function main() {
  if (!APPLY) {
    printPlan();
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida");
  const sql = neon(url);
  await applyMigration(sql);
  console.log("Migración de seguridad completada.");
}

main().catch((error) => {
  console.error(`Migración abortada: ${error.message}`);
  process.exitCode = 1;
});
