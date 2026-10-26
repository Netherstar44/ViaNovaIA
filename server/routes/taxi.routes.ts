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
  isValidUsername,
  loadUserRoles,
  requireAuth,
  requireRole,
  requireSelfOrAdmin,
  sanitizeSingleLine,
} from "../security.js";
import {
  createRide,
  getRideById,
  getPendingRides,
  getActiveTaxiRide,
  getTaxiRideHistory,
  getActiveTravelerRide,
  getTravelerRideHistory,
  createEarning,
  getEarningsByTaxi,
  getTotalEarned,
  getTotalWithdrawn,
  createWithdrawalAtomic,
  getWithdrawalByIdempotencyKey,
  getWithdrawalsByTaxi,
  setTaxiAvailability,
  getTaxiProfile,
  getAvailableTaxis,
} from "../taxi.storage.js";
import {
  insertRideSchema,
  patchRideSchema,
  withdrawSchema,
} from "../../shared/taxi.schema.js";
import { writeLimiter } from "../rate-limits.js";
import { encryptSensitive, maskPaymentDetails } from "../security.js";

let taxiSchemaPromise: Promise<void> | null = null;

// Idempotent, lazy migration shared by every taxi/rides endpoint. Running the
// DDL on the first request keeps fresh databases (including Cloudflare deploys)
// working without a manual migration step.
async function ensureTaxiSchema(): Promise<void> {
  if (!taxiSchemaPromise) {
    taxiSchemaPromise = (async () => {
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

      // Column added after the first taxi release; keep legacy databases usable.
      await db.execute(sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS idempotency_key text`);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_idempotency_key_idx
        ON withdrawals (idempotency_key)
        WHERE idempotency_key IS NOT NULL
      `);

      // Ledger: una sola ganancia por viaje (idempotencia real).
      await db.execute(sql`
        DELETE FROM earnings a
        USING earnings b
        WHERE a.ride_id = b.ride_id AND a.ctid < b.ctid
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS earnings_ride_id_idx ON earnings (ride_id)
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
        SELECT u.id, u.role FROM users u
        WHERE u.role IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = u.role
          );
      `);

      // Ensure all users have at least 'traveler' in user_roles
      await db.execute(sql`
        INSERT INTO user_roles (user_id, role)
        SELECT u.id, 'traveler'::user_role FROM users u
        WHERE NOT EXISTS (
          SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'traveler'::user_role
        );
      `);
    })().catch((err) => {
      // Allow a later request to retry if the first migration attempt failed.
      taxiSchemaPromise = null;
      throw err;
    });
  }

  return taxiSchemaPromise;
}

async function ensureTaxiSchemaMiddleware(_req: any, _res: any, next: any) {
  try {
    await ensureTaxiSchema();
    next();
  } catch (err) {
    next(err);
  }
}

/** Nombre visible del usuario; no expone teléfono, placa ni otros datos. */
async function getUserDisplayName(username: string): Promise<string | null> {
  const result = await getDb().execute(
    sql`SELECT name FROM users WHERE username = ${username} LIMIT 1`
  );
  const row = (result as any).rows?.[0] ?? (result as any)[0];
  const name = row?.name;
  return typeof name === "string" ? name : null;
}

