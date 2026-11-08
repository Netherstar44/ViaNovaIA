import "dotenv/config";
import { createExpressServer, log } from "./app.js";
import { serveStatic } from "./static.js";
import { releaseExpiredLocks } from "./routes/bookings.routes.js";
import { purgeExpiredIdentities } from "./identity/retention.js";
import { configureFaceEngine } from "./identity/routes.js";
import { VladFaceEngine } from "./identity/face-engine.js";

(async () => {
  if (process.versions.node.split(".")[0] === "22") configureFaceEngine(new VladFaceEngine());
  const { app, httpServer } = await createExpressServer();

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);
  }

  // Libera reservas temporales que el cliente abandonó. Sin este job, el
  // inventario quedaría bloqueado para siempre tras un cierre de pestaña.
  // `unref` evita que el timer mantenga vivo el proceso en tests o apagados.
  const lockTimer = setInterval(() => {
    releaseExpiredLocks().catch((err: any) => {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[bookings] no se pudieron liberar reservas vencidas:", err?.message || err);
      }
    });
  }, 60_000);
  lockTimer.unref();
  if (process.env.BIOMETRIC_ENCRYPTION_KEY) {
    const identityTimer = setInterval(() => {
      purgeExpiredIdentities().catch(() => console.warn("[identity] No se pudo completar la retención; revisar configuración local."));
    }, 5 * 60_000);
    identityTimer.unref();
    httpServer.once("close", () => clearInterval(identityTimer));
  }

  const port = Number.parseInt(process.env.PORT || "5000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT inválido: ${process.env.PORT}`);
  }
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port} (0.0.0.0)`);
  });
})();
