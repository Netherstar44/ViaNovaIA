import { Router } from "express";
import { requireAuth, isPaymentMethodType, sanitizeSingleLine } from "../security.js";
import { paymentLimiter, writeLimiter } from "../rate-limits.js";
import { logSecurityEvent } from "../observability.js";
import {
  confirmSandboxPayment,
  createPaymentIntent,
  getPaymentConfig,
  getPaymentIntent,
  listPaymentIntents,
  processWompiEvent,
  verifyWompiEventChecksum,
} from "../payments.js";

export const paymentsRouter = Router();

// Nunca cachear URLs de checkout, referencias ni estados de pago.
paymentsRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  next();
});

paymentsRouter.get("/config", requireAuth, (_req, res) => {
  res.json(getPaymentConfig());
});

paymentsRouter.get("/intents", requireAuth, async (req: any, res, next) => {
  try {
    const tripId = req.query?.tripId
      ? sanitizeSingleLine(req.query.tripId, 80)
      : null;
    if (tripId && !/^[a-zA-Z0-9-]{8,80}$/.test(tripId)) {
      return res.status(400).json({ message: "Identificador de viaje inválido" });
    }
    const intents = await listPaymentIntents(req.user.username, { tripId });
    res.json({ intents });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post("/intents", requireAuth, paymentLimiter, async (req: any, res, next) => {
  try {
    const body = req.body || {};
    const method = String(body.method || "wompi");
    if (!isPaymentMethodType(method)) {
      return res.status(400).json({ message: "Método de pago inválido" });
    }

    const tripId = sanitizeSingleLine(body.tripId, 80);
    if (!tripId || !/^[a-zA-Z0-9-]{8,80}$/.test(tripId)) {
      return res.status(400).json({ message: "Selecciona una ruta válida para pagar" });
    }

    const idempotencyKey = body.idempotencyKey
      ? sanitizeSingleLine(body.idempotencyKey, 100)
      : null;

    const intent = await createPaymentIntent({
      userId: req.user.id,
      username: req.user.username,
      tripId,
      method,
      idempotencyKey,
    });
    res.status(201).json({ intent });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.get("/intents/:id", requireAuth, async (req: any, res, next) => {
  try {
    const id = sanitizeSingleLine(req.params.id, 80);
    if (!id || !/^[a-zA-Z0-9-]{8,80}$/.test(id)) {
      return res.status(400).json({ message: "Identificador de pago inválido" });
    }
    const intent = await getPaymentIntent(
      id,
      req.user.username,
      req.user.role === "admin",
    );
    res.json({ intent });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post("/intents/:id/sandbox-confirm", requireAuth, writeLimiter, async (req: any, res, next) => {
  try {
    const id = sanitizeSingleLine(req.params.id, 80);
    if (!id || !/^[a-zA-Z0-9-]{8,80}$/.test(id)) {
      return res.status(400).json({ message: "Identificador de pago inválido" });
    }
    const intent = await confirmSandboxPayment(id, req.user.username);
    res.json({ intent });
  } catch (error) {
    next(error);
  }
});

/**
 * Webhook de Wompi. Se registra fuera de CSRF porque lo llama la pasarela,
 * pero exige la firma SHA256 del evento. Sin secreto configurado no procesa.
 */
paymentsRouter.post("/wompi/webhook", async (req: any, res) => {
  try {
    const secret = String(process.env.WOMPI_EVENTS_SECRET ?? "").trim();
    if (!secret) {
      return res.status(503).json({ message: "Wompi events not configured" });
    }

    const checksum =
      req.get("X-Event-Checksum") ||
      req.get("x-event-checksum") ||
      req.body?.signature?.checksum;

    if (!verifyWompiEventChecksum(req.body, checksum, secret)) {
      logSecurityEvent("payment.webhook_invalid_signature", {
        ip: req.ip,
        event: sanitizeSingleLine(req.body?.event, 80),
      });
      return res.status(401).json({ message: "Invalid signature" });
    }

    const result = await processWompiEvent(req.body);
    return res.json(result);
  } catch (error: any) {
    logSecurityEvent("payment.webhook_error", { message: error?.message });
    // Wompi reintenta si no recibe 2xx; no exponer detalles internos.
    return res.status(500).json({ message: "Webhook error" });
  }
});