export function registerTaxiRoutes(app: Express): void {
  app.use("/api/taxi", ensureTaxiSchemaMiddleware);
  app.use("/api/rides", ensureTaxiSchemaMiddleware);

  // ── RIDES ──────────────────────────────────────────────────────────────────

  /**
   * POST /api/rides
   * Crea una nueva solicitud de viaje (viajero)
   * Body: InsertRide
   */
  app.post("/api/rides", requireAuth, async (req: any, res, next) => {
    try {
      const parsed = insertRideSchema.parse(req.body);
      const ride = await createRide({ ...parsed, travelerUsername: req.user.username });
      res.status(201).json({ ride });
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.issues[0].message });
      next(err);
    }
  });

  /**
   * GET /api/rides/nearby
   * Solicitudes pendientes que ve el taxista
   * Query: taxiUsername (para excluir rides que ya rechazó — futuro)
   */
  app.get("/api/rides/nearby", requireAuth, requireRole("taxi", "admin"), async (_req, res, next) => {
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
  app.get("/api/rides/:id", requireAuth, async (req: any, res, next) => {
    try {
      const ride = await getRideById(req.params.id);
      if (!ride) return res.status(404).json({ message: "Viaje no encontrado" });

      // Solo el viajero dueño, el taxista asignado o un admin.
      const isParticipant =
        ride.travelerUsername === req.user.username ||
        ride.taxiUsername === req.user.username;
      if (!isParticipant && req.user.role !== "admin") {
        return res.status(403).json({ message: "No puedes ver este viaje" });
      }

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
  app.patch("/api/rides/:id", requireAuth, async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const { status } = patchRideSchema.parse(req.body);

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

      // Autorización: el body nunca decide quién es el taxista.
      if (status === "accepted") {
        const roles: string[] = Array.isArray(req.userRoles)
          ? req.userRoles
          : await loadUserRoles(req.user.username);
        if (!roles.includes("taxi")) {
          return res.status(403).json({ message: "Solo un taxista puede aceptar viajes" });
        }
      }

      if (status === "in_progress" || status === "completed") {
        if (req.user.role !== "admin" && ride.taxiUsername !== req.user.username) {
          return res.status(403).json({ message: "Solo el taxista asignado puede actualizar este viaje" });
        }
      }

      if (status === "cancelled") {
        const travelerCanCancel =
          ride.travelerUsername === req.user.username &&
          (ride.status === "pending" || ride.status === "accepted");
        const taxiCanCancel =
          ride.taxiUsername === req.user.username &&
          (ride.status === "accepted" || ride.status === "in_progress");
        if (!travelerCanCancel && !taxiCanCancel && req.user.role !== "admin") {
          return res.status(403).json({ message: "No puedes cancelar este viaje" });
        }
      }

      // Actualización atómica: evita que dos taxistas acepten el mismo viaje
      // o que se complete dos veces y se dupliquen ganancias.
      const db = getDb();
      const now = new Date();
      let updated: any;
      if (status === "accepted") {
        const rows = await db.execute(sql`
          UPDATE rides
          SET status = 'accepted'::ride_status, taxi_username = ${req.user.username}
          WHERE id = ${id} AND status = 'pending'::ride_status AND taxi_username IS NULL
          RETURNING *
        `);
        updated = ((rows as any).rows ?? (rows as any))[0];
      } else if (status === "in_progress") {
        const rows = await db.execute(sql`
          UPDATE rides
          SET status = 'in_progress'::ride_status, started_at = ${now}
          WHERE id = ${id} AND status = 'accepted'::ride_status
            AND (taxi_username = ${req.user.username} OR ${req.user.role === "admin"})
          RETURNING *
        `);
        updated = ((rows as any).rows ?? (rows as any))[0];
      } else if (status === "completed") {
        const rows = await db.execute(sql`
          UPDATE rides
          SET status = 'completed'::ride_status, completed_at = ${now}
          WHERE id = ${id} AND status = 'in_progress'::ride_status
            AND (taxi_username = ${req.user.username} OR ${req.user.role === "admin"})
          RETURNING *
        `);
        updated = ((rows as any).rows ?? (rows as any))[0];
      } else {
        const rows = await db.execute(sql`
          UPDATE rides
          SET status = 'cancelled'::ride_status
          WHERE id = ${id} AND status = ${ride.status}::ride_status
          RETURNING *
        `);
        updated = ((rows as any).rows ?? (rows as any))[0];
      }

      if (!updated) {
        return res.status(409).json({ message: "El viaje cambió de estado. Recarga e inténtalo de nuevo." });
      }

      // Al completar → registrar ganancia automáticamente (idempotente).
      if (status === "completed" && updated.taxi_username) {
        await createEarning(updated.taxi_username, updated.id, updated.fare);
      }

      // El UPDATE crudo devuelve snake_case; el cliente espera camelCase.
      const rideResponse = {
        id: updated.id,
        travelerUsername: updated.traveler_username,
        taxiUsername: updated.taxi_username,
        originLat: updated.origin_lat,
        originLng: updated.origin_lng,
        originAddress: updated.origin_address,
        destinationLat: updated.destination_lat,
        destinationLng: updated.destination_lng,
        destinationAddress: updated.destination_address,
        fare: updated.fare,
        distanceKm: updated.distance_km,
        status: updated.status,
        startedAt: updated.started_at,
        completedAt: updated.completed_at,
        createdAt: updated.created_at,
      };

      res.json({ ride: rideResponse });
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.issues[0].message });
      next(err);
    }
  });

  /**
   * GET /api/rides/taxi/:username
   * Viaje activo del taxista + historial
   */
  app.get("/api/rides/taxi/:username", requireAuth, requireSelfOrAdmin((req) => req.params.username), async (req, res, next) => {
    try {
      const { username } = req.params;
      if (!isValidUsername(username)) return res.status(400).json({ message: "Usuario inválido" });
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
  app.get("/api/rides/traveler/:username", requireAuth, requireSelfOrAdmin((req) => req.params.username), async (req, res, next) => {
    try {
      const { username } = req.params;
      if (!isValidUsername(username)) return res.status(400).json({ message: "Usuario inválido" });
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
  app.patch("/api/taxi/status", requireAuth, requireRole("taxi", "admin"), writeLimiter, async (req: any, res, next) => {
    try {
      const { isAvailable } = req.body || {};
      if (typeof isAvailable !== "boolean") {
        return res.status(400).json({ message: "isAvailable debe ser booleano" });
      }

      // Solo un admin puede cambiar la disponibilidad de otra cuenta.
      const targetUsername =
        req.user.role === "admin"
          ? sanitizeSingleLine(req.body?.username, 40) || req.user.username
          : req.user.username;
      if (!isValidUsername(targetUsername)) {
        return res.status(400).json({ message: "Usuario inválido" });
      }

      const rawLat = req.body?.lat;
      const rawLng = req.body?.lng;
      let lat: number | undefined;
      let lng: number | undefined;

      if (rawLat !== undefined && rawLat !== null && rawLat !== "") {
        lat = Number(rawLat);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
          return res.status(400).json({ message: "Latitud inválida: debe estar entre -90 y 90" });
        }
      }
      if (rawLng !== undefined && rawLng !== null && rawLng !== "") {
        lng = Number(rawLng);
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
          return res.status(400).json({ message: "Longitud inválida: debe estar entre -180 y 180" });
        }
      }

      await setTaxiAvailability(targetUsername, isAvailable, lat, lng);
      res.json({ ok: true, isAvailable });
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.issues[0].message });
      next(err);
    }
  });

  /**
   * GET /api/taxi/nearby
   * Taxistas disponibles para el radar
   * Query: lat, lng (opcionales, para futura geolocalización real)
   */
  app.get("/api/taxi/nearby", requireAuth, async (_req, res, next) => {
    try {
      const drivers = await getAvailableTaxis();
      const usernames = drivers.map((driver) => driver.username).filter(Boolean);

      // Nombres en una sola consulta; el resto se limita a campos públicos.
      let namesByUsername = new Map<string, string | null>();
      if (usernames.length > 0) {
        const result = await getDb().execute(
          sql`SELECT username, name FROM users WHERE username IN (${sql.join(
            usernames.map((username) => sql`${username}`),
            sql`, `,
          )})`
        );
        const rows = (result as any).rows ?? (result as any);
        if (Array.isArray(rows)) {
          namesByUsername = new Map(
            rows.map((row: any): [string, string | null] => [
              String(row.username),
              typeof row.name === "string" ? row.name : null,
            ])
          );
        }
      }

      // Solo campos públicos: nunca teléfono ni placa; coordenadas aproximadas (~1 km).
      const approx = (value: string | null): number | null => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : null;
      };
      const publicDrivers = drivers.map((driver) => ({
        username: driver.username,
        name: namesByUsername.get(driver.username) ?? null,
        vehicleType: driver.vehicleType,
        isAvailable: true, // getAvailableTaxis solo devuelve taxistas disponibles
        lat: approx(driver.lat),
        lng: approx(driver.lng),
      }));

      res.json({ drivers: publicDrivers });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/taxi/profile/:username
   * Perfil del taxista (isAvailable, vehicleType, plate, phone)
   */
  app.get("/api/taxi/profile/:username", requireAuth, async (req: any, res, next) => {
    try {
      const username = sanitizeSingleLine(req.params.username, 40);
      if (!isValidUsername(username)) {
        return res.status(400).json({ message: "Usuario inválido" });
      }

      const profile = await getTaxiProfile(username);
      if (!profile) return res.status(404).json({ message: "Taxista no encontrado" });

      const isSelf = req.user.username === username;
      const isAdmin = req.user.role === "admin";
      if (isSelf || isAdmin) {
        return res.json({ profile });
      }

      // El teléfono solo se comparte cuando el viajero tiene un viaje aceptado
      // o en curso con este taxista. La placa nunca se expone en el perfil público.
      const activeRide = await getActiveTravelerRide(req.user.username);
      const sharesContact =
        activeRide?.taxiUsername === username &&
        (activeRide.status === "accepted" || activeRide.status === "in_progress");

      return res.json({
        profile: {
          username,
          name: await getUserDisplayName(username),
          vehicleType: profile.vehicleType,
          isAvailable: profile.isAvailable,
          phone: sharesContact ? profile.phone : null,
        },
      });
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
  app.get("/api/taxi/earnings/:username", requireAuth, async (req: any, res, next) => {
    try {
      const { username } = req.params;
      if (username !== req.user.username && req.user.role !== "admin") {
        return res.status(403).json({ message: "No puedes consultar las ganancias de otra cuenta" });
      }
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

      const safeWithdrawals = withdrawalsList.map((withdrawal: any) => ({
        ...withdrawal,
        bankAccount: withdrawal.bankAccount ? maskPaymentDetails(withdrawal.bankAccount) : null,
      }));

      res.json({
        totalEarned,
        totalWithdrawn,
        totalPendingWithdrawn,
        available: Math.max(0, available),
        earnings: earningsList,
        withdrawals: safeWithdrawals,
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
  app.post("/api/taxi/withdraw", requireAuth, requireRole("taxi", "admin"), async (req: any, res, next) => {
    try {
      const data = withdrawSchema.parse(req.body);
      // El propietario de la cuenta autenticada es el único que puede retirar.
      const taxiUsername = req.user.username;

      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
        return res.status(400).json({ message: "Monto inválido: debe ser mayor a 0 y menor o igual a 10.000.000" });
      }
      const bankAccount = sanitizeSingleLine(data.bankAccount, 120);
      if (!bankAccount) {
        return res.status(400).json({ message: "Ingresa una cuenta bancaria válida" });
      }

      const idempotencyKey = sanitizeSingleLine(
        req.get("idempotency-key") || data.idempotencyKey,
        100,
      ) || null;
      const maskWithdrawal = (withdrawal: any) => ({
        ...withdrawal,
        bankAccount: withdrawal.bankAccount ? maskPaymentDetails(withdrawal.bankAccount) : null,
      });

      if (idempotencyKey) {
        const prior = await getWithdrawalByIdempotencyKey(taxiUsername, idempotencyKey);
        if (prior) return res.json({ withdrawal: maskWithdrawal(prior), idempotent: true });
      }

      // Chequeo y reserva atómicos: dos retiros concurrentes no pueden usar el
      // mismo saldo. El advisory lock vive dentro de la misma sentencia SQL.
      const withdrawal = await createWithdrawalAtomic({
        taxiUsername,
        amount,
        bankAccount: encryptSensitive(bankAccount),
        notes: sanitizeSingleLine(data.notes, 500) || null,
        idempotencyKey,
      });

      if (!withdrawal) {
        return res.status(400).json({ message: "Saldo insuficiente para este retiro" });
      }

      res.status(201).json({ withdrawal: maskWithdrawal(withdrawal) });
    } catch (err: any) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.issues[0].message });
      const retryKey = sanitizeSingleLine(
        req.get("idempotency-key") || req.body?.idempotencyKey,
        100,
      );
      if (err?.code === "23505" && retryKey) {
        const prior = await getWithdrawalByIdempotencyKey(req.user.username, retryKey);
        if (prior) {
          return res.json({ withdrawal: {
            ...prior,
            bankAccount: prior.bankAccount ? maskPaymentDetails(prior.bankAccount) : null,
          }, idempotent: true });
        }
      }
      if (err?.code === "23505") {
        return res.status(409).json({ message: "Solicitud de retiro duplicada" });
      }
      next(err);
    }
  });
}
