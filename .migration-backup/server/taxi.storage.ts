// ─────────────────────────────────────────────────────────────────────────────
// server/taxi.storage.ts
// Capa de acceso a datos para el módulo taxi
// ─────────────────────────────────────────────────────────────────────────────

import { eq, desc, and, sql } from "drizzle-orm";
import { getDb } from "./storage.js"; // reutiliza el getDb existente
import {
  rides,
  earnings,
  withdrawals,
  type Ride,
  type Earning,
  type Withdrawal,
  type InsertRide,
  type InsertWithdrawal,
} from "../shared/taxi.schema.js";

// ── RIDES ─────────────────────────────────────────────────────────────────────

export async function createRide(data: InsertRide): Promise<Ride> {
  const db = getDb();
  const rows = await db.insert(rides).values(data).returning();
  return rows[0];
}

export async function getRideById(id: string): Promise<Ride | undefined> {
  const db = getDb();
  const rows = await db.select().from(rides).where(eq(rides.id, id));
  return rows[0];
}

/** Rides pendientes (aún sin taxi asignado) */
export async function getPendingRides(): Promise<Ride[]> {
  const db = getDb();
  return db
    .select()
    .from(rides)
    .where(eq(rides.status, "pending"))
    .orderBy(desc(rides.createdAt))
    .limit(20);
}

/** Ride activo de un taxista (accepted o in_progress) */
export async function getActiveTaxiRide(taxiUsername: string): Promise<Ride | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(rides)
    .where(
      and(
        eq(rides.taxiUsername, taxiUsername),
        sql`${rides.status} IN ('accepted','in_progress')`
      )
    )
    .limit(1);
  return rows[0];
}

/** Historial de viajes completados de un taxista */
export async function getTaxiRideHistory(taxiUsername: string): Promise<Ride[]> {
  const db = getDb();
  return db
    .select()
    .from(rides)
    .where(
      and(eq(rides.taxiUsername, taxiUsername), eq(rides.status, "completed"))
    )
    .orderBy(desc(rides.completedAt))
    .limit(50);
}

/** Ride activo de un viajero (pending, accepted o in_progress) */
export async function getActiveTravelerRide(travelerUsername: string): Promise<Ride | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(rides)
    .where(
      and(
        eq(rides.travelerUsername, travelerUsername),
        sql`${rides.status} IN ('pending','accepted','in_progress')`
      )
    )
    .orderBy(desc(rides.createdAt))
    .limit(1);
  return rows[0];
}

/** Historial de viajes completados de un viajero */
export async function getTravelerRideHistory(travelerUsername: string): Promise<Ride[]> {
  const db = getDb();
  return db
    .select()
    .from(rides)
    .where(
      and(
        eq(rides.travelerUsername, travelerUsername),
        eq(rides.status, "completed")
      )
    )
    .orderBy(desc(rides.completedAt))
    .limit(20);
}

/** Actualiza estado del ride (con campos opcionales según el estado) */
export async function updateRideStatus(
  id: string,
  status: Ride["status"],
  extra: Partial<Pick<Ride, "taxiUsername" | "startedAt" | "completedAt">> = {}
): Promise<Ride> {
  const db = getDb();
  const rows = await db
    .update(rides)
    .set({ status, ...extra } as any)
    .where(eq(rides.id, id))
    .returning();
  return rows[0];
}

// ── EARNINGS ──────────────────────────────────────────────────────────────────

/** Crea registro de ganancia cuando se completa un viaje */
export async function createEarning(
  taxiUsername: string,
  rideId: string,
  amount: number
): Promise<Earning> {
  const db = getDb();
  const rows = await db
    .insert(earnings)
    .values({ taxiUsername, rideId, amount })
    .returning();
  return rows[0];
}

export async function getEarningsByTaxi(taxiUsername: string): Promise<Earning[]> {
  const db = getDb();
  return db
    .select()
    .from(earnings)
    .where(eq(earnings.taxiUsername, taxiUsername))
    .orderBy(desc(earnings.createdAt));
}

/** Total bruto ganado (suma de todos los earnings) */
export async function getTotalEarned(taxiUsername: string): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${earnings.amount}), 0)` })
    .from(earnings)
    .where(eq(earnings.taxiUsername, taxiUsername));
  return Number(result[0]?.total ?? 0);
}

/** Total retirado (withdrawals en estado completed) */
export async function getTotalWithdrawn(taxiUsername: string): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${withdrawals.amount}), 0)` })
    .from(withdrawals)
    .where(
      and(
        eq(withdrawals.taxiUsername, taxiUsername),
        eq(withdrawals.status, "completed")
      )
    );
  return Number(result[0]?.total ?? 0);
}

// ── WITHDRAWALS ───────────────────────────────────────────────────────────────

export async function createWithdrawal(data: InsertWithdrawal): Promise<Withdrawal> {
  const db = getDb();
  const rows = await db.insert(withdrawals).values(data).returning();
  return rows[0];
}

export async function getWithdrawalsByTaxi(taxiUsername: string): Promise<Withdrawal[]> {
  const db = getDb();
  return db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.taxiUsername, taxiUsername))
    .orderBy(desc(withdrawals.createdAt));
}

// ── TAXI AVAILABILITY (tabla users) ──────────────────────────────────────────

export async function setTaxiAvailability(
  username: string,
  isAvailable: boolean,
  lat?: number,
  lng?: number
): Promise<void> {
  const db = getDb();
  if (lat != null && lng != null) {
    await db.execute(
      sql`UPDATE users SET is_available = ${isAvailable}, taxi_lat = ${lat.toString()}, taxi_lng = ${lng.toString()} WHERE username = ${username}`
    );
  } else {
    await db.execute(
      sql`UPDATE users SET is_available = ${isAvailable} WHERE username = ${username}`
    );
  }
}

export async function getTaxiProfile(
  username: string
): Promise<{ isAvailable: boolean; vehicleType: string | null; plate: string | null; phone: string | null } | null> {
  const db = getDb();
  const result = await db.execute(
    sql`SELECT is_available, vehicle_type, plate, phone FROM users WHERE username = ${username} LIMIT 1`
  );
  const row = (result as any).rows?.[0] ?? (result as any)[0];
  if (!row) return null;
  return {
    isAvailable: Boolean(row.is_available),
    vehicleType: row.vehicle_type ?? null,
    plate: row.plate ?? null,
    phone: row.phone ?? null,
  };
}

/** Taxistas disponibles (is_available = true, role = 'taxi') con ubicación */
export async function getAvailableTaxis(): Promise<
  { username: string; vehicleType: string | null; plate: string | null; phone: string | null; lat: string | null; lng: string | null }[]
> {
  const db = getDb();
  const result = await db.execute(
    sql`SELECT username, vehicle_type, plate, phone, taxi_lat, taxi_lng FROM users WHERE role = 'taxi' AND is_available = true LIMIT 30`
  );
  const rows = (result as any).rows ?? (result as any);
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    username: r.username,
    vehicleType: r.vehicle_type ?? null,
    plate: r.plate ?? null,
    phone: r.phone ?? null,
    lat: r.taxi_lat ?? null,
    lng: r.taxi_lng ?? null,
  }));
}
