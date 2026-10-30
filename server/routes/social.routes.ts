import { Router } from "express";
import { requireAuth, optionalAuth } from "../security.js";
import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

const router = Router();
let schemaReady = false;

async function ensureSocialSchema(sql: any) {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS social_posts (
      id             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username       text NOT NULL,
      caption        text,
      media_url      text,
      media_type     text,
      likes_count    integer NOT NULL DEFAULT 0,
      comments_count integer NOT NULL DEFAULT 0,
      created_at     timestamp DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_posts_created
    ON social_posts(created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_posts_username
    ON social_posts(username, created_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS social_likes (
      id         varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id    varchar NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      user_id    varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp DEFAULT now(),
      UNIQUE(post_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS social_comments (
      id         varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id    varchar NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      user_id    varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username   text NOT NULL,
      content    text NOT NULL,
      created_at timestamp DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS social_followers (
      follower_id  varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   timestamp DEFAULT now(),
      PRIMARY KEY(follower_id, following_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS social_blocks (
      id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      blocker_id  varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id  varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  timestamp DEFAULT now(),
      UNIQUE(blocker_id, blocked_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS social_reports (
      id           varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id  varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reported_id  varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason       text NOT NULL,
      details      text,
      status       text NOT NULL DEFAULT 'pending',
      created_at   timestamp DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS social_messages (
      id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_username    text NOT NULL,
      recipient_username text NOT NULL,
      content            text NOT NULL,
      is_read            text NOT NULL DEFAULT 'false',
      created_at         timestamp DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_messages_pair
    ON social_messages(sender_username, recipient_username, created_at DESC)
  `;
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bio text,
      ADD COLUMN IF NOT EXISTS banner_url text,
      ADD COLUMN IF NOT EXISTS contact_email text,
      ADD COLUMN IF NOT EXISTS contact_phone text,
      ADD COLUMN IF NOT EXISTS contact_website text,
      ADD COLUMN IF NOT EXISTS contact_visibility text DEFAULT 'private',
      ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp,
      ADD COLUMN IF NOT EXISTS two_factor_enabled text DEFAULT 'false',
      ADD COLUMN IF NOT EXISTS premium_plan text DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS deleted_at timestamp
  `;
  schemaReady = true;
}

async function userIdFor(sql: any, username: string): Promise<string | null> {
  if (!username) return null;
  const rows = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`;
  return rows[0]?.id || null;
}

async function notify(sql: any, recipient: string, actor: string, type: string, details: string) {
  if (!recipient || recipient === actor) return;
  try {
    await sql`
      INSERT INTO notifications (id, provider_username, traveler_username, type, details, is_read, created_at)
      VALUES (gen_random_uuid(), ${recipient}, ${actor}, ${type}, ${details}, 'false', now())
    `;
  } catch (err: any) {
    console.warn("[social] no se pudo crear notificación:", err.message);
  }
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

// GET /api/social/posts?limit=&before=
router.get("/posts", optionalAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const viewer = req.user?.username ? String(req.user.username) : "";
    const viewerId = await userIdFor(sql, viewer);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const before = req.query.before ? String(req.query.before) : null;

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
      LEFT JOIN users u ON u.id = sp.user_id
      WHERE (${before}::timestamp IS NULL OR sp.created_at < ${before}::timestamp)
        AND (
          ${viewerId}::varchar IS NULL OR NOT EXISTS (
            SELECT 1 FROM social_blocks b
            WHERE (b.blocker_id = ${viewerId} AND b.blocked_id = sp.user_id)
               OR (b.blocked_id = ${viewerId} AND b.blocker_id = sp.user_id)
          )
        )
      ORDER BY sp.created_at DESC
      LIMIT ${limit}
    `;
    res.json(posts);
  } catch (err: any) {
    console.error("[social] GET /posts error:", err.message);
    res.status(500).json({ message: "No se pudo cargar el feed" });
  }
});

// POST /api/social/posts
router.post("/posts", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const username = req.user.username;
    const content = cleanText(req.body?.content, 2200);
    const mediaUrl = cleanText(req.body?.mediaUrl, 1000) || null;
    const mediaType = cleanText(req.body?.mediaType, 20) || "image";
    const allowedTypes = ["image", "video", "360_image", "360_video", "3d_model"];

    if (!content && !mediaUrl) {
      return res.status(400).json({ message: "Se requiere contenido o media" });
    }
    if (!allowedTypes.includes(mediaType)) {
      return res.status(400).json({ message: "Tipo de media no soportado" });
    }

    const uid = await userIdFor(sql, username);
    if (!uid) return res.status(404).json({ message: "Usuario no encontrado" });

    const [post] = await sql`
      INSERT INTO social_posts (id, user_id, username, caption, media_url, media_type, likes_count, comments_count, created_at)
      VALUES (gen_random_uuid(), ${uid}, ${username}, ${content || null}, ${mediaUrl}, ${mediaType}, 0, 0, now())
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
    res.json(post);
  } catch (err: any) {
    console.error("[social] POST /posts error:", err.message);
    res.status(400).json({ message: "No se pudo publicar" });
  }
});

// POST /api/social/posts/:postId/like  (toggle)
router.post("/posts/:postId/like", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const { postId } = req.params;
    const username = req.user.username;
    const uid = await userIdFor(sql, username);
    if (!uid) return res.status(404).json({ message: "Usuario no encontrado" });

    const [post] = await sql`SELECT username FROM social_posts WHERE id = ${postId} LIMIT 1`;
    if (!post) return res.status(404).json({ message: "Publicación no encontrada" });

    const [existing] = await sql`
      SELECT id FROM social_likes WHERE post_id = ${postId} AND user_id = ${uid} LIMIT 1
    `;

    if (existing) {
      await sql`DELETE FROM social_likes WHERE post_id = ${postId} AND user_id = ${uid}`;
      await sql`UPDATE social_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ${postId}`;
      return res.json({ liked: false });
    }

    const inserted = await sql`
      INSERT INTO social_likes (id, post_id, user_id, created_at)
      VALUES (gen_random_uuid(), ${postId}, ${uid}, now())
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    // Solo incrementar si el like se insertó realmente.
    if (inserted.length > 0) {
      await sql`UPDATE social_posts SET likes_count = likes_count + 1 WHERE id = ${postId}`;
      await notify(sql, post.username, username, "like", `@${username} le gustó tu publicación`);
    }
    return res.json({ liked: true });
  } catch (err: any) {
    console.error("[social] like error:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/social/posts/:postId/like
router.delete("/posts/:postId/like", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const { postId } = req.params;
    const uid = await userIdFor(sql, req.user.username);
    if (!uid) return res.status(404).json({ message: "Usuario no encontrado" });
    const deleted = await sql`
      DELETE FROM social_likes
      WHERE post_id = ${postId} AND user_id = ${uid}
      RETURNING id
    `;
    if (deleted.length > 0) {
      await sql`UPDATE social_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ${postId}`;
    }
    res.json({ liked: false });
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/social/posts/:postId/likes/check
router.get("/posts/:postId/likes/check", optionalAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const username = cleanText(req.user?.username, 80);
    const uid = await userIdFor(sql, username);
    if (!uid) return res.json({ liked: false });
    const [row] = await sql`
      SELECT id FROM social_likes WHERE post_id = ${req.params.postId} AND user_id = ${uid} LIMIT 1
    `;
    res.json({ liked: Boolean(row) });
  } catch {
    res.json({ liked: false });
  }
});

// GET /api/social/posts/:postId/comments
router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const comments = await sql`
      SELECT
        sc.id,
        sc.username,
        sc.content,
        sc.created_at,
        u.avatar_url
      FROM social_comments sc
      LEFT JOIN users u ON u.username = sc.username
      WHERE sc.post_id = ${req.params.postId}
      ORDER BY sc.created_at ASC
    `;
    res.json({ comments });
  } catch {
    res.json({ comments: [] });
  }
});

// POST /api/social/posts/:postId/comments
router.post("/posts/:postId/comments", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const username = req.user.username;
    const content = cleanText(req.body?.content, 1000);
    if (!content) return res.status(400).json({ message: "Contenido requerido" });

    const uid = await userIdFor(sql, username);
    if (!uid) return res.status(404).json({ message: "Usuario no encontrado" });

    const [post] = await sql`SELECT username FROM social_posts WHERE id = ${req.params.postId} LIMIT 1`;
    if (!post) return res.status(404).json({ message: "Publicación no encontrada" });

    const [comment] = await sql`
      INSERT INTO social_comments (id, post_id, user_id, username, content, created_at)
      VALUES (gen_random_uuid(), ${req.params.postId}, ${uid}, ${username}, ${content}, now())
      RETURNING id, username, content, created_at
    `;
    await sql`UPDATE social_posts SET comments_count = comments_count + 1 WHERE id = ${req.params.postId}`;
    await notify(sql, post.username, username, "comment", `@${username} comentó tu publicación`);
    res.json(comment);
  } catch (err: any) {
    console.error("[social] comment error:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/social/posts/:postId
router.delete("/posts/:postId", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const uid = await userIdFor(sql, req.user.username);
    if (!uid) return res.status(404).json({ message: "Usuario no encontrado" });
    await sql`DELETE FROM social_posts WHERE id = ${req.params.postId} AND user_id = ${uid}`;
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Follow / Block / Report ───────────────────────────────────────────────────

async function relationshipState(sql: any, viewerId: string | null, targetId: string | null) {
  if (!viewerId || !targetId) return { isFollowing: false, isBlocked: false, isBlockedBy: false };
  const [follow] = await sql`
    SELECT 1 FROM social_followers WHERE follower_id = ${viewerId} AND following_id = ${targetId} LIMIT 1
  `;
  const [block] = await sql`
    SELECT 1 FROM social_blocks WHERE blocker_id = ${viewerId} AND blocked_id = ${targetId} LIMIT 1
  `;
  const [blockedBy] = await sql`
    SELECT 1 FROM social_blocks WHERE blocker_id = ${targetId} AND blocked_id = ${viewerId} LIMIT 1
  `;
  return { isFollowing: Boolean(follow), isBlocked: Boolean(block), isBlockedBy: Boolean(blockedBy) };
}

// POST /api/social/follow
router.post("/follow", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const follower = req.user.username;
    const target = cleanText(req.body?.followingUsername, 80);
    if (!target) return res.status(400).json({ message: "Username requerido" });
    if (target === follower) return res.status(400).json({ message: "No puedes seguirte a ti mismo" });

    const followerId = await userIdFor(sql, follower);
    const targetId = await userIdFor(sql, target);
    if (!followerId || !targetId) return res.status(404).json({ message: "Usuario no encontrado" });

    const state = await relationshipState(sql, followerId, targetId);
    if (state.isBlocked || state.isBlockedBy) {
      return res.status(403).json({ message: "No puedes seguir a este usuario" });
    }

    await sql`
      INSERT INTO social_followers (follower_id, following_id, created_at)
      VALUES (${followerId}, ${targetId}, now())
      ON CONFLICT DO NOTHING
    `;
    await notify(sql, target, follower, "follow", `@${follower} empezó a seguirte`);
    res.json({ success: true, isFollowing: true });
  } catch (err) {
    console.error("[social] follow error:", err);
    res.status(500).json({ message: "No se pudo seguir al usuario" });
  }
});

// DELETE /api/social/follow
router.delete("/follow", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const followerId = await userIdFor(sql, req.user.username);
    const targetId = await userIdFor(sql, cleanText(req.body?.followingUsername, 80));
    if (!followerId || !targetId) return res.status(404).json({ message: "Usuario no encontrado" });
    await sql`
      DELETE FROM social_followers WHERE follower_id = ${followerId} AND following_id = ${targetId}
    `;
    res.json({ success: true, isFollowing: false });
  } catch {
    res.status(500).json({ message: "No se pudo dejar de seguir al usuario" });
  }
});

// GET /api/social/follow/status?username=
router.get("/follow/status", optionalAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const target = cleanText(req.query.username, 80);
    const viewer = cleanText(req.user?.username, 80);
    const targetId = await userIdFor(sql, target);
    const viewerId = await userIdFor(sql, viewer);
    if (!targetId) return res.status(404).json({ message: "Usuario no encontrado" });

    const [followers] = await sql`SELECT COUNT(*)::int AS c FROM social_followers WHERE following_id = ${targetId}`;
    const [following] = await sql`SELECT COUNT(*)::int AS c FROM social_followers WHERE follower_id = ${targetId}`;
    const state = await relationshipState(sql, viewerId, targetId);
    res.json({ followers: Number(followers?.c || 0), following: Number(following?.c || 0), ...state });
  } catch {
    res.status(500).json({ message: "No se pudo consultar la relación" });
  }
});

// POST /api/social/block
router.post("/block", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const blocker = req.user.username;
    const target = cleanText(req.body?.username, 80);
    if (!target) return res.status(400).json({ message: "Username requerido" });
    if (target === blocker) return res.status(400).json({ message: "No puedes bloquearte a ti mismo" });

    const blockerId = await userIdFor(sql, blocker);
    const targetId = await userIdFor(sql, target);
    if (!blockerId || !targetId) return res.status(404).json({ message: "Usuario no encontrado" });

    await sql`
      INSERT INTO social_blocks (blocker_id, blocked_id, created_at)
      VALUES (${blockerId}, ${targetId}, now())
      ON CONFLICT DO NOTHING
    `;
    await sql`
      DELETE FROM social_followers
      WHERE (follower_id = ${blockerId} AND following_id = ${targetId})
         OR (follower_id = ${targetId} AND following_id = ${blockerId})
    `;
    res.json({ success: true, isBlocked: true });
  } catch {
    res.status(500).json({ message: "No se pudo bloquear al usuario" });
  }
});

// DELETE /api/social/block
router.delete("/block", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const blockerId = await userIdFor(sql, req.user.username);
    const targetId = await userIdFor(sql, cleanText(req.body?.username, 80));
    if (!blockerId || !targetId) return res.status(404).json({ message: "Usuario no encontrado" });
    await sql`DELETE FROM social_blocks WHERE blocker_id = ${blockerId} AND blocked_id = ${targetId}`;
    res.json({ success: true, isBlocked: false });
  } catch {
    res.status(500).json({ message: "No se pudo desbloquear al usuario" });
  }
});

// POST /api/social/report
router.post("/report", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const reporter = req.user.username;
    const target = cleanText(req.body?.username, 80);
    const reason = cleanText(req.body?.reason, 120);
    const details = cleanText(req.body?.details, 1000);
    if (!target || !reason) return res.status(400).json({ message: "Usuario y motivo requeridos" });

    const reporterId = await userIdFor(sql, reporter);
    const targetId = await userIdFor(sql, target);
    if (!reporterId || !targetId) return res.status(404).json({ message: "Usuario no encontrado" });

    await sql`
      INSERT INTO social_reports (id, reporter_id, reported_id, reason, details, status, created_at)
      VALUES (gen_random_uuid(), ${reporterId}, ${targetId}, ${reason}, ${details || null}, 'pending', now())
    `;
    res.json({ success: true, message: "Reporte enviado. Gracias por ayudar a cuidar la comunidad." });
  } catch {
    res.status(500).json({ message: "No se pudo enviar el reporte" });
  }
});

