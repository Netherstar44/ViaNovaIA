// ─────────────────────────────────────────────────────────────────────────────
// server/routes/taxi.routes.ts
// Registrar en server/routes.ts con: registerTaxiRoutes(httpServer, app)
// ─────────────────────────────────────────────────────────────────────────────

import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "../storage.js";
import {
  createRide,
  getRideById,
  getPendingRides,
  getActiveTaxiRide,
  getTaxiRideHistory,
  getActiveTravelerRide,
  getTravelerRideHistory,
  updateRideStatus,
  createEarning,
  getEarningsByTaxi,
  getTotalEarned,
  getTotalWithdrawn,
  createWithdrawal,
  getWithdrawalsByTaxi,
  setTaxiAvailability,
  getTaxiProfile,
  getAvailableTaxis,
} from "../taxi.storage.js";
import {
  insertRideSchema,
  patchRideSchema,
  taxiStatusSchema,
  withdrawSchema,
} from "../shared/taxi.schema.js";

export function registerTaxiRoutes(app: Express): void {

  // REMOVED: /api/taxi/migrate was a public DDL endpoint — disabled for security.

  // ── RIDES ──────────────────────────────────────────────────────────────────

  /**
   * POST /api/rides
   * Crea una nueva solicitud de viaje (viajero)
   * Body: InsertRide
   */
  app.post("/api/rides", async (req, res, next) => {
    try {
      const parsed = insertRideSchema.parse(req.body);
      const ride = await createRide(parsed);
      res.status(201).json({ ride });
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      return next(err);
    }
  });

  /**
   * GET /api/rides/nearby
   * Solicitudes pendientes que ve el taxista
   * Query: taxiUsername (para excluir rides que ya rechazó — futuro)
   */
  app.get("/api/rides/nearby", async (req, res, next) => {
    try {
      const pending = await getPendingRides();
      return res.json({ rides: pending });
    } catch (err) {
      return next(err);
    }
  });

  /**
   * GET /api/rides/:id
   * Detalle de un ride específico (para la vista del mapa)
   */
  app.get("/api/rides/:id", async (req, res, next) => {
    try {
      const ride = await getRideById(req.params.id);
      if (!ride) return res.status(404).json({ message: "Viaje no encontrado" });
      return res.json({ ride });
    } catch (err) {
      return next(err);
    }
  });

  /**
   * PATCH /api/rides/:id
   * Actualiza el estado de un viaje
   * Body: { status: "accepted"|"in_progress"|"completed"|"cancelled", taxiUsername? }
   *
   * Flujo de estados:
   *  pending → accepted  (taxi acepta)
   *  accepted → in_progress (taxi inicia el viaje)
   *  in_progress → completed (taxi finaliza)
   *  any → cancelled
   */
  app.patch("/api/rides/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, taxiUsername } = patchRideSchema.parse(req.body);

      const ride = await getRideById(id);
      if (!ride) return res.status(404).json({ message: "Viaje no encontrado" });

      // Validar transición legal de estado
      const transitions: Record<string, string[]> = {
        pending:     ["accepted", "cancelled"],
        accepted:    ["in_progress", "cancelled"],
        in_progress: ["completed", "cancelled"],
        completed:   [],
        cancelled:   [],
      };
      if (!transitions[ride.status]?.includes(status)) {
        return res.status(400).json({
          message: `No se puede cambiar de '${ride.status}' a '${status}'`,
        });
      }

      const extra: any = {};
      if (status === "accepted" && taxiUsername) extra.taxiUsername = taxiUsername;
      if (status === "in_progress") extra.startedAt = new Date();
      if (status === "completed")   extra.completedAt = new Date();

      const updated = await updateRideStatus(id, status as any, extra);

      // Al completar → registrar ganancia automáticamente
      if (status === "completed" && updated.taxiUsername) {
        await createEarning(updated.taxiUsername, updated.id, updated.fare);
      }

      return res.json({ ride: updated });
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      return next(err);
    }
  });

  /**
   * GET /api/rides/taxi/:username
   * Viaje activo del taxista + historial
   */
  app.get("/api/rides/taxi/:username", async (req, res, next) => {
    try {
      const { username } = req.params;
      const [activeRide, history] = await Promise.all([
        getActiveTaxiRide(username),
        getTaxiRideHistory(username),
      ]);
      return res.json({ activeRide: activeRide ?? null, history });
    } catch (err) {
      return next(err);
    }
  });

  /**
   * GET /api/rides/traveler/:username
   * Viaje activo del viajero + historial reciente
   */
  app.get("/api/rides/traveler/:username", async (req, res, next) => {
    try {
      const { username } = req.params;
      const [activeRide, history] = await Promise.all([
        getActiveTravelerRide(username),
        getTravelerRideHistory(username),
      ]);
      return res.json({ activeRide: activeRide ?? null, history });
    } catch (err) {
      return next(err);
    }
  });

  // ── TAXI STATUS ────────────────────────────────────────────────────────────

  /**
   * PATCH /api/taxi/status
   * Cambia disponibilidad del taxista
   * Body: { username: string, isAvailable: boolean }
   */
  app.patch("/api/taxi/status", async (req, res, next) => {
    try {
      const { username, isAvailable } = taxiStatusSchema.parse(req.body);
      const { lat, lng } = req.body || {};
      await setTaxiAvailability(username, isAvailable, lat != null ? Number(lat) : undefined, lng != null ? Number(lng) : undefined);
      res.json({ ok: true, isAvailable });
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      return next(err);
    }
  });

  /**
   * GET /api/taxi/nearby
   * Taxistas disponibles para el radar
   * Query: lat, lng (opcionales, para futura geolocalización real)
   */
  app.get("/api/taxi/nearby", async (req, res, next) => {
    try {
      const drivers = await getAvailableTaxis();
      return res.json({ drivers });
    } catch (err) {
      return next(err);
    }
  });

  /**
   * GET /api/taxi/profile/:username
   * Perfil del taxista (isAvailable, vehicleType, plate, phone)
   */
  app.get("/api/taxi/profile/:username", async (req, res, next) => {
    try {
      const profile = await getTaxiProfile(req.params.username);
      if (!profile) return res.status(404).json({ message: "Taxista no encontrado" });
      return res.json({ profile });
    } catch (err) {
      return next(err);
    }
  });

  // ── EARNINGS ───────────────────────────────────────────────────────────────

  /**
   * GET /api/taxi/earnings/:username
   * Resumen financiero completo del taxista
   * Devuelve: totalEarned, totalWithdrawn, available, earnings[], withdrawals[]
   */
  app.get("/api/taxi/earnings/:username", async (req, res, next) => {
    try {
      const { username } = req.params;
      const [totalEarned, totalWithdrawn, earningsList, withdrawalsList] =
        await Promise.all([
          getTotalEarned(username),
          getTotalWithdrawn(username),
          getEarningsByTaxi(username),
          getWithdrawalsByTaxi(username),
        ]);

      // Disponible = ganado - todo lo retirado (incluyendo pending para no sobregirar)
      const totalPendingWithdrawn = withdrawalsList
        .filter((w) => w.status === "pending")
        .reduce((acc, w) => acc + w.amount, 0);

      const available = totalEarned - totalWithdrawn - totalPendingWithdrawn;

      res.json({
        totalEarned,
        totalWithdrawn,
        totalPendingWithdrawn,
        available: Math.max(0, available),
        earnings: earningsList,
        withdrawals: withdrawalsList,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── WITHDRAWALS ────────────────────────────────────────────────────────────

  /**
   * POST /api/taxi/withdraw
   * Solicita un retiro de ganancias
   * Body: { taxiUsername, amount, bankAccount, notes? }
   */
  app.post("/api/taxi/withdraw", async (req, res, next) => {
    try {
      const data = withdrawSchema.parse(req.body);
      const { taxiUsername, amount } = data;

      // Verificar saldo disponible
      const [totalEarned, totalWithdrawn, allWithdrawals] = await Promise.all([
        getTotalEarned(taxiUsername),
        getTotalWithdrawn(taxiUsername),
        getWithdrawalsByTaxi(taxiUsername),
      ]);
      const pending = allWithdrawals
        .filter((w) => w.status === "pending")
        .reduce((acc, w) => acc + w.amount, 0);
      const available = totalEarned - totalWithdrawn - pending;

      if (amount > available) {
        return res.status(400).json({
          message: `Saldo insuficiente. Disponible: $${available.toLocaleString("es-CO")}`,
        });
      }

      const withdrawal = await createWithdrawal({
        taxiUsername,
        amount,
        bankAccount: data.bankAccount,
        notes: data.notes,
      });

      res.status(201).json({ withdrawal });
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      return next(err);
    }
  });
}
