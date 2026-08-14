/**
 * Phase 2 migration — e-commerce + multimedia assets tables
 * Run: node scripts/migrate-phase2.mjs
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("▶ Running Phase 2 (E-Commerce) migrations…");

  // Product offerings — one per provider, can have many
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id              varchar   PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id     varchar   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_username text    NOT NULL,
      role_category   text      NOT NULL,           -- hotel | restaurant | recreation | taxi | translator
      name            text      NOT NULL,
      description     text,
      price           numeric(12,2) NOT NULL DEFAULT 0,
      currency        text      NOT NULL DEFAULT 'COP',
      stock           integer   NOT NULL DEFAULT -1, -- -1 = unlimited
      is_active       boolean   NOT NULL DEFAULT true,
      cover_image     text,                          -- Cloudinary URL
      created_at      timestamp DEFAULT now(),
      updated_at      timestamp DEFAULT now()
    );
  `;
  console.log("  ✓ products table");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_products_provider ON products(provider_id, created_at DESC);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(role_category, is_active, price ASC);
  `;

  // Rich media assets for any entity (product, service, post)
  await sql`
    CREATE TABLE IF NOT EXISTS media_assets (
      id          varchar   PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_id   varchar   NOT NULL,
      entity_type text      NOT NULL CHECK (entity_type IN ('product','service','social_post','profile')),
      url         text      NOT NULL,
      type        text      NOT NULL DEFAULT 'image'
                            CHECK (type IN ('image','video','360_image','360_video','3d_model')),
      caption     text,
      sort_order  integer   NOT NULL DEFAULT 0,
      created_at  timestamp DEFAULT now()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_media_assets_entity ON media_assets(entity_id, sort_order ASC);
  `;
  console.log("  ✓ media_assets table");

  // Orders — run in two steps to avoid Neon DDL timing issues
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id              varchar   PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_id        varchar   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id      varchar   NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity        integer   NOT NULL DEFAULT 1,
      unit_price      numeric(12,2) NOT NULL,
      total           numeric(12,2) NOT NULL,
      status          text      NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','paid','cancelled','refunded','completed')),
      payment_intent  text,
      notes           text,
      created_at      timestamp DEFAULT now(),
      updated_at      timestamp DEFAULT now()
    )
  `;
  console.log("  ✓ orders table");

  console.log("\n✅ Phase 2 migration complete!");
}

run().catch((err) => { console.error("❌ Migration failed:", err); process.exit(1); });
