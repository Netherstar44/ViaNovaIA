import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { createServer } from "http";
import router from "./routes";
import { logger } from "./lib/logger";
import { registerRoutes } from "./routes/app.routes.js";

const app: Express = express();

app.set("trust proxy", true);

// ── CORS ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.NGROK_URL,
  process.env.CLIENT_URL,
  "http://localhost:5000",
  "http://localhost:3000",
].filter(Boolean) as string[];

app.use(
  cors({
    origin(requestOrigin, cb) {
      if (!requestOrigin) return cb(null, true);
      if (allowedOrigins.some((o) => requestOrigin.startsWith(o))) {
        return cb(null, true);
      }
      cb(new Error(`CORS: origin "${requestOrigin}" not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 86400,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

import session from "express-session";

// Session middleware (required for Google OAuth)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    },
  })
);

// Security headers — CSP configurado para permitir Google OAuth correctamente
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https://www.gstatic.com https://apis.google.com https://accounts.google.com",
      "frame-src https://accounts.google.com",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https://*.cloudinary.com https://lh3.googleusercontent.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' http://localhost:* ws://localhost:* https://accounts.google.com https://oauth2.googleapis.com https://openidconnect.googleapis.com https://*.cloudinary.com",
      "worker-src 'self' blob:",
    ].join("; ")
  );
  // Evita que el navegador adivine el MIME type (reduce warnings de consola)
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Reduce la información de referrer enviada a terceros
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use("/api", router);

// ── Global error handler — oculta detalles internos en producción ───────
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";
  logger.error({ err, status }, "Unhandled error");
  res.status(status).json({
    message: isProduction ? "Error interno del servidor" : (err.message || "Error interno"),
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

const httpServer = createServer(app);

registerRoutes(httpServer, app).catch((err: any) => {
  logger.error({ err }, "Failed to register routes");
});

export default app;
export { httpServer };
