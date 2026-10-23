import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "../server/routes/index.js";
import { ensureUserSchema } from "../server/analytics.js";
import { assertSecurityConfig, getSessionSecret } from "../server/config.js";
import { applyHttpSecurity } from "../server/http-security.js";
import { requestLogger, logServerError } from "../server/observability.js";
import { csrfProtection } from "../server/security.js";

assertSecurityConfig();

const app = express();

applyHttpSecurity(app);
app.use(cookieParser(getSessionSecret()));
app.use(csrfProtection);
app.use(requestLogger);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "2mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "256kb" }));

// Columnas añadidas después de la creación de la base de datos. Se ejecuta una
// sola vez por isolate y evita depender de una migración manual en Vercel.
app.use("/api", async (_req, _res, next) => {
  try {
    await ensureUserSchema();
    next();
  } catch (err) {
    next(err);
  }
});

// La espera es necesaria: si una petición llega antes de montar las rutas,
// Express respondería 404 en el arranque en frío.
await registerRoutes(app);

// Mismo comportamiento que server/app.ts: nunca devolver el HTML de la SPA
// como respuesta de una ruta /api inexistente.
app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Endpoint no encontrado" });
});

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) logServerError(err, (req as any).requestId);
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "El archivo excede el tamaño máximo permitido" });
  }
  const message = process.env.NODE_ENV === "production" && status >= 500
    ? "Error interno del servidor"
    : err.message || "Internal Server Error";
  res.status(status).json({ message });
});

export default app;
