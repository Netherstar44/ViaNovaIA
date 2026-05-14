import "dotenv/config";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerTaxiRoutes } from "./routes/taxi.routes";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fetch from "node-fetch";
import { z } from "zod";
import { insertServiceSchema, insertCommentSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendWelcomeEmail, sendPasswordResetEmail, sendPasswordChangedEmail } from "./mailer";

const upload = multer({ storage: multer.memoryStorage() });

// Hash password with $2a$ prefix for pgcrypto compatibility (mobile app uses pgcrypto)
async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(plain, salt);
  // bcryptjs v3 produces $2b$, but pgcrypto only reads $2a$ — they are identical
  return hash.replace(/^\$2b\$/, "$2a$");
}

// Configure Cloudinary from env
function configureCloudinary() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
}

// Helper: strip sensitive fields from user object before sending to client
function sanitizeUser(user: any) {
  const { password, ...safe } = user;
  return safe;
}

// Helper: detect the public-facing base URL of the app.
// Fully dynamic — auto-detects from request headers.
// When accessed via ngrok:  x-forwarded-proto=https, host=*.ngrok-free.dev
// When accessed via localhost: protocol=http, host=localhost:5000
// This allows BOTH connections to work simultaneously without env changes.
function getBaseUrl(req: import('express').Request): string {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
  return `${String(proto).split(',')[0]}://${host}`.replace(/\/$/, '');
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  configureCloudinary();

  // Health
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // ─── AUTH: Register (always traveler) ────────────────────────────────────────
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { username, password, name, email } = req.body || {};

      if (!username || !password || !email) {
        return res.status(400).json({ message: "username, email y password son obligatorios" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "El nombre de usuario ya está registrado" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ message: "El correo electrónico ya está registrado" });
      }

      const hashedPassword = await hashPassword(password);

      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name: name || username,
        email,
        role: "traveler",
      });

      sendWelcomeEmail(email, name || username).catch((err) => {
        console.error("Error enviando email de bienvenida:", err.message);
      });

      res.json({ user: sanitizeUser(user) });
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Login ─────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const { username, password } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({ message: "username y password son obligatorios" });
      }

      // Try login by username or email
      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.getUserByEmail(username);
      }
      if (!user) {
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      // Verify password with bcrypt
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Contraseña incorrecta" });
      }

      res.json({ user: sanitizeUser(user) });
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Forgot Password ──────────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req, res, next) => {
    try {
      const { email } = req.body || {};
      if (!email) {
        return res.status(400).json({ message: "El correo electrónico es obligatorio" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "No existe una cuenta con ese correo. Verifica e intenta de nuevo." });
      }

      // Block recovery for Google accounts
      if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
        // bcrypt hash = local account, proceed
      } else {
        return res.status(400).json({ message: "Esta cuenta fue creada con Google. Usa 'Iniciar con Google' para acceder." });
      }

      // Generate short 8-char hex token (e.g. 836DD350)
      const token = crypto.randomBytes(4).toString("hex").toUpperCase();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await storage.createPasswordResetToken(user.id, token, expiresAt);

      // Send email (non-blocking)
      sendPasswordResetEmail(email, user.name || user.username, token).catch((err) => {
        console.error("Error enviando email de reset:", err.message);
      });

      res.json({ message: "Te hemos enviado un código de recuperación a tu correo." });
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Verify Reset Token ───────────────────────────────────────────────
  app.post("/api/auth/verify-reset-token", async (req, res, next) => {
    try {
      const { token } = req.body || {};
      if (!token) return res.status(400).json({ message: "Token obligatorio" });

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ valid: false, message: "Código inválido o ya fue utilizado" });
      }
      if (new Date() > new Date(resetToken.expiresAt)) {
        await storage.deletePasswordResetToken(token);
        return res.status(400).json({ valid: false, message: "El código ha expirado. Solicita uno nuevo." });
      }
      res.json({ valid: true, message: "Código verificado correctamente" });
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Reset Password ───────────────────────────────────────────────────
  app.post("/api/auth/reset-password", async (req, res, next) => {
    try {
      const { token, newPassword } = req.body || {};

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token y nueva contraseña son obligatorios" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Código inválido o ya fue utilizado" });
      }
      if (new Date() > new Date(resetToken.expiresAt)) {
        await storage.deletePasswordResetToken(token);
        return res.status(400).json({ message: "El código ha expirado. Solicita uno nuevo." });
      }

      const hashed = await hashPassword(newPassword);
      await storage.updateUserPassword(resetToken.userId, hashed);
      await storage.deletePasswordResetToken(token);

      // Send password changed notification with emergency reset link
      const user = await storage.getUser(resetToken.userId);
      if (user?.email) {
        const emergencyToken = crypto.randomBytes(4).toString("hex").toUpperCase();
        const emergencyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await storage.createPasswordResetToken(user.id, emergencyToken, emergencyExpires);
        const appUrl = getBaseUrl(req);
        const emergencyUrl = `${appUrl}/login?reset_token=${emergencyToken}`;
        sendPasswordChangedEmail(user.email, user.name || user.username, emergencyUrl).catch((err) => {
          console.error("Error enviando email de cambio:", err.message);
        });
      }

      res.json({ message: "Contraseña actualizada exitosamente. Ya puedes iniciar sesión." });
    } catch (err) {
      next(err);
    }
  });

  // ─── USER: Change Role (15 day cooldown) ───────────────────────────────────
  app.patch("/api/users/role", async (req, res, next) => {
    try {
      const { username, role } = req.body || {};
      if (!username || !role) {
        return res.status(400).json({ message: "username y role son obligatorios" });
      }
      const validRoles = ["traveler", "hotel", "restaurant", "recreation", "taxi"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Rol inválido" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      // Check 15-day cooldown
      if (user.roleChangedAt) {
        const diff = Date.now() - new Date(user.roleChangedAt).getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        if (days < 15) {
          const remaining = Math.ceil(15 - days);
          return res.status(429).json({ message: `Debes esperar ${remaining} día(s) más para cambiar tu rol.` });
        }
      }

      const updated = await storage.updateUserRole(user.id, role);
      res.json({ user: sanitizeUser(updated) });
    } catch (err) {
      next(err);
    }
  });

  // ─── Legacy: Create or login user (backward compat) ────────────────────────
  app.post("/api/users", async (req, res, next) => {
    try {
      const { username, password, name } = req.body || {};
      let user = await storage.getUserByUsername(username);
      if (!user) {
        const hashed = await hashPassword(password || "temp");
        user = await storage.createUser({ username, password: hashed, name });
      }
      res.json({ user: sanitizeUser(user) });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Google OAuth integration
  // ---------------------------------------------------------------------------

  app.get("/api/auth/google", async (req, res, next) => {
    try {
      const code = String(req.query.code || "");
      // Dynamic redirect URI: use the public-facing URL (works with ngrok)
      const dynamicRedirectUri = `${getBaseUrl(req)}/api/auth/google`;

      if (!code) {
        // Initiation — always use the dynamic URI (auto-detects localhost vs ngrok)
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const scope = encodeURIComponent("openid email profile");
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(dynamicRedirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
        return res.redirect(authUrl);
      }

      // Callback execution — use the same URI that was used for initiation
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          redirect_uri: dynamicRedirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData: any = await tokenRes.json();
      if (!tokenData.access_token) {
         console.error("Token fail:", tokenData);
         return res.status(400).send("No access token from Google");
      }

      const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile: any = await profileRes.json();

      const email = profile.email as string;
      let user = await storage.getUserByUsername(email);
      if (!user) {
        const hashed = await hashPassword("google_oauth_" + crypto.randomUUID());
        user = await storage.createUser({
          username: email,
          password: hashed,
          name: profile.name,
          email: email,
          role: "traveler",
        });

        // Send welcome email for new Google users
        sendWelcomeEmail(email, profile.name || email).catch((err) => {
          console.error("Error enviando email de bienvenida (Google):", err.message);
        });
      }

      const clientUrl = getBaseUrl(req);
      const payload = encodeURIComponent(JSON.stringify({
        username: email,
        name: profile.name,
        email: email,
        role: user.role || "traveler",
        roleChangedAt: user.roleChangedAt || null,
      }));
      res.redirect(`${clientUrl}/login?google_user=${payload}`);
    } catch (err) {
      console.error("Auth google error:", err);
      next(err);
    }
  });

  // Save/update user location
  app.post("/api/users/:id/location", async (req, res, next) => {
    try {
      const { id } = req.params;
      const { lat, lng } = req.body || {};
      // naive update using SQL in storage is omitted; for demo, return ok
      res.json({ ok: true, id, lat, lng });
    } catch (err) {
      next(err);
    }
  });

  // Cloudinary upload with category folder
  app.post("/api/upload", upload.single("file"), async (req, res, next) => {
    try {
      const category = String(req.body.category || "otros");
      const userId = String(req.body.userId || "anon");
      const folder = `vianova/${category}/${userId}`;

      if (!req.file) return res.status(400).json({ message: "file required" });

      const result = await cloudinary.uploader.upload_stream(
        { folder, resource_type: "image" },
        (error, uploaded) => {
          if (error || !uploaded) return next(error);
          res.json({
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            folder,
          });
        }
      );

      // write file buffer to stream
      // @ts-ignore
      result.end(req.file.buffer);
    } catch (err) {
      next(err);
    }
  });

  // Service management (CRUD - minimal)
  app.post("/api/services", async (req, res, next) => {
    try {
      const parsed = insertServiceSchema.parse(req.body || {});
      const created = await storage.insertService(parsed);
      res.json({ service: created });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      next(err);
    }
  });

  app.get("/api/services", async (req, res, next) => {
    try {
      const { category } = req.query as { category?: string };
      if (!category) return res.status(400).json({ message: "category required" });
      const list = await storage.listServicesByCategory(category);
      res.json({ services: list });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/services/provider/:username", async (req, res, next) => {
    try {
      const { username } = req.params;
      const list = await storage.listProviderServices(username);
      res.json({ services: list });
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/services/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const { providerUsername, ...data } = req.body || {};
      if (!providerUsername) return res.status(400).json({ message: "providerUsername required" });
      const updated = await storage.updateService(id, data);
      res.json({ service: updated });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/services/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const { providerUsername } = req.body || {};
      if (!providerUsername) return res.status(400).json({ message: "providerUsername required" });
      await storage.deleteService(id, providerUsername);
      res.json({ success: true, message: "Servicio eliminado" });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/comments", async (req, res, next) => {
    try {
      const parsed = insertCommentSchema.parse(req.body || {});
      const created = await storage.insertComment(parsed);
      res.json({ comment: created });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      next(err);
    }
  });

  app.get("/api/comments", async (req, res, next) => {
    try {
      const { locationId } = req.query as { locationId?: string };
      if (!locationId) return res.status(400).json({ message: "locationId required" });
      const list = await storage.listCommentsByLocation(locationId);
      res.json({ comments: list });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/comments/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const { username } = req.body;
      const { and, eq } = await import("drizzle-orm");
      const { comments } = await import("@shared/schema");
      const db = (await import("./storage")).getDb();

      await db.delete(comments).where(and(eq(comments.id, id), eq(comments.authorUsername, username)));
      res.json({ success: true, message: "Comentario eliminado" });
    } catch (err) {
      next(err);
    }
  });

  // ─── Migration endpoint ────────────────────────────────────────────────────
  app.get("/api/migrate", async (req, res, next) => {
    try {
      const { sql: drizzleSql } = await import("drizzle-orm");
      const db = (await import("./storage")).getDb();


      // Enum: service_category
      await db.execute(drizzleSql`
        DO $$ BEGIN
          CREATE TYPE service_category AS ENUM ('hotel', 'restaurant', 'recreation', 'transport');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // Enum: user_role
      await db.execute(drizzleSql`
        DO $$ BEGIN
          CREATE TYPE user_role AS ENUM ('traveler', 'hotel', 'restaurant', 'recreation', 'taxi');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // Table: services
      await db.execute(drizzleSql`
        CREATE TABLE IF NOT EXISTS services (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          provider_username text NOT NULL,
          category service_category NOT NULL,
          name text NOT NULL,
          description text,
          image_url text,
          location_lat text,
          location_lng text,
          rating integer,
          created_at timestamp DEFAULT now()
        );
      `);

      // Table: comments
      await db.execute(drizzleSql`
        CREATE TABLE IF NOT EXISTS comments (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          location_id text NOT NULL,
          author_username text NOT NULL,
          content text NOT NULL,
          rating integer,
          created_at timestamp DEFAULT now()
        );
      `);

      // Add email column to users (if not exists)
      await db.execute(drizzleSql`
        DO $$ BEGIN
          ALTER TABLE users ADD COLUMN email text;
        EXCEPTION
          WHEN duplicate_column THEN null;
        END $$;
      `);

      // Add role column to users (if not exists)
      await db.execute(drizzleSql`
        DO $$ BEGIN
          ALTER TABLE users ADD COLUMN role user_role DEFAULT 'traveler';
        EXCEPTION
          WHEN duplicate_column THEN null;
        END $$;
      `);

      // Table: password_reset_tokens
      await db.execute(drizzleSql`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id varchar NOT NULL REFERENCES users(id),
          token text NOT NULL UNIQUE,
          expires_at timestamp NOT NULL,
          created_at timestamp DEFAULT now()
        );
      `);

      // Add role_changed_at column to users (if not exists)
      await db.execute(drizzleSql`
        DO $$ BEGIN
          ALTER TABLE users ADD COLUMN role_changed_at timestamp;
        EXCEPTION
          WHEN duplicate_column THEN null;
        END $$;
      `);

      res.json({ success: true, message: "Tablas y columnas migradas exitosamente (roles, email, tokens, role_changed_at)" });
    } catch (err) {
      next(err);
    }
  });

  // Groq chat endpoint
  app.post("/api/chat", async (req, res, next) => {
    try {
      const { userId, username, message, name, location } = req.body || {};
      if (!message) return res.status(400).json({ message: "message required" });

      // Ensure we have a valid user id in DB (FK-safe)
      let uid: string | undefined = userId;
      if (!uid) {
        const uname = String(username || name || "anon");
        let u = await storage.getUserByUsername(uname);
        if (!u) {
          // store a temp password; in real app, use proper auth
          const hashed = await hashPassword("temp");
          u = await storage.createUser({ username: uname, password: hashed });
        }
        uid = u.id;
      }

      const conversation = await storage.upsertConversation(uid);
      await storage.addMessage(conversation.id, "user", message, { location });

      const sysPrompt = `Eres VIANova, un asistente general amable y profesional. Siempre te refieres al usuario por su nombre si está disponible. No uses lenguaje soez. Puedes recomendar hoteles, comidas y actividades basadas en la ubicación del usuario (lat, lng). Responde en español de forma concisa.`;

      const groqKey = process.env.GROQ_API_KEY;
      const completion = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: sysPrompt },
            name ? { role: "system", content: `Nombre del usuario: ${name}` } : undefined,
            location ? { role: "system", content: `Ubicación: ${JSON.stringify(location)}` } : undefined,
            { role: "user", content: message },
          ].filter(Boolean),
          temperature: 0.6,
          max_tokens: 600,
        }),
      });

      const data: any = await completion.json();
      const content = data.choices?.[0]?.message?.content || "";

      const assistantMsg = await storage.addMessage(conversation.id, "assistant", content);
      res.json({ reply: assistantMsg.content, conversationId: conversation.id });
    } catch (err) {
      next(err);
    }
  });

  // ── Resolver de links cortos de Google Maps ────────────────────────────────
  // Sigue los redirects (ej. maps.app.goo.gl → URL larga con coordenadas)
  // y devuelve la URL final para que el cliente extraiga lat/lng.
  app.get("/api/maps/resolve", async (req, res) => {
    try {
      const url = String(req.query.url || "").trim();
      if (!url) {
        return res.status(400).json({ error: "Falta el parámetro 'url'" });
      }
      // Solo permitir hosts conocidos de Google Maps por seguridad
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return res.status(400).json({ error: "URL inválida" });
      }
      const allowedHosts = [
        "maps.app.goo.gl",
        "goo.gl",
        "g.co",
        "www.google.com",
        "google.com",
        "maps.google.com",
      ];
      if (!allowedHosts.includes(parsed.hostname)) {
        return res.status(400).json({ error: "Solo se permiten links de Google Maps" });
      }

      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          // User-Agent realista para que goo.gl devuelva el redirect correcto
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        },
      });

      // node-fetch expone la URL final tras seguir los redirects
      const finalUrl = (response as any).url || url;
      res.json({ url: finalUrl });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "No se pudo resolver el link" });
    }
  });

  // ── USER ROLES (Multi-rol) ──────────────────────────────────────────────────

  // Listar roles de un usuario
  app.get("/api/users/:username/roles", async (req, res, next) => {
    try {
      const roles = await storage.getUserRolesByUsername(req.params.username);
      res.json({ roles });
    } catch (err) {
      next(err);
    }
  });

  // Agregar un rol al usuario
  app.post("/api/users/:username/roles", async (req, res, next) => {
    try {
      const { username } = req.params;
      const { role, businessName, businessAddress, businessPhone, vehicleType, plate, phone } = req.body || {};
      if (!role) return res.status(400).json({ message: "role es obligatorio" });

      const validRoles = ["traveler", "hotel", "restaurant", "recreation", "taxi"];
      if (!validRoles.includes(role)) return res.status(400).json({ message: "Rol inválido" });

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const roleRecord = await storage.addUserRole({
        userId: user.id,
        role,
        businessName: businessName || null,
        businessAddress: businessAddress || null,
        businessPhone: businessPhone || null,
        vehicleType: vehicleType || null,
        plate: plate || null,
        phone: phone || null,
      });

      // If this is the first role or user wants to switch, also set active role
      const updated = await storage.setActiveRole(user.id, role);

      // Update vehicle data in users table if taxi
      if (role === "taxi" && (vehicleType || plate || phone)) {
        const db = (await import("./storage")).getDb();
        const { sql: drizzleSql } = await import("drizzle-orm");
        if (vehicleType) await db.execute(drizzleSql`UPDATE users SET vehicle_type = ${vehicleType} WHERE id = ${user.id}`);
        if (plate) await db.execute(drizzleSql`UPDATE users SET plate = ${plate} WHERE id = ${user.id}`);
        if (phone) await db.execute(drizzleSql`UPDATE users SET phone = ${phone} WHERE id = ${user.id}`);
      }

      res.json({ role: roleRecord, user: sanitizeUser(updated) });
    } catch (err) {
      next(err);
    }
  });

  // Eliminar un rol del usuario
  app.delete("/api/users/:username/roles/:role", async (req, res, next) => {
    try {
      const { username, role } = req.params;
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      // Can't remove the only role
      const roles = await storage.getUserRoles(user.id);
      if (roles.length <= 1) return res.status(400).json({ message: "No puedes eliminar tu único rol" });

      // If removing the active role, switch to the first remaining one
      if (user.role === role) {
        const remaining = roles.find(r => r.role !== role);
        if (remaining) await storage.setActiveRole(user.id, remaining.role);
      }

      await storage.removeUserRole(user.id, role);
      const updatedUser = await storage.getUser(user.id);
      res.json({ success: true, user: updatedUser ? sanitizeUser(updatedUser) : null });
    } catch (err) {
      next(err);
    }
  });

  // Cambiar rol activo (sin cooldown)
  app.patch("/api/users/active-role", async (req, res, next) => {
    try {
      const { username, role } = req.body || {};
      if (!username || !role) return res.status(400).json({ message: "username y role son obligatorios" });

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      // Verify user has this role
      const roles = await storage.getUserRoles(user.id);
      const hasRole = roles.some(r => r.role === role);
      if (!hasRole) return res.status(400).json({ message: "No tienes este tipo de cuenta" });

      const updated = await storage.setActiveRole(user.id, role);
      res.json({ user: sanitizeUser(updated) });
    } catch (err) {
      next(err);
    }
  });

  // ── VEHICLE DATA ──────────────────────────────────────────────────────────

  app.patch("/api/taxi/vehicle", async (req, res, next) => {
    try {
      const { username, vehicleType, plate, phone } = req.body || {};
      if (!username) return res.status(400).json({ message: "username requerido" });

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      // Update in users table
      const db = (await import("./storage")).getDb();
      const { sql: drizzleSql } = await import("drizzle-orm");
      if (vehicleType !== undefined) await db.execute(drizzleSql`UPDATE users SET vehicle_type = ${vehicleType} WHERE id = ${user.id}`);
      if (plate !== undefined) await db.execute(drizzleSql`UPDATE users SET plate = ${plate} WHERE id = ${user.id}`);
      if (phone !== undefined) await db.execute(drizzleSql`UPDATE users SET phone = ${phone} WHERE id = ${user.id}`);

      // Also update in user_roles table
      const roleData = await storage.getUserRoleData(user.id, "taxi");
      if (roleData) {
        await storage.updateUserRoleData(user.id, "taxi", {
          vehicleType: vehicleType ?? roleData.vehicleType,
          plate: plate ?? roleData.plate,
          phone: phone ?? roleData.phone,
        });
      }

      res.json({ ok: true, message: "Datos del vehículo actualizados" });
    } catch (err) {
      next(err);
    }
  });

  // ── REVIEWS ───────────────────────────────────────────────────────────────

  app.post("/api/reviews", async (req, res, next) => {
    try {
      const { rideId, authorUsername, targetUsername, rating, comment, authorRole } = req.body || {};
      if (!rideId || !authorUsername || !targetUsername || !rating || !authorRole) {
        return res.status(400).json({ message: "Faltan campos obligatorios" });
      }
      if (rating < 1 || rating > 5) return res.status(400).json({ message: "Rating debe ser entre 1 y 5" });

      // Check if already reviewed
      const already = await storage.hasReviewedRide(rideId, authorUsername);
      if (already) return res.status(400).json({ message: "Ya dejaste una reseña para este viaje" });

      const review = await storage.createReview({
        rideId, authorUsername, targetUsername, rating, comment: comment || null, authorRole,
      });
      res.status(201).json({ review });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/reviews/:username", async (req, res, next) => {
    try {
      const revs = await storage.getReviewsByUsername(req.params.username);
      const avg = await storage.getAverageRating(req.params.username);
      res.json({ reviews: revs, averageRating: avg });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/reviews/ride/:rideId", async (req, res, next) => {
    try {
      const revs = await storage.getReviewsByRide(req.params.rideId);
      res.json({ reviews: revs });
    } catch (err) {
      next(err);
    }
  });

  // ── PAYMENT METHODS ───────────────────────────────────────────────────────

  app.get("/api/payment-methods/:username", async (req, res, next) => {
    try {
      const methods = await storage.getPaymentMethods(req.params.username);
      res.json({ methods });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/payment-methods", async (req, res, next) => {
    try {
      const { username, type, label, details, isDefault } = req.body || {};
      if (!username || !type || !label) return res.status(400).json({ message: "username, type y label son obligatorios" });

      const validTypes = ["cash", "nequi", "daviplata", "card"];
      if (!validTypes.includes(type)) return res.status(400).json({ message: "Tipo de pago inválido" });

      const method = await storage.addPaymentMethod({
        username, type, label, details: details || null, isDefault: isDefault ? "true" : "false",
      });
      res.status(201).json({ method });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/payment-methods/:id", async (req, res, next) => {
    try {
      const { username } = req.body || {};
      if (!username) return res.status(400).json({ message: "username requerido" });
      await storage.removePaymentMethod(req.params.id, username);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/payment-methods/:id/default", async (req, res, next) => {
    try {
      const { username } = req.body || {};
      if (!username) return res.status(400).json({ message: "username requerido" });
      await storage.setDefaultPaymentMethod(req.params.id, username);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ── USER PROFILE (público) ────────────────────────────────────────────────

  app.get("/api/users/:username/profile", async (req, res, next) => {
    try {
      const profile = await storage.getUserProfile(req.params.username);
      if (!profile) return res.status(404).json({ message: "Usuario no encontrado" });
      res.json({ profile });
    } catch (err) {
      next(err);
    }
  });

  // ── Módulo Taxi ────────────────────────────────────────────────────────────
  registerTaxiRoutes(app);

  return httpServer;
}