// GET /api/social/users/:username/profile
router.get("/users/:username/profile", optionalAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const username = cleanText(req.params.username, 80);
    const viewer = cleanText(req.user?.username, 80);

    const [profile] = await sql`
      SELECT
        username,
        name,
        avatar_url AS "avatarUrl",
        banner_url AS "bannerUrl",
        bio,
        role,
        created_at AS "createdAt",
        contact_email AS "contactEmail",
        contact_phone AS "contactPhone",
        contact_website AS "contactWebsite",
        contact_visibility AS "contactVisibility"
      FROM users WHERE username = ${username} AND deleted_at IS NULL LIMIT 1
    `;
    if (!profile) return res.status(404).json({ message: "Usuario no encontrado" });

    const uid = await userIdFor(sql, username);
    const viewerId = await userIdFor(sql, viewer);
    const [postsCount] = await sql`SELECT COUNT(*)::int AS c FROM social_posts WHERE username = ${username}`;
    const [followers] = await sql`SELECT COUNT(*)::int AS c FROM social_followers WHERE following_id = ${uid}`;
    const [following] = await sql`SELECT COUNT(*)::int AS c FROM social_followers WHERE follower_id = ${uid}`;
    const state = await relationshipState(sql, viewerId, uid);

    const isOwner = Boolean(viewer && viewer === username);
    const visibility = String(profile.contactVisibility || "private").toLowerCase();
    const canViewContact =
      !state.isBlocked &&
      !state.isBlockedBy &&
      (isOwner || visibility === "public" || (visibility === "followers" && state.isFollowing));
    const contact = canViewContact
      ? {
          email: profile.contactEmail || null,
          phone: profile.contactPhone || null,
          website: profile.contactWebsite || null,
        }
      : null;
    const hasContact = Boolean(contact && (contact.email || contact.phone || contact.website));
    const { contactEmail: _contactEmail, contactPhone: _contactPhone, contactWebsite: _contactWebsite, ...publicProfile } = profile;

    res.json({
      profile: {
        ...publicProfile,
        contactVisibility: visibility,
        contact: hasContact ? contact : null,
        postsCount: Number(postsCount?.c || 0),
        followers: Number(followers?.c || 0),
        following: Number(following?.c || 0),
        ...state,
      },
    });
  } catch (err: any) {
    console.error("[social] GET /users/:username/profile error:", err.message);
    res.status(500).json({ message: "No se pudo cargar el perfil" });
  }
});

