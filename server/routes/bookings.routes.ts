import { Router, type Request, type Response, type NextFunction } from "express";
import { getDb } from "../storage.js";
import { availabilitySlots, bookings, services, insertAvailabilitySlotSchema } from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole, PROVIDER_ROLES, sanitizeSingleLine } from "../security.js";
import { writeLimiter, publicReadLimiter } from "../rate-limits.js";
import { sql as drizzleSql } from "drizzle-orm";

const router = Router();

/**
 * Libera reservas temporales vencidas y devuelve el inventario una sola vez.
 * Se ejecuta antes de bloquear/confirmar y también desde el job periódico.
 */
export async function releaseExpiredLocks(db = getDb()): Promise<number> {
  const result = await db.execute(drizzleSql`
    WITH expired AS (
      UPDATE bookings
      SET status = 'expired', locked_until = NULL
      WHERE status = 'reserved_temp' AND locked_until IS NOT NULL AND locked_until < now()
      RETURNING slot_id, units
    ), totals AS (
      SELECT slot_id, SUM(units)::int AS units
      FROM expired
      GROUP BY slot_id
    )
    UPDATE availability_slots s
    SET booked = GREATEST(COALESCE(s.booked, 0) - t.units, 0)
    FROM totals t
    WHERE s.id = t.slot_id
    RETURNING s.id
  `);
  const rows = (result as any).rows ?? (result as any) ?? [];
  return Array.isArray(rows) ? rows.length : 0;
}

// Endpoint para que el proveedor cree slots (habitaciones, mesas)
router.post(
  "/slots",
  requireAuth,
  requireRole(...PROVIDER_ROLES),
  writeLimiter,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const data = req.body || {};
      const serviceId = sanitizeSingleLine(data.serviceId, 64);
      if (!serviceId) return res.status(400).json({ message: "serviceId requerido" });

      // El slot solo puede pertenecer a un servicio del proveedor autenticado.
      const [service] = await db.select().from(services).where(eq(services.id, serviceId));
      if (!service) return res.status(404).json({ message: "Servicio no encontrado" });
      if (service.providerUsername !== req.user.username && req.user.role !== "admin") {
        return res.status(403).json({ message: "No puedes crear disponibilidad para otro proveedor" });
      }

      const capacity = Number(data.capacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10_000) {
        return res.status(400).json({ message: "Capacidad inválida" });
      }
      const price = data.price === undefined || data.price === null || data.price === ""
        ? Number(service.price || 0)
        : Number(data.price);
      if (!Number.isFinite(price) || price < 0 || price > 100_000_000) {
        return res.status(400).json({ message: "Precio inválido" });
      }
      const startTime = new Date(String(data.startTime));
      const endTime = new Date(String(data.endTime));
      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
        return res.status(400).json({ message: "Rango de fechas inválido" });
      }
      if (endTime.getTime() < Date.now() - 60_000) {
        return res.status(400).json({ message: "El slot ya está en el pasado" });
      }
      const slotType = ["room", "table", "hour"].includes(data.slotType) ? data.slotType : "room";

      const parsed = insertAvailabilitySlotSchema.parse({
        serviceId,
        providerUsername: service.providerUsername,
        slotType,
        startTime,
        endTime,
        capacity,
        price,
        status: "available",
      });
      const [slot] = await db.insert(availabilitySlots).values(parsed).returning();
      res.json(slot);
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json({ message: "Datos del slot inválidos" });
      }
      next(err);
    }
  },
);

// Endpoint para que un viajero vea slots disponibles para un servicio
router.get("/slots/:serviceId", publicReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const serviceId = sanitizeSingleLine(req.params.serviceId, 64);
    if (!serviceId) return res.status(400).json({ message: "Servicio inválido" });

    const slots = await db
      .select()
      .from(availabilitySlots)
      .where(eq(availabilitySlots.serviceId, serviceId));

    res.json(slots.filter((slot) => slot.status === "available"));
  } catch (err) {
    next(err);
  }
});

