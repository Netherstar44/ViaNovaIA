/**
 * Phase 4 migration — social feed tables
 * Run: node scripts/migrate-phase4.mjs
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("▶ Running Phase 4 (ViaSocial) migrations…");

  // Posts table
  await sql`
    CREATE TABLE IF NOT EXISTS social_posts (
      id          varchar   PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     varchar   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username    text      NOT NULL,
      caption     text,
      media_url   text,
      media_type  text      NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video','360_image','360_video','3d_model')),
      likes_count integer   NOT NULL DEFAULT 0,
      comments_count integer NOT NULL DEFAULT 0,
      created_at  timestamp DEFAULT now()
    );
  `;
  console.log("  ✓ social_posts table");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(created_at DESC);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_posts_user ON social_posts(user_id, created_at DESC);
  `;

  // Likes table (unique per user+post)
  await sql`
    CREATE TABLE IF NOT EXISTS social_likes (
      id          varchar   PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id     varchar   NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      user_id     varchar   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  timestamp DEFAULT now(),
      UNIQUE(post_id, user_id)
    );
  `;
  console.log("  ✓ social_likes table");

  // Comments table
  await sql`
    CREATE TABLE IF NOT EXISTS social_comments (
      id          varchar   PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id     varchar   NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      user_id     varchar   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username    text      NOT NULL,
      content     text      NOT NULL,
      created_at  timestamp DEFAULT now()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_comments_post ON social_comments(post_id, created_at ASC);
  `;
  console.log("  ✓ social_comments table");

  // Followers table
  await sql`
    CREATE TABLE IF NOT EXISTS social_followers (
      id            varchar   PRIMARY KEY DEFAULT gen_random_uuid(),
      follower_id   varchar   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id  varchar   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at    timestamp DEFAULT now(),
      UNIQUE(follower_id, following_id)
    );
  `;
  console.log("  ✓ social_followers table");

  console.log("\n✅ Phase 4 migration complete!");
}

run().catch((err) => { console.error("❌ Migration failed:", err); process.exit(1); });