// GET /api/social/users/:username/posts
router.get("/users/:username/posts", async (req, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const posts = await sql`
      SELECT
        sp.id,
        sp.username AS "authorUsername",
        sp.caption AS content,
        sp.media_url AS "mediaUrl",
        sp.media_type AS "mediaType",
        sp.likes_count AS "likesCount",
        sp.comments_count AS "commentsCount",
        sp.created_at AS "createdAt",
        u.avatar_url AS "authorAvatar",
        COALESCE(u.name, sp.username) AS "authorName"
      FROM social_posts sp
      LEFT JOIN users u ON u.id = sp.user_id
      WHERE sp.username = ${req.params.username}
      ORDER BY sp.created_at DESC
      LIMIT 50
    `;
    res.json({ posts });
  } catch (err: any) {
    console.error("[social] GET /users/:username/posts error:", err.message);
    res.status(500).json({ posts: [] });
  }
});

// ── Direct messages ───────────────────────────────────────────────────────────

// GET /api/social/messages/conversations
router.get("/messages/conversations", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const me = req.user.username;
    const rows = await sql`
      SELECT DISTINCT ON (t.other_username)
        t.other_username AS "username",
        t.content AS "lastMessage",
        t.created_at AS "lastAt",
        t.sender_username AS "lastSender",
        u.avatar_url AS "avatarUrl",
        COALESCE(u.name, t.other_username) AS "name",
        (
          SELECT COUNT(*)::int FROM social_messages m
          WHERE m.recipient_username = ${me}
            AND m.sender_username = t.other_username
            AND m.is_read = 'false'
        ) AS "unread"
      FROM (
        SELECT CASE WHEN sender_username = ${me} THEN recipient_username ELSE sender_username END AS other_username,
               content, created_at, sender_username
        FROM social_messages
        WHERE sender_username = ${me} OR recipient_username = ${me}
      ) t
      LEFT JOIN users u ON u.username = t.other_username
      ORDER BY t.other_username, t.created_at DESC
    `;
    rows.sort((a: any, b: any) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
    res.json({ conversations: rows.map((r: any) => ({ ...r, unread: Number(r.unread || 0) })) });
  } catch (err: any) {
    console.error("[social] conversations error:", err.message);
    res.status(500).json({ conversations: [] });
  }
});

