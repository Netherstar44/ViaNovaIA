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
} from "../../shared/taxi.schema.js";

export function registerTaxiRoutes(app: Express): void {

  // ── MIGRACIÓN TAXI (idempotente) ───────────────────────────────────────────
  // GET /api/taxi/migrate
  // Crea tablas rides, earnings, withdrawals y columnas en users
  app.get("/api/taxi/migrate", async (req, res, next) => {
    try {
      const db = getDb();

      await db.execute(sql`
        DO $$ BEGIN
          CREATE TYPE ride_status AS ENUM
            ('pending','accepted','in_progress','completed','cancelled');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);

      await db.execute(sql`
        DO $$ BEGIN
          CREATE TYPE withdrawal_status AS ENUM ('pending','completed','rejected');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS rides (
          id           varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          traveler_username text NOT NULL,
          taxi_username     text,
          origin_lat        text NOT NULL,
          origin_lng        text NOT NULL,
          origin_address    text,
          destination_lat   text NOT NULL,
          destination_lng   text NOT NULL,
          destination_address text NOT NULL,
          fare          real NOT NULL,
          distance_km   real,
          status        ride_status NOT NULL DEFAULT 'pending',
          started_at    timestamp,
          completed_at  timestamp,
          created_at    timestamp DEFAULT now()
        );
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS earnings (
          id           varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          taxi_username text NOT NULL,
          ride_id       varchar NOT NULL REFERENCES rides(id),
          amount        real NOT NULL,
          created_at    timestamp DEFAULT now()
        );
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS withdrawals (
          id           varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          taxi_username text NOT NULL,
          amount        real NOT NULL,
          status        withdrawal_status NOT NULL DEFAULT 'pending',
          bank_account  text,
          notes         text,
          created_at    timestamp DEFAULT now(),
          updated_at    timestamp DEFAULT now()
        );
      `);

      // Columnas opcionales en users
      for (const stmt of [
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT false`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_type text`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS plate text`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS taxi_lat text`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS taxi_lng text`,
      ]) {
        await db.execute(sql.raw(stmt));
      }

      // ── Nuevas tablas: user_roles, reviews, payment_methods ────────────────

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_roles (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id varchar NOT NULL REFERENCES users(id),
          role user_role NOT NULL,
          business_name text,
          business_address text,
          business_phone text,
          vehicle_type text,
          plate text,
          phone text,
          created_at timestamp DEFAULT now(),
          UNIQUE(user_id, role)
        );
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS reviews (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          ride_id varchar NOT NULL,
          author_username text NOT NULL,
          target_username text NOT NULL,
          rating integer NOT NULL,
          comment text,
          author_role text NOT NULL,
          created_at timestamp DEFAULT now(),
          UNIQUE(ride_id, author_username)
        );
      `);

      await db.execute(sql`
        DO $$ BEGIN
          CREATE TYPE payment_method_type AS ENUM ('cash', 'nequi', 'daviplata', 'card');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS payment_methods (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          username text NOT NULL,
          type payment_method_type NOT NULL,
          label text NOT NULL,
          details text,
          is_default text DEFAULT 'false',
          created_at timestamp DEFAULT now()
        );
      `);

      // Auto-migrate: create user_roles entries for existing users with non-default roles
      await db.execute(sql`
        INSERT INTO user_roles (user_id, role)
        SELECT id, role FROM users WHERE role IS NOT NULL
        ON CONFLICT (user_id, role) DO NOTHING;
      `);

      // Ensure all users have at least 'traveler' in user_roles
      await db.execute(sql`
        INSERT INTO user_roles (user_id, role)
        SELECT id, 'traveler'::user_role FROM users
        ON CONFLICT (user_id, role) DO NOTHING;
      `);

      res.json({ ok: true, message: "Migración taxi + multi-rol completada exitosamente" });
    } catch (err) {
      next(err);
    }
  });

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
      next(err);
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
      res.json({ rides: pending });
    } catch (err) {
      next(err);
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
      res.json({ ride });
    } catch (err) {
      next(err);
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

      res.json({ ride: updated });
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
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
      res.json({ activeRide: activeRide ?? null, history });
    } catch (err) {
      next(err);
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
      res.json({ activeRide: activeRide ?? null, history });
    } catch (err) {
      next(err);
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
      next(err);
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
      res.json({ drivers });
    } catch (err) {
      next(err);
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
      res.json({ profile });
    } catch (err) {
      next(err);
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
      next(err);
    }
  });
}
