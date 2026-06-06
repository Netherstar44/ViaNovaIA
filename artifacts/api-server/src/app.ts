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

// Content Security Policy (allows Google auth iframe scripts)
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com; frame-src https://accounts.google.com; img-src 'self' data: https://*.cloudinary.com; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:5000 https://accounts.google.com;"
  );
  next();
});
app.use("/api", router);

const httpServer = createServer(app);

registerRoutes(httpServer, app).catch((err: any) => {
  logger.error({ err }, "Failed to register routes");
});

export default app;
export { httpServer };