// GET /api/social/messages/unread/count
router.get("/messages/unread/count", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const [row] = await sql`
      SELECT COUNT(*)::int AS c FROM social_messages
      WHERE recipient_username = ${req.user.username} AND is_read = 'false'
    `;
    res.json({ count: Number(row?.c || 0) });
  } catch {
    res.json({ count: 0 });
  }
});

// GET /api/social/messages/:otherUsername
router.get("/messages/:otherUsername", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const me = req.user.username;
    const other = cleanText(req.params.otherUsername, 80);
    if (!other) return res.status(400).json({ message: "Usuario requerido" });

    const meId = await userIdFor(sql, me);
    const otherId = await userIdFor(sql, other);
    if (!meId || !otherId) return res.status(404).json({ message: "Usuario no encontrado" });
    const state = await relationshipState(sql, meId, otherId);
    if (state.isBlocked || state.isBlockedBy) {
      return res.status(403).json({ message: "Mensajería no disponible con este usuario" });
    }

    const messages = await sql`
      SELECT id, sender_username AS "sender", recipient_username AS "recipient",
             content, is_read AS "isRead", created_at AS "createdAt"
      FROM social_messages
      WHERE (sender_username = ${me} AND recipient_username = ${other})
         OR (sender_username = ${other} AND recipient_username = ${me})
      ORDER BY created_at ASC
      LIMIT 300
    `;
    await sql`
      UPDATE social_messages SET is_read = 'true'
      WHERE recipient_username = ${me} AND sender_username = ${other} AND is_read = 'false'
    `;
    res.json({ messages });
  } catch {
    res.status(500).json({ messages: [] });
  }
});

