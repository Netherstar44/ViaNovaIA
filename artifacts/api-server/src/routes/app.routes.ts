import "dotenv/config";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, getDb } from "../storage.js";
import { registerTaxiRoutes } from "./taxi.routes.js";
import { bookingsRouter } from "./bookings.routes.js";
import { socialRouter } from "./social.routes.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import { insertServiceSchema, insertCommentSchema, comments, users } from "../shared/schema.js";
import { and, eq, sql as drizzleSql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendWelcomeEmail, sendPasswordResetEmail, sendPasswordChangedEmail, sendCustomEmail } from "../mailer.js";
import rateLimit from "express-rate-limit";
// Filtro básico de groserías (reemplaza 'bad-words' por problemas de ESM)
class Filter {
  private words: string[] = [];
  addWords(...words: string[]) {
    this.words.push(...words.map(w => w.toLowerCase()));
  }
  isProfane(text: string) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return this.words.some(word => lowerText.includes(word));
  }
  clean(text: string) {
    if (!text) return text;
    let result = text;
    this.words.forEach(word => {
      const regex = new RegExp(word, 'gi');
      result = result.replace(regex, '*'.repeat(word.length));
    });
    return result;
  }
}

// Instanciar filtro de groserías y añadir palabras en español
const profanityFilter = new Filter();
profanityFilter.addWords('puta', 'mierda', 'malparido', 'gonorrea', 'hijueputa', 'pendejo', 'imbecil', 'marica', 'maricón', 'zorra', 'perra');

// Limiter para endpoints sensibles
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 peticiones por ventana
  message: { message: "Demasiados intentos. Por favor, inténtalo de nuevo más tarde." }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // 20 subidas por hora
  message: { message: "Límite de subida de archivos alcanzado." }
});

// Configuración estricta de multer para seguridad
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // Limitar a 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'model/gltf-binary'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de archivo no soportado o inválido"));
    }
  }
});
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
  // Convertir roleChangedAt null a undefined para no disparar redirect de nuevo rol
  // Solo debe ser null cuando el backend específicamente quiere indicar "usuario nuevo sin rol"
  // Para usuarios existentes (creados antes del sistema de roles) usamos undefined
  if (safe.roleChangedAt === null && safe.role && safe.role !== 'traveler') {
    safe.roleChangedAt = undefined;
  }
  return safe;
}

// Configuración de JWT
if (!process.env.JWT_SECRET) {
  console.warn("[WARN] JWT_SECRET env var is not set — using a random ephemeral secret. Set JWT_SECRET in Replit secrets for persistent sessions.");
}
const JWT_SECRET = process.env.JWT_SECRET || require("crypto").randomBytes(32).toString("hex");
const isProd = process.env.NODE_ENV === "production";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" as const : "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
};

function generateToken(user: any) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

// Middleware de Autenticación
export function requireAuth(req: any, res: any, next: any) {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No autenticado" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Sesión inválida o expirada" });
  }
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

