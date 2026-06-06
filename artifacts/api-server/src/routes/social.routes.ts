import { Router } from "express";
import { requireAuth } from "./app.routes.js";

import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

const router = Router();

// GET /api/social/posts
router.get("/posts", async (req, res) => {
  try {
    const sql = getSql();
    const posts = await sql`
      SELECT 
        sp.id,
        sp.username        AS "authorUsername",
        sp.caption         AS content,
        sp.media_url       AS "mediaUrl",
        sp.media_type      AS "mediaType",
        sp.likes_count     AS "likesCount",
        sp.comments_count  AS "commentsCount",
        sp.created_at      AS "createdAt",
        u.avatar_url       AS "authorAvatar",
        COALESCE(u.name, sp.username) AS "authorName"
      FROM social_posts sp
      LEFT JOIN users u 
        ON u.username = sp.username 
        OR u.email = sp.username
        OR u.id = sp.user_id
      ORDER BY sp.created_at DESC
      LIMIT 50
    `;
    res.json(posts);
  } catch (err: any) {
    console.error("[social] GET /posts error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/social/posts
router.post("/posts", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    const { content, mediaUrl, mediaType } = req.body;
    const username = req.user.username;

    if (!content?.trim() && !mediaUrl) {
      return res.status(400).json({ message: "Se requiere contenido o media" });
    }

    // Obtener user_id
    const [u] = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`;
    if (!u) return res.status(404).json({ message: "Usuario no encontrado" });

    const [post] = await sql`
      INSERT INTO social_posts (id, user_id, username, caption, media_url, media_type, likes_count, comments_count, created_at)
      VALUES (gen_random_uuid(), ${u.id}, ${username}, ${content?.trim() || null}, ${mediaUrl || null}, ${mediaType || 'image'}, 0, 0, now())
      RETURNING 
        id,
        username AS "authorUsername",
        caption  AS content,
        media_url AS "mediaUrl",
        media_type AS "mediaType",
        likes_count AS "likesCount",
        comments_count AS "commentsCount",
        created_at AS "createdAt"
    `;
    return res.json(post);
  } catch (err: any) {
    console.error("[social] POST /posts error:", err.message);
    return res.status(400).json({ message: err.message });
  }
});

// POST /api/social/posts/:postId/like
router.post("/posts/:postId/like", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    const { postId } = req.params;
    const username = req.user.username;

    const [u] = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`;
    if (!u) return res.status(404).json({ message: "Usuario no encontrado" });

    const [existing] = await sql`
      SELECT id FROM social_likes WHERE post_id = ${postId} AND user_id = ${u.id} LIMIT 1
    `;

    if (existing) {
      await sql`DELETE FROM social_likes WHERE post_id = ${postId} AND user_id = ${u.id}`;
      await sql`UPDATE social_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ${postId}`;
      return res.json({ liked: false });
    } else {
      await sql`
        INSERT INTO social_likes (id, post_id, user_id, created_at)
        VALUES (gen_random_uuid(), ${postId}, ${u.id}, now())
        ON CONFLICT DO NOTHING
      `;
      await sql`UPDATE social_posts SET likes_count = likes_count + 1 WHERE id = ${postId}`;
      return res.json({ liked: true });
    }
  } catch (err: any) {
    console.error("[social] like error:", err.message);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/social/posts/:postId/comments
router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const sql = getSql();
    const { postId } = req.params;
    const comments = await sql`
      SELECT 
        sc.id,
        sc.username,
        sc.content,
        sc.created_at,
        u.avatar_url
      FROM social_comments sc
      LEFT JOIN users u ON u.username = sc.username
      WHERE sc.post_id = ${postId}
      ORDER BY sc.created_at ASC
    `;
    return res.json({ comments });
  } catch (err: any) {
    return res.status(500).json({ comments: [] });
  }
});

// POST /api/social/posts/:postId/comments
router.post("/posts/:postId/comments", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    const { postId } = req.params;
    const { content } = req.body;
    const username = req.user.username;

    if (!content?.trim()) return res.status(400).json({ message: "Contenido requerido" });

    const [u] = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`;
    if (!u) return res.status(404).json({ message: "Usuario no encontrado" });

    const [comment] = await sql`
      INSERT INTO social_comments (id, post_id, user_id, username, content, created_at)
      VALUES (gen_random_uuid(), ${postId}, ${u.id}, ${username}, ${content.trim()}, now())
      RETURNING id, username, content, created_at
    `;
    await sql`UPDATE social_posts SET comments_count = comments_count + 1 WHERE id = ${postId}`;
    return res.json(comment);
  } catch (err: any) {
    console.error("[social] comment error:", err.message);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/social/posts/:postId
router.delete("/posts/:postId", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    const { postId } = req.params;
    const username = req.user.username;
    await sql`DELETE FROM social_posts WHERE id = ${postId} AND username = ${username}`;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export { router as socialRouter };