// POST /api/social/messages
router.post("/messages", requireAuth, async (req: any, res) => {
  try {
    const sql = getSql();
    await ensureSocialSchema(sql);
    const me = req.user.username;
    const recipient = cleanText(req.body?.recipientUsername, 80);
    const content = cleanText(req.body?.content, 2000);
    if (!recipient || !content) return res.status(400).json({ message: "Destinatario y mensaje requeridos" });
    if (recipient === me) return res.status(400).json({ message: "No puedes enviarte mensajes a ti mismo" });

    const meId = await userIdFor(sql, me);
    const recipientId = await userIdFor(sql, recipient);
    if (!meId || !recipientId) return res.status(404).json({ message: "Usuario no encontrado" });

    const state = await relationshipState(sql, meId, recipientId);
    if (state.isBlocked || state.isBlockedBy) {
      return res.status(403).json({ message: "Mensajería no disponible con este usuario" });
    }

    const [message] = await sql`
      INSERT INTO social_messages (id, sender_username, recipient_username, content, is_read, created_at)
      VALUES (gen_random_uuid(), ${me}, ${recipient}, ${content}, 'false', now())
      RETURNING id, sender_username AS "sender", recipient_username AS "recipient",
                content, is_read AS "isRead", created_at AS "createdAt"
    `;
    await notify(sql, recipient, me, "message", `@${me} te envió un mensaje`);
    res.json(message);
  } catch {
    res.status(500).json({ message: "No se pudo enviar el mensaje" });
  }
});

export { router as socialRouter };