import { Server as SocketIOServer } from "socket.io";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  configureCloudinary();

  // Setup Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    // Join a ride room to receive ride-specific events
    socket.on("join_ride", (rideId: string) => {
      socket.join(`ride:${rideId}`);
    });

    socket.on("leave_ride", (rideId: string) => {
      socket.leave(`ride:${rideId}`);
    });

    // Taxi GPS: Receive location from driver, broadcast to ride room
    socket.on("taxi_location_update", (data: { rideId: string; lat: number; lng: number; taxiUsername: string }) => {
      if (data.rideId) {
        io.to(`ride:${data.rideId}`).emit("taxi_location", data);
      } else {
        io.emit("taxi_location", data);
      }
    });

    // In-ride chat message
    socket.on("ride_chat_message", (data: { rideId: string; from: string; text: string; role: string }) => {
      io.to(`ride:${data.rideId}`).emit("ride_chat_message", {
        ...data,
        at: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {});
  });

  // Make io accessible to routes
  app.set("io", io);
  
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/social", socialRouter);

  // Health
  app.get("/api/nuke-local232", async (req, res, next) => {
    try {
      const db = getDb();
      await db.execute(drizzleSql`DELETE FROM products WHERE name ILIKE '%Local 232%' OR name ILIKE '%ABELARDO%'`);
      res.json({ nuked: true, message: "Local 232 obliterado para siempre." });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/seed-60", async (req, res, next) => {
    try {
      const db = getDb();
      await db.execute(drizzleSql`DELETE FROM services WHERE name ILIKE '%test%' OR name ILIKE '%prueba%' OR name ILIKE '%hola%' OR name ILIKE '%mi negocio%' OR name ILIKE '%all stars%' OR name ILIKE '%perfect%' OR name = 'asdf'`);
      
      const newServices = [];
      const cats = ['hotel', 'restaurant', 'recreation', 'transport'];
      const images: Record<string, string[]> = {
        hotel: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80', 'https://images.unsplash.com/photo-1551882547-ff40c0d5c9f4?w=800&q=80', 'https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?w=800&q=80', 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80', 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80'],
        restaurant: ['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80', 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&q=80', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80', 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80', 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80'],
        recreation: ['https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=800&q=80', 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80', 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=800&q=80', 'https://images.unsplash.com/photo-1510853675132-58241c941e4f?w=800&q=80', 'https://images.unsplash.com/photo-1565214975484-3cfa9e56f914?w=800&q=80'],
        transport: ['https://images.unsplash.com/photo-1600320254374-ce2d293c324e?w=800&q=80', 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80', 'https://images.unsplash.com/photo-1490650404312-a2175773bbf5?w=800&q=80', 'https://images.unsplash.com/photo-1506645292803-579c17d4ba6a?w=800&q=80', 'https://images.unsplash.com/photo-1612808264703-a1286c12ba3c?w=800&q=80']
      };
      const names: Record<string, string[]> = {
        hotel: ['Grand Plaza', 'Eco Resort', 'Boutique Hotel', 'Royal Suites', 'Sunset Inn', 'Mountain View', 'City Center', 'Oasis Resort', 'Paradise Lodge', 'Emerald Hotel', 'Riverside Inn', 'Golden Palace', 'Silver Sands', 'Azure Retreat', 'Crystal Cove'],
        restaurant: ['La Casona', 'Sabor Auténtico', 'El Fogón', 'Bistro 44', 'GastroBar', 'Cielo Rojo', 'Mesa de Autor', 'El Jardín', 'Terraza Grill', 'Mar y Tierra', 'Fuego Mágico', 'Sabores', 'Rincón Gourmet', 'La Piazza', 'Café Colonial'],
        recreation: ['Parque Nacional', 'Reserva', 'Museo de Arte', 'Tour Histórico', 'Aventura', 'Sendero Mágico', 'Aguas Termales', 'Observatorio', 'Jardín Botánico', 'Ruinas Antiguas', 'Safari Local', 'Buceo Profundo', 'Escalada Libre', 'Paseo en Globo', 'Ruta del Café'],
        transport: ['Taxi Express', 'Transporte VIP', 'Shuttle Aeropuerto', 'Tour Privado', 'Viajes Seguros', 'Ruta Rápida', 'Movilidad Plus', 'Traslados Premium', 'City Tour Bus', 'Transporte Ejecutivo', 'Van Familiar', 'Auto Clásico', 'Moto Taxi', 'Limusina Elite', 'Bote Turístico']
      };
      const descs = ['La mejor experiencia garantizada para ti y tu familia. Reservas disponibles todo el año.', 'Descubre algo nuevo y emocionante. Perfecto para escapadas de fin de semana.', 'Calidad, confort y atención de primera clase. Tu satisfacción es nuestra prioridad.', 'Disfruta de momentos inolvidables en el mejor ambiente de la ciudad.', 'Una opción económica y segura para disfrutar al máximo sin preocupaciones.'];
      
      for (const cat of cats) {
        for (let i = 0; i < 15; i++) {
          newServices.push({
            provider_username: 'vianova_admin',
            category: cat,
            name: names[cat][i] + ' ' + (Math.floor(Math.random() * 100) + 1),
            description: descs[Math.floor(Math.random() * descs.length)],
            image_url: `https://picsum.photos/seed/${cat}${i}/800/600`,
            location_lat: (Math.random() * (5.0 - 3.0) + 3.0).toFixed(4),
            location_lng: (Math.random() * (-73.0 - -75.0) + -75.0).toFixed(4),
            rating: Math.floor(Math.random() * 2) + 4,
            price: Math.floor(Math.random() * 500000) + 20000,
            currency: 'COP'
          });
        }
      }
      
      for (const s of newServices) {
        await db.execute(drizzleSql`INSERT INTO services (provider_username, category, name, description, image_url, location_lat, location_lng, rating, price, currency) VALUES (${s.provider_username}, ${s.category}, ${s.name}, ${s.description}, ${s.image_url}, ${s.location_lat}, ${s.location_lng}, ${s.rating}, ${s.price}, ${s.currency})`);
      }
      
      res.json({ success: true, message: "Cleaned DB and seeded 60 services." });
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Register (always traveler) ────────────────────────────────────────
  app.post("/api/auth/register", authLimiter, async (req, res, next) => {
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
      const verificationToken = crypto.randomInt(100000, 999999).toString();

      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name: name || username,
        email,
        role: "traveler",
        verificationToken,
      });

      sendWelcomeEmail(email, name || username).catch((err) => {
        console.error("Error enviando email de bienvenida:", err.message);
      });

      // Send verification email
      sendCustomEmail({
        to: email,
        subject: "Verifica tu correo en VIANova",
        html: `<p>Hola ${name || username},</p><p>Tu código de verificación es: <strong>${verificationToken}</strong></p>`
      }).catch(console.error);

      const token = generateToken(user);
      res.cookie("token", token, COOKIE_OPTIONS);
      res.json({ user: sanitizeUser(user), token });
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Verify Email ────────────────────────────────────────────────────
  app.post("/api/auth/verify-email", async (req, res, next) => {
    try {
      const { username, token } = req.body || {};
      if (!username || !token) return res.status(400).json({ message: "username y token requeridos" });

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      if (user.isVerified === "true") {
        return res.json({ message: "El correo ya está verificado" });
      }

      if (user.verificationToken !== token) {
        return res.status(400).json({ message: "Código inválido" });
      }

      const db = getDb();
      await db.execute(drizzleSql`UPDATE users SET is_verified = 'true', verification_token = NULL WHERE id = ${user.id}`);
      
      res.json({ message: "Correo verificado exitosamente" });
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Login ─────────────────────────────────────────────────────────────
  app.post("/api/auth/login", authLimiter, async (req, res, next) => {
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

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Contraseña incorrecta" });
      }

      const token = generateToken(user);
      res.cookie("token", token, COOKIE_OPTIONS);
      res.json({ user: sanitizeUser(user), token });
    } catch (err) {
      next(err);
    }
  });

  // ─── AUTH: Me & Logout ──────────────────────────────────────────────────────
  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserByUsername(req.user.username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
      res.json({ user: sanitizeUser(user) });
    } catch (err) {
      res.status(500).json({ message: "Error interno" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token", COOKIE_OPTIONS);
    res.json({ message: "Sesión cerrada" });
  });

  // ─── AUTH: Google Mobile (ID Token verification) ────────────────────────────
  app.post("/api/auth/google/mobile", async (req, res, next) => {
    try {
      const { idToken } = req.body || {};
      if (!idToken) {
        return res.status(400).json({ message: "idToken es obligatorio" });
      }

      // Verify the Google ID token by calling Google's tokeninfo endpoint
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      if (!googleRes.ok) {
        return res.status(401).json({ message: "Token de Google inválido o expirado" });
      }

      const googleUser = await googleRes.json() as any;
      const email = googleUser.email;
      const name = googleUser.name || googleUser.given_name || email.split("@")[0];

      if (!email) {
        return res.status(400).json({ message: "No se pudo obtener el email de Google" });
      }

      // Check if user already exists by email
      let user = await storage.getUserByEmail(email);

      if (!user) {
        // Create new user with Google profile
        const username = email.split("@")[0] + "_g" + Math.floor(Math.random() * 1000);
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const hashedPassword = await hashPassword(randomPassword);

        user = await storage.createUser({
          username,
          password: hashedPassword,
          name,
          email,
          role: "traveler",
        });
      }

      const token = generateToken(user);
      res.cookie("token", token, COOKIE_OPTIONS);
      res.json({ user: sanitizeUser(user), token });
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
      let user = await storage.getUserByEmail(email);
      if (!user) {
        const hashed = await hashPassword("google_oauth_" + crypto.randomUUID());
        const username = "user_" + crypto.randomBytes(4).toString("hex");
        user = await storage.createUser({
          username: username,
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

      const token = generateToken(user);
      res.cookie("token", token, COOKIE_OPTIONS);

      const clientUrl = getBaseUrl(req);
      const payload = encodeURIComponent(JSON.stringify({
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role || "traveler",
        roleChangedAt: user.roleChangedAt || null,
      }));
      res.redirect(`${clientUrl}/login?google_user=${payload}&token=${encodeURIComponent(token)}`);
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
  app.post("/api/upload", uploadLimiter, upload.single("file"), async (req, res, next) => {
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
      const { category, city } = req.query as { category?: string; city?: string };
      if (!category) return res.status(400).json({ message: "category required" });
      let list = await storage.listServicesByCategory(category);
      if (city && city !== "all") {
        list = list.filter((s: any) => (s.city ?? "Neiva") === city);
      }
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
      const cleanContent = profanityFilter.clean(parsed.content);
      const created = await storage.insertComment({ ...parsed, content: cleanContent });
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
      const db = getDb();

      await db.delete(comments).where(and(eq(comments.id, id), eq(comments.authorUsername, username)));
      res.json({ success: true, message: "Comentario eliminado" });
    } catch (err) {
      next(err);
    }
  });

  // ─── Migration endpoint ────────────────────────────────────────────────────
  app.get("/api/migrate", async (req, res, next) => {
    try {
      const db = getDb();


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

      // Add 'translator' to user_role enum if not already present
      await db.execute(drizzleSql`
        DO $$ BEGIN
          ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'translator';
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // Create chat_messages table for persistent chatbot history (isolated by userId)
      await db.execute(drizzleSql`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role text NOT NULL CHECK (role IN ('user', 'assistant')),
          content text NOT NULL,
          image text,
          created_at timestamp DEFAULT now()
        );
      `);

      // Create index for fast per-user queries
      await db.execute(drizzleSql`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id, created_at DESC);
      `);

      res.json({ success: true, message: "Tablas y columnas migradas exitosamente (roles, email, tokens, role_changed_at, translator, chat_messages)" });
    } catch (err) {
      next(err);
    }
  });

  // Groq chat endpoints
  app.get("/api/chat/history", async (req, res, next) => {
    try {
      const username = req.query.username as string;
      if (!username) return res.status(401).json({ message: "Usuario no autenticado" });

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const conversation = await storage.upsertConversation(user.id);
      // getMessages already returns chronological order (reversed inside storage)
      const msgs = await storage.getMessages(conversation.id, 60);
      // Normalize to the shape the RideHistory page expects
      const normalized = msgs.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        image: m.metadata?.image ?? null,
        createdAt: m.createdAt,
      }));
      res.json(normalized);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/chat", authLimiter, async (req, res, next) => {
    try {
      let { userId, username, message, name, location, history, destinationCity, language } = req.body || {};
      if (!message) return res.status(400).json({ message: "message required" });

      message = profanityFilter.clean(message);

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
      // Save message to DB for persistence (long-term log)
      await storage.addMessage(conversation.id, "user", message, { location });

      // ── RAG: Detectar ciudad, intención y construir contexto de BD real ──────
      const COLOMBIAN_CITIES = ["cali","neiva","medellín","medellin","cartagena","santa marta","bogotá","bogota","bucaramanga","barranquilla","manizales","pereira","armenia","ibagué","ibague","villavicencio","pasto","montería","monteria","leticia","tunja","popayán","popayan","florencia","riohacha","sincelejo","valledupar","quibdó","quibdo"];
      const allText = [message, ...((Array.isArray(history) ? history : []).map((m: any) => m.content || ""))].join(" ").toLowerCase();

      // Opción explícita tiene prioridad
      const detectedCity = destinationCity
        ? destinationCity.toLowerCase()
        : (COLOMBIAN_CITIES.find(c => allText.includes(c)) ?? "");

      // Detectar intención de búsqueda (keywords sin ciudad)
      const SEARCH_KEYWORDS = ["hotel","restaurante","hospedaje","comer","dormir","actividad","taxi","transporte","tour","recreación","recreacion","piscina","habitación","mesa","reservar"];
      const hasSearchIntent = SEARCH_KEYWORDS.some(kw => allText.includes(kw));

      let servicesContext = "";

      try {
        const db = getDb();

        // ─── 1. Servicios reales de la tabla services (perfil proveedor) ─────
        let cityServices: any[] = [];
        if (detectedCity) {
          cityServices = await storage.listServicesByCity(detectedCity);
        } else if (hasSearchIntent) {
          // Si busca algo pero no dijo ciudad, traemos los mejores 15 globales
          const rows = await db.execute(drizzleSql`
            SELECT * FROM services ORDER BY rating DESC NULLS LAST LIMIT 15
          `);
          cityServices = (rows as any).rows ?? (rows as any) ?? [];
        }

        // ─── 2. Productos del Marketplace (tabla products) ────────────────────
        let marketProducts: any[] = [];
        if (detectedCity) {
          const rows = await db.execute(drizzleSql`
            SELECT p.*, u.name as provider_name
            FROM products p
            JOIN users u ON u.id = p.provider_id
            WHERE p.is_active = true
            LIMIT 20
          `);
          marketProducts = (rows as any).rows ?? (rows as any) ?? [];
        } else if (hasSearchIntent) {
          const rows = await db.execute(drizzleSql`
            SELECT p.*, u.name as provider_name
            FROM products p
            JOIN users u ON u.id = p.provider_id
            WHERE p.is_active = true
            ORDER BY p.created_at DESC
            LIMIT 12
          `);
          marketProducts = (rows as any).rows ?? (rows as any) ?? [];
        }

        // ─── 3. Construir el bloque de contexto ───────────────────────────────
        const cityLabel = detectedCity ? detectedCity.toUpperCase() : "NUESTRA PLATAFORMA";

        const fmtService = (category: string, emoji: string) =>
          cityServices
            .filter((s: any) => s.category === category)
            .map((s: any) => `  ${emoji} **${s.name}** (@${s.provider_username ?? s.providerUsername}) — $${Number(s.price ?? 0).toLocaleString("es-CO")} COP ⭐${s.rating ?? "N/A"} — ${(s.description ?? "").substring(0, 100)}`)
            .join("\n");

        const fmtProduct = (roleCategory: string, emoji: string) =>
          marketProducts
            .filter((p: any) => p.role_category === roleCategory)
            .map((p: any) => `  ${emoji} **${p.name}** (por ${p.provider_name ?? p.provider_username}) — $${Number(p.price ?? 0).toLocaleString("es-CO")} ${p.currency ?? "COP"} — ${(p.description ?? "").substring(0, 100)}`)
            .join("\n");

        const serviceLines = [
          fmtService("hotel", "🏨"),
          fmtService("restaurant", "🍽️"),
          fmtService("recreation", "🎭"),
          fmtService("transport", "🚕"),
        ].filter(l => l.trim()).join("\n");

        const productLines = [
          fmtProduct("hotel", "🏨"),
          fmtProduct("restaurant", "🍽️"),
          fmtProduct("recreation", "🎭"),
          fmtProduct("taxi", "🚕"),
        ].filter(l => l.trim()).join("\n");

        if (serviceLines || productLines) {
          servicesContext = `\n\n---\n**CATÁLOGO REAL DE VIANOBA EN ${cityLabel} — USA SOLO ESTOS DATOS:**\n`;
          if (serviceLines) servicesContext += `\n### Servicios de Proveedores:\n${serviceLines}`;
          if (productLines) servicesContext += `\n\n### Productos en el Marketplace:\n${productLines}`;
          servicesContext += `\n\n> ⚠️ INSTRUCCIÓN CRÍTICA: Solo puedes recomendar los servicios y productos listados arriba. Nunca inventes hoteles, restaurantes o precios que no estén en esta lista. Si no hay datos, indica amablemente que aún no hay proveedores registrados para ese destino en VIANova.`;
        }

      } catch (ragErr) {
        // RAG es no-bloqueante: si falla, el bot responde sin contexto
        console.error("[RAG] Error al consultar BD:", ragErr);
      }

      const sysPrompt = `Eres VIANova, un conserje inteligente y experto planificador de viajes para Colombia y el mundo. Tu tono es amable, profesional y directo. Eres el asistente oficial de la plataforma VIANova.

**REGLAS CRÍTICAS DE COMPORTAMIENTO:**
1. **NO saludes en cada mensaje.** Saluda ÚNICAMENTE en el primer mensaje.
2. **LEE SIEMPRE el historial.** Si el usuario indicó su ciudad de origen, destino, presupuesto o preferencias — **BAJO NINGUNA CIRCUNSTANCIA VUELVAS A PREGUNTARLOS**. Asúmelos como válidos y avanza.
3. **DESTINO Y UBICACIÓN:** Si el usuario menciona una ciudad (ej. "voy a cartagena", "estoy en bogotá"), ESE ES SU DESTINO. NO lo preguntes de nuevo. Pasa directo a recomendar servicios.
4. **Responde de forma concisa.** Máximo 3-4 párrafos.
5. **USA SOLO los servicios y productos del catálogo real** listado al final de este prompt. NUNCA inventes establecimientos, precios o nombres.
6. **Si no hay datos** en el catálogo para ese destino, dilo honestamente: "Aún no tenemos proveedores registrados en VIANova para [ciudad], pero puedo ayudarte con recomendaciones generales."

**PROCESO DE PLANIFICACIÓN DE VIAJES:**
1. **Recolección:** Identifica presupuesto, destino, duración. Si el usuario ya mencionó el destino, NUNCA lo vuelvas a preguntar.
2. **Propuesta:** Diseña un plan usando los servicios reales de VIANova del catálogo.
3. **Confirmación:** Pregunta si el usuario aprueba el plan.
4. **Cronograma:** Si el usuario ACEPTA, genera las solicitudes en este formato exacto:

### SOLICITUDES DE RESERVA:
- [HOTEL]: Hospedaje del [Fecha inicio] al [Fecha fin] para [Nombre] en [Hotel sugerido] — $[precio] COP — @[username]
- [RESTAURANTE]: [Tipo de comida] para [Nombre] el [Fecha] a las [Hora] en [Restaurante] — $[precio] COP — @[username]
- [TAXI]: Recorrido de [Origen] a [Destino] para [Nombre] el [Fecha] a las [Hora] con [Servicio] — $[precio] COP — @[username]
- [RECREACION]: [Actividad] para [Nombre] el [Fecha] — $[precio] COP — @[username]
- [TRADUCTOR]: (Solo si el destino requiere otro idioma) Guía/traductor en [Idioma] para [Nombre].${servicesContext}`;

      // ── Usar historial del frontend — IMPORTANTE: Groq requiere que empiece con 'user' ──
      // Filter to user/assistant only, then drop any leading 'assistant' messages
      // because the OpenAI/Groq API requires the first non-system message to be 'user'.
      const rawHistory: { role: "user" | "assistant"; content: string }[] = Array.isArray(history)
        ? history.filter((m: any) => m.role === "user" || m.role === "assistant")
        : [];
      const firstUserIdx = rawHistory.findIndex(m => m.role === "user");
      const historyMessages = firstUserIdx >= 0 ? rawHistory.slice(firstUserIdx) : [];
      const turnCount = historyMessages.length;

      const groqKey = process.env.GROQ_API_KEY;
      const completion = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: sysPrompt },
            name ? { role: "system", content: `Nombre del usuario: ${name}` } : undefined,
            // GPS location: authoritative when provided (map works = GPS works)
            location
              ? { role: "system", content: `Ubicación GPS del usuario (CONFIABLE): lat=${(location as any).lat}, lng=${(location as any).lng}. Usa esta ubicación para tus recomendaciones.` }
              : { role: "system", content: `Ubicación GPS: No disponible. No asumas ninguna ciudad hasta que el usuario la indique.` },
            // Dynamic turn counter to suppress greetings on ongoing conversations
            turnCount > 0
              ? { role: "system", content: `Esta conversación ya lleva ${turnCount} mensajes. NO saludes al usuario. Continúa el hilo directamente usando el historial.` }
              : undefined,
            // Language override
            language
              ? { role: "system", content: `You MUST respond entirely in this language code: ${language}. Translate your personality, tone, and all output (including the reservation formats) to this language.` }
              : undefined,
            ...historyMessages,
            { role: "user", content: message },
          ].filter(Boolean),
          temperature: 0.3,
          max_tokens: 1024,
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

  // ── Confirmar reservas y notificar a proveedores ───────────────────────────
  app.post("/api/bookings/confirm", async (req, res, next) => {
    try {
      const { bookings, travelerName, travelerEmail } = req.body || {};
      if (!Array.isArray(bookings) || bookings.length === 0) {
        return res.status(400).json({ message: "bookings array required" });
      }

      const results: { type: string; provider: string; status: string }[] = [];

      for (const booking of bookings) {
        const { type, providerUsername, details } = booking;
        if (!providerUsername) { results.push({ type, provider: "unknown", status: "skipped" }); continue; }

        // Look up provider email
        const providerUser = await storage.getUserByUsername(providerUsername);
        if (!providerUser?.email) { results.push({ type, provider: providerUsername, status: "no_email" }); continue; }

        // Insert into notifications table (In-App notification)
        try {
          await storage.insertNotification({
            providerUsername,
            travelerUsername: travelerName || "Viajero Anónimo",
            type,
            details,
          });
        } catch (dbErr) {
          console.error("Failed to insert notification", dbErr);
        }

        // Send email to provider
        try {
          await sendCustomEmail({
            to: providerUser.email,
            subject: `🧳 Nueva Solicitud de Reserva VIANova — ${travelerName || "Turista"}`,
            html: `
              <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
                <h2 style="color:#22c55e;">🌍 Nueva Reserva en VIANova</h2>
                <p>Tienes una nueva solicitud de <strong>${travelerName || "un viajero"}</strong>.</p>
                <div style="background:#1e293b;padding:16px;border-radius:8px;margin:16px 0;">
                  <p><strong>Tipo:</strong> ${type}</p>
                  <p><strong>Detalles:</strong> ${details}</p>
                  ${travelerEmail ? `<p><strong>Contacto del viajero:</strong> ${travelerEmail}</p>` : ""}
                </div>
                <p style="color:#94a3b8;font-size:12px;">Responde directamente a este correo para confirmar la reserva.</p>
                <p style="color:#94a3b8;font-size:12px;margin-top:16px;">También puedes ver esta notificación en tu panel de VIANova.</p>
              </div>
            `,
          });
          results.push({ type, provider: providerUsername, status: "sent" });
        } catch (mailErr: any) {
          results.push({ type, provider: providerUsername, status: `mail_error: ${mailErr.message}` });
        }
      }

      res.json({ message: "Reservas procesadas", results });
    } catch (err) {
      next(err);
    }
  });

  // ── Endpoints de Notificaciones In-App ────────────────────────────────────
  app.get("/api/notifications", async (req, res, next) => {
    try {
      const username = req.query.username as string;
      if (!username) return res.status(401).json({ message: "No autenticado" });
      const notifications = await storage.getProviderNotifications(username);
      res.json(notifications);
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res, next) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.sendStatus(200);
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
      const { role, businessName, businessAddress, businessPhone, vehicleType, plate, phone, languages } = req.body || {};
      if (!role) return res.status(400).json({ message: "role es obligatorio" });

      const validRoles = ["traveler", "hotel", "restaurant", "recreation", "taxi", "translator"];
      if (!validRoles.includes(role)) return res.status(400).json({ message: "Rol inválido" });

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const roleRecord = await storage.addUserRole({
        userId: user.id,
        role,
        businessName: businessName || null,
        businessAddress: businessAddress || null,
        businessPhone: businessPhone || languages || null, // reuse businessPhone to store languages for translator
        vehicleType: vehicleType || null,
        plate: plate || null,
        phone: phone || null,
      });

      // If this is the first role or user wants to switch, also set active role
      const updated = await storage.setActiveRole(user.id, role);

      // Update vehicle data in users table if taxi
      if (role === "taxi" && (vehicleType || plate || phone)) {
        const db = getDb();
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
      const db = getDb();
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

  // ── USER PROFILE ──────────────────────────────────────────────────────────
  
  app.patch("/api/user/profile", authLimiter, async (req, res, next) => {
    try {
      const { username, name, bio, avatarUrl, city } = req.body || {};
      if (!username) return res.status(400).json({ message: "username requerido" });

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const db = getDb();
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (bio !== undefined) updates.bio = bio;
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
      if (city !== undefined) updates.city = city;

      const updatedRows = await db.update(users).set(updates).where(eq(users.id, user.id)).returning();
      res.json({ user: sanitizeUser(updatedRows[0]) });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/users/:username/profile", async (req, res, next) => {
    try {
      const profile = await storage.getUserProfile(req.params.username);
      if (!profile) return res.status(404).json({ message: "Usuario no encontrado" });
      res.json({ profile });
    } catch (err) {
      next(err);
    }
  });

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  
  app.get("/api/admin/stats", async (req, res, next) => {
    try {
      const db = getDb();
      // Simple aggregations for Admin Dashboard
      const usersRes = await db.execute(drizzleSql`SELECT COUNT(*) as c FROM users`);
      const providersRes = await db.execute(drizzleSql`SELECT COUNT(*) as c FROM users WHERE role != 'traveler' AND role != 'admin'`);
      const verifiedRes = await db.execute(drizzleSql`SELECT COUNT(*) as c FROM users WHERE is_verified = 'true'`);
      const lockedRes = await db.execute(drizzleSql`SELECT COUNT(*) as c FROM users WHERE lock_until > now()`);
      
      const logsRes = await db.execute(drizzleSql`
        SELECT id, username, failed_login_attempts as event, updated_at as timestamp 
        FROM users 
        WHERE failed_login_attempts > 3 
        ORDER BY updated_at DESC LIMIT 10
      `);

      res.json({
        totalUsers: Number(((usersRes as any).rows ?? usersRes)[0]?.c || 0),
        totalProviders: Number(((providersRes as any).rows ?? providersRes)[0]?.c || 0),
        verifiedUsers: Number(((verifiedRes as any).rows ?? verifiedRes)[0]?.c || 0),
        lockedAccounts: Number(((lockedRes as any).rows ?? lockedRes)[0]?.c || 0),
        logs: ((logsRes as any).rows ?? logsRes).map((l: any) => ({
          event: `Múltiples intentos de login fallidos (${l.event})`,
          username: l.username,
          timestamp: l.timestamp
        }))
      });
    } catch (err) {
      next(err);
    }
  });

  // ── E-COMMERCE: Productos y Órdenes ───────────────────────────────────────

  // GET /api/products?category=hotel&page=1&limit=12
  app.get("/api/products", async (req, res, next) => {
    try {
      const db = getDb();
      const category = req.query.category as string | undefined;
      const limit = Math.min(parseInt(String(req.query.limit || "12")), 50);
      const offset = parseInt(String(req.query.offset || "0"));

      const rows = await db.execute(drizzleSql`
        SELECT p.*, u.avatar_url, u.name AS provider_name
        FROM products p
        JOIN users u ON u.id = p.provider_id
        WHERE p.is_active = true
        ${category ? drizzleSql`AND p.role_category = ${category}` : drizzleSql``}
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      const products = (rows as any).rows ?? (rows as any) ?? [];

      const countRow = await db.execute(drizzleSql`
        SELECT COUNT(*) as total FROM products
        WHERE is_active = true
        ${category ? drizzleSql`AND role_category = ${category}` : drizzleSql``}
      `);
      const total = parseInt(((countRow as any).rows ?? (countRow as any))[0]?.total ?? "0");

      res.json({ products, total, hasMore: offset + limit < total });
    } catch (err) { next(err); }
  });

  // GET /api/products/provider/:username
  app.get("/api/products/provider/:username", async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db.execute(drizzleSql`
        SELECT p.*, 
               (SELECT json_agg(m ORDER BY m.sort_order ASC) 
                FROM media_assets m WHERE m.entity_id = p.id AND m.entity_type = 'product') AS media
        FROM products p
        WHERE p.provider_username = ${req.params.username}
        ORDER BY p.created_at DESC
      `);
      res.json({ products: (rows as any).rows ?? (rows as any) ?? [] });
    } catch (err) { next(err); }
  });

  // POST /api/products — create product with cover image
  app.post("/api/products", upload.single("coverImage"), async (req, res, next) => {
    try {
      configureCloudinary();
      const { username, name, description, price, currency, stock, roleCategory } = req.body || {};
      if (!username || !name || !price) {
        return res.status(400).json({ message: "username, name y price son obligatorios" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      let coverImage: string | null = null;
      if (req.file) {
        const result: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "vianova/products", quality: "auto:good" },
            (err, result) => err ? reject(err) : resolve(result)
          );
          stream.end(req.file!.buffer);
        });
        coverImage = result.secure_url;
      } else if (req.body.coverImage) {
        coverImage = req.body.coverImage;
      }

      const db = getDb();
      const inserted = await db.execute(drizzleSql`
        INSERT INTO products (provider_id, provider_username, role_category, name, description, price, currency, stock, cover_image)
        VALUES (${user.id}, ${username}, ${roleCategory || user.role}, ${name}, ${description || null},
                ${parseFloat(price)}, ${currency || 'COP'}, ${parseInt(stock || '-1')}, ${coverImage})
        RETURNING *
      `);
      const product = ((inserted as any).rows ?? (inserted as any))[0];
      res.json({ product });
    } catch (err) { next(err); }
  });

  // PATCH /api/products/:id — update product
  app.patch("/api/products/:id", upload.single("coverImage"), async (req, res, next) => {
    try {
      configureCloudinary();
      const { username, name, description, price, currency, stock, isActive } = req.body || {};
      if (!username) return res.status(400).json({ message: "username requerido" });

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      let coverImage: string | undefined = undefined;
      if (req.file) {
        const result: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "vianova/products", quality: "auto:good" },
            (err, result) => err ? reject(err) : resolve(result)
          );
          stream.end(req.file!.buffer);
        });
        coverImage = result.secure_url;
      }

      const db = getDb();
      await db.execute(drizzleSql`
        UPDATE products SET
          name        = COALESCE(${name || null}, name),
          description = COALESCE(${description || null}, description),
          price       = COALESCE(${price ? parseFloat(price) : null}, price),
          currency    = COALESCE(${currency || null}, currency),
          stock       = COALESCE(${stock != null ? parseInt(stock) : null}, stock),
          is_active   = COALESCE(${isActive != null ? isActive === 'true' : null}, is_active),
          cover_image = COALESCE(${coverImage || null}, cover_image),
          updated_at  = now()
        WHERE id = ${req.params.id} AND provider_id = ${user.id}
      `);
      const row = await db.execute(drizzleSql`SELECT * FROM products WHERE id = ${req.params.id}`);
      res.json({ product: ((row as any).rows ?? (row as any))[0] });
    } catch (err) { next(err); }
  });

  // DELETE /api/products/:id
  app.delete("/api/products/:id", async (req, res, next) => {
    try {
      const { username } = req.body || {};
      if (!username) return res.status(400).json({ message: "username requerido" });
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const db = getDb();
      await db.execute(drizzleSql`DELETE FROM products WHERE id = ${req.params.id} AND provider_id = ${user.id}`);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // POST /api/products/:id/media — add extra media asset (360, video, 3D)
  app.post("/api/products/:id/media", upload.single("file"), async (req, res, next) => {
    try {
      configureCloudinary();
      const { mediaType, caption } = req.body || {};
      if (!req.file && !req.body.url) return res.status(400).json({ message: "file o url requerido" });

      let url = req.body.url;
      if (req.file) {
        const resourceType = (mediaType || "").includes("video") ? "video" : "image";
        const result: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "vianova/products/media", resource_type: resourceType, quality: "auto" },
            (err, result) => err ? reject(err) : resolve(result)
          );
          stream.end(req.file!.buffer);
        });
        url = result.secure_url;
      }

      const db = getDb();
      const countRow = await db.execute(drizzleSql`SELECT COUNT(*) as c FROM media_assets WHERE entity_id = ${req.params.id}`);
      const sortOrder = parseInt(((countRow as any).rows ?? (countRow as any))[0]?.c ?? "0");

      const inserted = await db.execute(drizzleSql`
        INSERT INTO media_assets (entity_id, entity_type, url, type, caption, sort_order)
        VALUES (${req.params.id}, 'product', ${url}, ${mediaType || 'image'}, ${caption || null}, ${sortOrder})
        RETURNING *
      `);
      res.json({ asset: ((inserted as any).rows ?? (inserted as any))[0] });
    } catch (err) { next(err); }
  });

  // DELETE /api/products/:id/media/:assetId
  app.delete("/api/products/:id/media/:assetId", async (req, res, next) => {
    try {
      const db = getDb();
      await db.execute(drizzleSql`DELETE FROM media_assets WHERE id = ${req.params.assetId} AND entity_id = ${req.params.id}`);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // POST /api/orders — create order
  app.post("/api/orders", async (req, res, next) => {
    try {
      const { buyerUsername, productId, quantity, notes } = req.body || {};
      if (!buyerUsername || !productId) return res.status(400).json({ message: "buyerUsername y productId requeridos" });

      const buyer = await storage.getUserByUsername(buyerUsername);
      if (!buyer) return res.status(404).json({ message: "Usuario no encontrado" });

      const db = getDb();
      const prodRow = await db.execute(drizzleSql`SELECT * FROM products WHERE id = ${productId} AND is_active = true`);
      const product = ((prodRow as any).rows ?? (prodRow as any))[0];
      if (!product) return res.status(404).json({ message: "Producto no encontrado o no disponible" });

      const qty = Math.max(1, parseInt(quantity || "1"));
      const total = (parseFloat(product.price) * qty).toFixed(2);

      const inserted = await db.execute(drizzleSql`
        INSERT INTO orders (buyer_id, product_id, quantity, unit_price, total, notes)
        VALUES (${buyer.id}, ${productId}, ${qty}, ${product.price}, ${total}, ${notes || null})
        RETURNING *
      `);
      const order = ((inserted as any).rows ?? (inserted as any))[0];

      // Notify provider via email (non-blocking)
      const provider = await storage.getUserByUsername(product.provider_username);
      if (provider?.email) {
        const { sendCustomEmail } = await import("../mailer.js");
        sendCustomEmail({
          to: provider.email,
          subject: `Nueva orden: ${product.name}`,
          html: `<p>@${buyerUsername} ha solicitado <strong>${qty}x ${product.name}</strong> — Total: $${total} ${product.currency}.</p>`,
        }).catch(() => {});
      }

      res.json({ order });
    } catch (err) { next(err); }
  });

  // GET /api/orders/buyer/:username
  app.get("/api/orders/buyer/:username", async (req, res, next) => {
    try {
      const buyer = await storage.getUserByUsername(req.params.username);
      if (!buyer) return res.status(404).json({ message: "Usuario no encontrado" });
      const db = getDb();
      const rows = await db.execute(drizzleSql`
        SELECT o.*, p.name AS product_name, p.cover_image, p.provider_username
        FROM orders o JOIN products p ON p.id = o.product_id
        WHERE o.buyer_id = ${buyer.id}
        ORDER BY o.created_at DESC LIMIT 50
      `);
      res.json({ orders: (rows as any).rows ?? (rows as any) ?? [] });
    } catch (err) { next(err); }
  });

  // GET /api/orders/provider/:username
  app.get("/api/orders/provider/:username", async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db.execute(drizzleSql`
        SELECT o.*, p.name AS product_name, p.cover_image, u.username AS buyer_username
        FROM orders o
        JOIN products p ON p.id = o.product_id
        JOIN users u ON u.id = o.buyer_id
        WHERE p.provider_username = ${req.params.username}
        ORDER BY o.created_at DESC LIMIT 50
      `);
      res.json({ orders: (rows as any).rows ?? (rows as any) ?? [] });
    } catch (err) { next(err); }
  });

  // PATCH /api/orders/:id/status
  app.patch("/api/orders/:id/status", async (req, res, next) => {
    try {
      const { status } = req.body || {};
      if (!status) return res.status(400).json({ message: "status requerido" });
      const db = getDb();
      await db.execute(drizzleSql`
        UPDATE orders SET status = ${status}, updated_at = now() WHERE id = ${req.params.id}
      `);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // POST /api/stripe/create-checkout-session
  app.post("/api/stripe/create-checkout-session", async (req, res, next) => {
    try {
      const { productId, quantity, buyerUsername } = req.body || {};
      if (!productId || !buyerUsername) return res.status(400).json({ message: "Faltan parámetros" });

      if (!process.env.STRIPE_SECRET_KEY) {
        // Dummy fallback si no hay API key configurada
        return res.json({ url: "/products?success=true&dummy=1" });
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      const db = getDb();
      const prodRow = await db.execute(drizzleSql`SELECT * FROM products WHERE id = ${productId}`);
      const product = ((prodRow as any).rows ?? (prodRow as any))[0];
      if (!product) return res.status(404).json({ message: "Producto no encontrado" });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: product.currency.toLowerCase(),
            product_data: {
              name: product.name,
              images: product.cover_image ? [product.cover_image] : [],
            },
            unit_amount: Math.round(parseFloat(product.price) * 100), // en centavos
          },
          quantity: Math.max(1, parseInt(quantity || "1")),
        }],
        mode: "payment",
        success_url: `${process.env.CLIENT_URL || "http://localhost:5000"}/products?success=true`,
        cancel_url: `${process.env.CLIENT_URL || "http://localhost:5000"}/products?canceled=true`,
        metadata: {
          productId,
          buyerUsername,
          quantity: String(quantity || 1)
        }
      });

      res.json({ url: session.url });
    } catch (err) { next(err); }
  });

  // POST /api/stripe/webhook
  app.post("/api/stripe/webhook", async (req, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(400).send("Stripe not configured");
      }
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      const sig = req.headers["stripe-signature"] as string;
      // req.rawBody is provided by express.json verification inside server/index.ts
      let event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, process.env.STRIPE_WEBHOOK_SECRET);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as any;
        const meta = session.metadata;
        if (meta?.productId && meta?.buyerUsername) {
          // Process order creation after payment
          const buyer = await storage.getUserByUsername(meta.buyerUsername);
          const db = getDb();
          const prodRow = await db.execute(drizzleSql`SELECT * FROM products WHERE id = ${meta.productId}`);
          const product = ((prodRow as any).rows ?? (prodRow as any))[0];

          if (buyer && product) {
            const qty = parseInt(meta.quantity || "1");
            const total = (parseFloat(product.price) * qty).toFixed(2);
            await db.execute(drizzleSql`
              INSERT INTO orders (buyer_id, product_id, quantity, unit_price, total, status, payment_intent)
              VALUES (${buyer.id}, ${product.id}, ${qty}, ${product.price}, ${total}, 'paid', ${session.payment_intent})
            `);

            // Check if provider has an email
            const provider = await storage.getUserByUsername(product.provider_username);
            if (provider?.email) {
              const { sendCustomEmail } = await import("../mailer.js");
              sendCustomEmail({
                to: provider.email,
                subject: `Pago Confirmado: ${product.name}`,
                html: `<p>@${meta.buyerUsername} ha pagado por <strong>${qty}x ${product.name}</strong> — Total: $${total} ${product.currency}.</p>`
              }).catch(() => {});
            }
          }
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error("Webhook Error:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  // ── VIASOCIAL — Red Social ─────────────────────────────────────────────────


  // GET /api/social/feed?cursor=<created_at>&limit=10
  // Cursor-based pagination (much faster than OFFSET for large datasets)
  app.get("/api/social/feed", async (req, res, next) => {
    try {
      const db = getDb();
      const limit = Math.min(parseInt(String(req.query.limit || "10")), 20);
      const cursor = req.query.cursor as string | undefined; // ISO timestamp

      const rows = await db.execute(drizzleSql`
        SELECT
          p.id, p.username, p.caption, p.media_url, p.media_type,
          p.likes_count, p.comments_count, p.created_at,
          u.avatar_url
        FROM social_posts p
        JOIN users u ON u.id = p.user_id
        ${cursor ? drizzleSql`WHERE p.created_at < ${new Date(cursor)}` : drizzleSql``}
        ORDER BY p.created_at DESC
        LIMIT ${limit + 1}
      `);

      const posts: any[] = (rows as any).rows ?? (rows as any) ?? [];
      const hasMore = posts.length > limit;
      const result = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore ? result[result.length - 1].created_at : null;

      res.json({ posts: result, nextCursor, hasMore });
    } catch (err) { next(err); }
  });

  // POST /api/social/posts — create post with optional media
  app.post("/api/social/posts", upload.single("media"), async (req, res, next) => {
    try {
      configureCloudinary();
      const { username, caption, mediaType } = req.body || {};
      if (!username) return res.status(400).json({ message: "username requerido" });
      
      const cleanCaption = profanityFilter.clean(caption || "");

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      let mediaUrl: string | null = null;
      let finalMediaType = mediaType || "image";

      if (req.file) {
        const resourceType = (mediaType || "").includes("video") ? "video" : "image";
        const uploadResult: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "vianova/social", resource_type: resourceType, quality: "auto" },
            (err, result) => err ? reject(err) : resolve(result)
          );
          stream.end(req.file!.buffer);
        });
        mediaUrl = uploadResult.secure_url;
      } else if (req.body.mediaUrl) {
        mediaUrl = req.body.mediaUrl;
      }

      const db = getDb();
      const inserted = await db.execute(drizzleSql`
        INSERT INTO social_posts (user_id, username, caption, media_url, media_type)
        VALUES (${user.id}, ${username}, ${cleanCaption}, ${mediaUrl}, ${finalMediaType})
        RETURNING *
      `);
      const post = ((inserted as any).rows ?? (inserted as any))[0];
      res.json({ post });
    } catch (err) { next(err); }
  });

  // DELETE /api/social/posts/:id
  app.delete("/api/social/posts/:id", async (req, res, next) => {
    try {
      const { username } = req.body || {};
      if (!username) return res.status(400).json({ message: "username requerido" });
      const db = getDb();
      await db.execute(drizzleSql`
        DELETE FROM social_posts WHERE id = ${req.params.id} AND username = ${username}
      `);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // POST /api/social/posts/:id/like  { username }
  app.post("/api/social/posts/:id/like", async (req, res, next) => {
    try {
      const { username } = req.body || {};
      if (!username) return res.status(400).json({ message: "username requerido" });
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const db = getDb();
      // Upsert like (ignore if already liked)
      await db.execute(drizzleSql`
        INSERT INTO social_likes (post_id, user_id) VALUES (${req.params.id}, ${user.id})
        ON CONFLICT DO NOTHING
      `);
      await db.execute(drizzleSql`
        UPDATE social_posts SET likes_count = likes_count + 1 WHERE id = ${req.params.id}
      `);
      const row = await db.execute(drizzleSql`SELECT likes_count FROM social_posts WHERE id = ${req.params.id}`);
      const count = ((row as any).rows ?? (row as any))[0]?.likes_count ?? 0;
      res.json({ likes: count });
    } catch (err) { next(err); }
  });

  // DELETE /api/social/posts/:id/like  { username }
  app.delete("/api/social/posts/:id/like", async (req, res, next) => {
    try {
      const { username } = req.body || {};
      if (!username) return res.status(400).json({ message: "username requerido" });
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const db = getDb();
      const result = await db.execute(drizzleSql`
        DELETE FROM social_likes WHERE post_id = ${req.params.id} AND user_id = ${user.id}
      `);
      const deleted = (result as any).rowCount ?? 0;
      if (deleted > 0) {
        await db.execute(drizzleSql`
          UPDATE social_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ${req.params.id}
        `);
      }
      const row = await db.execute(drizzleSql`SELECT likes_count FROM social_posts WHERE id = ${req.params.id}`);
      const count = ((row as any).rows ?? (row as any))[0]?.likes_count ?? 0;
      res.json({ likes: count });
    } catch (err) { next(err); }
  });

  // GET /api/social/posts/:id/likes/check?username=xxx
  app.get("/api/social/posts/:id/likes/check", async (req, res, next) => {
    try {
      const username = req.query.username as string;
      if (!username) return res.json({ liked: false });
      const user = await storage.getUserByUsername(username);
      if (!user) return res.json({ liked: false });
      const db = getDb();
      const row = await db.execute(drizzleSql`
        SELECT 1 FROM social_likes WHERE post_id = ${req.params.id} AND user_id = ${user.id} LIMIT 1
      `);
      const liked = ((row as any).rows ?? (row as any)).length > 0;
      res.json({ liked });
    } catch (err) { next(err); }
  });

  // GET /api/social/posts/:id/comments
  app.get("/api/social/posts/:id/comments", async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db.execute(drizzleSql`
        SELECT c.id, c.username, c.content, c.created_at, u.avatar_url
        FROM social_comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.post_id = ${req.params.id}
        ORDER BY c.created_at ASC
        LIMIT 50
      `);
      res.json({ comments: (rows as any).rows ?? (rows as any) ?? [] });
    } catch (err) { next(err); }
  });

  // POST /api/social/posts/:id/comments  { username, content }
  app.post("/api/social/posts/:id/comments", async (req, res, next) => {
    try {
      const { username, content } = req.body || {};
      if (!username || !content) return res.status(400).json({ message: "username y content requeridos" });
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const db = getDb();
      await db.execute(drizzleSql`
        INSERT INTO social_comments (post_id, user_id, username, content)
        VALUES (${req.params.id}, ${user.id}, ${username}, ${content})
      `);
      await db.execute(drizzleSql`
        UPDATE social_posts SET comments_count = comments_count + 1 WHERE id = ${req.params.id}
      `);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // POST /api/social/follow  { followerUsername, followingUsername }
  app.post("/api/social/follow", async (req, res, next) => {
    try {
      const { followerUsername, followingUsername } = req.body || {};
      if (!followerUsername || !followingUsername) return res.status(400).json({ message: "Ambos usernames requeridos" });
      const follower = await storage.getUserByUsername(followerUsername);
      const following = await storage.getUserByUsername(followingUsername);
      if (!follower || !following) return res.status(404).json({ message: "Usuario no encontrado" });

      const db = getDb();
      await db.execute(drizzleSql`
        INSERT INTO social_followers (follower_id, following_id)
        VALUES (${follower.id}, ${following.id})
        ON CONFLICT DO NOTHING
      `);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // DELETE /api/social/follow  { followerUsername, followingUsername }
  app.delete("/api/social/follow", async (req, res, next) => {
    try {
      const { followerUsername, followingUsername } = req.body || {};
      if (!followerUsername || !followingUsername) return res.status(400).json({ message: "Ambos usernames requeridos" });
      const follower = await storage.getUserByUsername(followerUsername);
      const following = await storage.getUserByUsername(followingUsername);
      if (!follower || !following) return res.status(404).json({ message: "Usuario no encontrado" });

      const db = getDb();
      await db.execute(drizzleSql`
        DELETE FROM social_followers WHERE follower_id = ${follower.id} AND following_id = ${following.id}
      `);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // GET /api/social/posts/user/:username — user's own posts
  app.get("/api/social/posts/user/:username", async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db.execute(drizzleSql`
        SELECT p.*, u.avatar_url
        FROM social_posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.username = ${req.params.username}
        ORDER BY p.created_at DESC
        LIMIT 30
      `);
      res.json({ posts: (rows as any).rows ?? (rows as any) ?? [] });
    } catch (err) { next(err); }
  });

  // ── DIRECT MESSAGES ───────────────────────────────────────────────────────

  // GET /api/dm/conversations/:username — list of recent conversations
  app.get("/api/dm/conversations/:username", async (req, res, next) => {
    try {
      const db = getDb();
      const { username } = req.params;
      const rows = await db.execute(drizzleSql`
        SELECT
          CASE WHEN from_username = ${username} THEN to_username ELSE from_username END AS other_username,
          MAX(created_at) AS last_time,
          SUM(CASE WHEN to_username = ${username} AND is_read = false THEN 1 ELSE 0 END) AS unread_count,
          (SELECT content FROM direct_messages dm2
            WHERE (dm2.from_username = ${username} AND dm2.to_username = CASE WHEN dm.from_username = ${username} THEN dm.to_username ELSE dm.from_username END)
               OR (dm2.to_username = ${username} AND dm2.from_username = CASE WHEN dm.from_username = ${username} THEN dm.to_username ELSE dm.from_username END)
            ORDER BY dm2.created_at DESC LIMIT 1) AS last_message
        FROM direct_messages dm
        WHERE from_username = ${username} OR to_username = ${username}
        GROUP BY other_username
        ORDER BY last_time DESC
        LIMIT 50
      `);
      res.json({ conversations: (rows as any).rows ?? rows ?? [] });
    } catch (err) { next(err); }
  });

  // GET /api/dm/:username/:other — messages between two users
  app.get("/api/dm/:username/:other", async (req, res, next) => {
    try {
      const db = getDb();
      const { username, other } = req.params;
      const rows = await db.execute(drizzleSql`
        SELECT * FROM direct_messages
        WHERE (from_username = ${username} AND to_username = ${other})
           OR (from_username = ${other} AND to_username = ${username})
        ORDER BY created_at ASC
        LIMIT 200
      `);
      // Mark received as read
      await db.execute(drizzleSql`
        UPDATE direct_messages SET is_read = true
        WHERE to_username = ${username} AND from_username = ${other} AND is_read = false
      `);
      res.json({ messages: (rows as any).rows ?? rows ?? [] });
    } catch (err) { next(err); }
  });

  // POST /api/dm/send — send a direct message
  app.post("/api/dm/send", async (req, res, next) => {
    try {
      const { fromUsername, toUsername, content } = req.body || {};
      if (!fromUsername || !toUsername || !content?.trim()) {
        return res.status(400).json({ message: "fromUsername, toUsername y content requeridos" });
      }
      const db = getDb();
      const rows = await db.execute(drizzleSql`
        INSERT INTO direct_messages (from_username, to_username, content)
        VALUES (${fromUsername}, ${toUsername}, ${content.trim()})
        RETURNING *
      `);
      const msg = ((rows as any).rows ?? rows)[0];
      res.status(201).json({ message: msg });
    } catch (err) { next(err); }
  });

  // DELETE /api/social/posts/:id — delete own post
  app.delete("/api/social/posts/:id", async (req, res, next) => {
    try {
      const { username } = req.body || {};
      if (!username) return res.status(400).json({ message: "username requerido" });
      const db = getDb();
      await db.execute(drizzleSql`
        DELETE FROM social_posts WHERE id = ${req.params.id} AND username = ${username}
      `);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // GET /api/users/:username/activity — user activity history
  app.get("/api/users/:username/activity", async (req, res, next) => {
    try {
      const db = getDb();
      const { username } = req.params;
      const [posts, rides, bookings] = await Promise.all([
        db.execute(drizzleSql`
          SELECT 'post' as type, caption as title, created_at FROM social_posts
          WHERE username = ${username} ORDER BY created_at DESC LIMIT 5
        `),
        db.execute(drizzleSql`
          SELECT 'ride' as type, destination_address as title, created_at FROM rides
          WHERE traveler_username = ${username} ORDER BY created_at DESC LIMIT 5
        `),
        db.execute(drizzleSql`
          SELECT 'booking' as type, provider_username as title, created_at FROM bookings
          WHERE traveler_username = ${username} ORDER BY created_at DESC LIMIT 5
        `),
      ]);
      const all = [
        ...((posts as any).rows ?? []),
        ...((rides as any).rows ?? []),
        ...((bookings as any).rows ?? []),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
      res.json({ activity: all });
    } catch (err) { next(err); }
  });

  // ── Módulo Taxi ────────────────────────────────────────────────────────────
  registerTaxiRoutes(app);

  return httpServer;
}
