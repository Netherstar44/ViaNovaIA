import { Router } from "express";
import { getDb } from "../storage.js";
import { availabilitySlots, bookings, services, insertAvailabilitySlotSchema, insertBookingSchema } from "../shared/schema.js";
import { eq, and, gt, sql as drizzleSql } from "drizzle-orm";
import { requireAuth } from "./app.routes.js";

const router = Router();

// Endpoint para que el proveedor cree slots (habitaciones, mesas)
router.post("/slots", requireAuth, async (req: any, res) => {
  try {
    const db = getDb();
    const data = req.body;
    
    // Validate with zod
    const parsed = insertAvailabilitySlotSchema.parse({
      ...data,
      providerUsername: req.user.username,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime)
    });

    const [slot] = await db.insert(availabilitySlots).values(parsed).returning();
    res.json(slot);
  } catch (err: any) {
    console.error("Error creating slot", err);
    res.status(400).json({ message: err.message || "Bad Request" });
  }
});

// Endpoint para que un viajero vea slots disponibles para un servicio
router.get("/slots/:serviceId", async (req, res) => {
  try {
    const db = getDb();
    const { serviceId } = req.params;
    
    const slots = await db
      .select()
      .from(availabilitySlots)
      .where(
        and(
          eq(availabilitySlots.serviceId, serviceId),
          eq(availabilitySlots.status, "available")
        )
      );
      
    res.json(slots);
  } catch (err: any) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Endpoint para bloquear una reserva temporalmente (Optimistic Locking, 5 minutos)
router.post("/lock", requireAuth, async (req: any, res) => {
  try {
    const db = getDb();
    const { slotId, units } = req.body;
    const travelerUsername = req.user.username;

    if (!slotId || !units) {
      return res.status(400).json({ message: "slotId and units required" });
    }

    // 1. Verificar si el slot existe y tiene capacidad
    const [slot] = await db.select().from(availabilitySlots).where(eq(availabilitySlots.id, slotId));
    if (!slot) return res.status(404).json({ message: "Slot no encontrado" });
    
    if (slot.capacity - (slot.booked || 0) < units) {
      return res.status(409).json({ message: "No hay suficiente disponibilidad" });
    }

    // 2. Lock optimistic update (sumar a booked)
    await db.update(availabilitySlots)
      .set({ booked: (slot.booked || 0) + units })
      .where(eq(availabilitySlots.id, slotId));

    // 3. Crear el booking temporal
    const lockedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
    const [booking] = await db.insert(bookings).values({
      slotId,
      travelerUsername,
      providerUsername: slot.providerUsername,
      units,
      totalPrice: (slot.price || 0) * units,
      status: "reserved_temp",
      lockedUntil
    }).returning();

    return res.json({ message: "Slot bloqueado por 5 minutos", booking });
  } catch (err: any) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// Confirmar reserva simulando pago PSE
router.post("/confirm", requireAuth, async (req: any, res) => {
  try {
    const db = getDb();
    const { bookingId } = req.body;

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!booking) return res.status(404).json({ message: "Reserva no encontrada" });
    
    if (booking.status !== "reserved_temp") {
      return res.status(400).json({ message: "Reserva ya procesada o cancelada" });
    }

    // Simulacion de validacion PSE (siempre exitosa para MVP)
    // 1. Marcar booking como confirmado
    const [confirmed] = await db.update(bookings)
      .set({ status: "confirmed", lockedUntil: null })
      .where(eq(bookings.id, bookingId))
      .returning();

    return res.json({ message: "Reserva confirmada con PSE", booking: confirmed });
  } catch (err: any) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export { router as bookingsRouter };
