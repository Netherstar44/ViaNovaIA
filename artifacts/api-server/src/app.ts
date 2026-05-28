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

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? [process.env.CLIENT_URL || "", "http://localhost", "capacitor://localhost"]
    : true,
  credentials: true
}));
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  logger.warn("SESSION_SECRET env var is not set. Set it in Replit secrets for secure cookie signing.");
}
app.use(cookieParser(sessionSecret || undefined));
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: false }));

app.use("/api", router);

const httpServer = createServer(app);

registerRoutes(httpServer, app).catch((err: any) => {
  logger.error({ err }, "Failed to register routes");
});

export default app;
export { httpServer };
