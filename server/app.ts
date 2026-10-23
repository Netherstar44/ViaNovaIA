import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes/index.js";
import { ensureUserSchema } from "./analytics.js";
import { assertSecurityConfig, getSessionSecret } from "./config.js";
import { applyHttpSecurity } from "./http-security.js";
import { requestLogger, logServerError } from "./observability.js";
import { csrfProtection } from "./security.js";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export async function createExpressServer(): Promise<{ app: Express; httpServer: Server }> {
  // Falla rápido si faltan secretos: nunca arrancar con valores por defecto.
  assertSecurityConfig();

  const app = express();
  const httpServer = createServer(app);

  applyHttpSecurity(app);

  app.use(cookieParser(getSessionSecret()));

  // CSRF antes de parsear cuerpos grandes: rechaza orígenes no permitidos.
  app.use(csrfProtection);
  app.use(requestLogger);

  app.use(
    express.json({
      limit: "2mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));

  // The Drizzle `users` model is shared by auth, profiles and every dashboard.
  // Lazily add columns introduced after the database was created so legacy and
  // fresh Cloudflare deployments behave identically without a manual migration.
  app.use("/api", async (_req, _res, next) => {
    try {
      await ensureUserSchema();
      next();
    } catch (err) {
      next(err);
    }
  });

  await registerRoutes(app);

  // API unknown routes must return JSON 404, never the SPA HTML fallback.
  // Without this, a removed endpoint such as the legacy POST /api/users replied
  // 200 with index.html and hid client/server contract mistakes.
  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Endpoint no encontrado" });
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) logServerError(err, (req as any).requestId);

    let message = err.message || "Internal Server Error";
    if (err?.code === "LIMIT_FILE_SIZE") {
      res.status(413);
      return res.json({ message: "El archivo excede el tamaño máximo permitido" });
    }
    if (status >= 500 && process.env.NODE_ENV === "production") {
      message = "Error interno del servidor";
    }
    return res.status(status).json({ message });
  });

  return { app, httpServer };
}