// Bloquear una reserva temporalmente (5 minutos), con reserva atómica.
router.post("/lock", requireAuth, writeLimiter, async (req: any, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const slotId = sanitizeSingleLine(req.body?.slotId, 64);
    const units = Number(req.body?.units);
    const travelerUsername = req.user.username;

    if (!slotId) {
      return res.status(400).json({ message: "slotId y units son obligatorios" });
    }
    if (!Number.isInteger(units) || units < 1 || units > 50) {
      return res.status(400).json({ message: "units debe ser un entero entre 1 y 50" });
    }

    // Libera primero cualquier lock vencido para no bloquear inventario real.
    await releaseExpiredLocks(db);

    const [slot] = await db.select().from(availabilitySlots).where(eq(availabilitySlots.id, slotId));
    if (!slot) return res.status(404).json({ message: "Slot no encontrado" });
    if (slot.status !== "available") {
      return res.status(409).json({ message: "El slot no está disponible" });
    }
    if (slot.providerUsername === travelerUsername) {
      return res.status(400).json({ message: "No puedes reservar tu propio servicio" });
    }
    if (new Date(slot.startTime).getTime() < Date.now() - 60_000) {
      return res.status(409).json({ message: "El slot ya está en el pasado" });
    }

    // UPDATE atómico: el cliente nunca decide capacidad ni precio.
    const reserved = await db.execute(drizzleSql`
      UPDATE availability_slots
      SET booked = COALESCE(booked, 0) + ${units}
      WHERE id = ${slotId}
        AND status = 'available'
        AND capacity - COALESCE(booked, 0) >= ${units}
        AND start_time > now() - interval '1 minute'
      RETURNING *
    `);
    const slotRow = (reserved as any).rows?.[0] ?? (reserved as any)[0];
    if (!slotRow) {
      return res.status(409).json({ message: "No hay suficiente disponibilidad" });
    }

    const lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
    try {
      const [booking] = await db.insert(bookings).values({
        slotId,
        travelerUsername,
        providerUsername: slotRow.provider_username ?? slotRow.providerUsername ?? slot.providerUsername,
        units,
        totalPrice: Number(slotRow.price ?? slot.price ?? 0) * units,
        status: "reserved_temp",
        lockedUntil,
      }).returning();

      return res.json({ message: "Slot bloqueado por 5 minutos", booking });
    } catch (err) {
      // Si falla la inserción, devolver el inventario reservado.
      await db.execute(drizzleSql`
        UPDATE availability_slots
        SET booked = GREATEST(COALESCE(booked, 0) - ${units}, 0)
        WHERE id = ${slotId}
      `).catch(() => {});
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// Confirmar reserva: el pago PSE queda pendiente de verificación.
router.post("/confirm", requireAuth, writeLimiter, async (req: any, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const bookingId = sanitizeSingleLine(req.body?.bookingId, 64);
    if (!bookingId) return res.status(400).json({ message: "bookingId requerido" });

    await releaseExpiredLocks(db);

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!booking) return res.status(404).json({ message: "Reserva no encontrada" });
    if (booking.travelerUsername !== req.user.username && req.user.role !== "admin") {
      return res.status(403).json({ message: "No puedes confirmar la reserva de otra cuenta" });
    }
    if (booking.status === "expired") {
      return res.status(409).json({ message: "La reserva expiró, vuelve a bloquear el slot" });
    }
    if (booking.status !== "reserved_temp") {
      return res.status(400).json({ message: "Reserva expirada, cancelada o ya procesada" });
    }
    if (!booking.lockedUntil || new Date(booking.lockedUntil).getTime() < Date.now()) {
      await releaseExpiredLocks(db);
      return res.status(409).json({ message: "La reserva expiró, vuelve a bloquear el slot" });
    }

    // Condicional: evita confirmaciones dobles concurrentes.
    const [confirmed] = await db.update(bookings)
      .set({ status: "pending_payment", lockedUntil: null })
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, "reserved_temp")))
      .returning();

    if (!confirmed) {
      return res.status(409).json({ message: "La reserva cambió de estado. Recarga e inténtalo de nuevo." });
    }

    res.json({
      message: "Reserva registrada. El pago PSE queda pendiente de verificación.",
      booking: confirmed,
    });
  } catch (err) {
    next(err);
  }
});

export { router as bookingsRouter };
