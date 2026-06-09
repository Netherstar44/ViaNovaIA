import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { createServer } from "http";
import router from "./routes";
import { logger } from "./lib/logger";
import { registerRoutes } from "./routes/app.routes.js";

const app: Express = express();

app.set("trust proxy", true);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: Request) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: Response) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

import session from "express-session";

// Session middleware (required for Google OAuth)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { sameSite: "lax", secure: false },
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

const httpServer = createServer(app);

registerRoutes(httpServer, app).catch((err: any) => {
  logger.error({ err }, "Failed to register routes");
});

export default app;
export { httpServer };
