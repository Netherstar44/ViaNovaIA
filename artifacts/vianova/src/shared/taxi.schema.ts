// ─────────────────────────────────────────────────────────────────────────────
// shared/taxi.schema.ts
// Agregar estas definiciones a shared/schema.ts (o importar desde aquí)
// ─────────────────────────────────────────────────────────────────────────────

import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const rideStatusEnum = pgEnum("ride_status", [
  "pending",      // esperando que un taxi lo acepte
  "accepted",     // taxi aceptó, en camino al origen
  "in_progress",  // viaje iniciado
  "completed",    // viaje finalizado
  "cancelled",    // cancelado por cualquier parte
]);

export const withdrawalStatusEnum = pgEnum("withdrawal_status", [
  "pending",
  "completed",
  "rejected",
]);

// ── Tabla: rides ─────────────────────────────────────────────────────────────

export const rides = pgTable("rides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  travelerUsername: text("traveler_username").notNull(),
  taxiUsername: text("taxi_username"),               // null hasta que se acepte
  originLat: text("origin_lat").notNull(),
  originLng: text("origin_lng").notNull(),
  originAddress: text("origin_address"),
  destinationLat: text("destination_lat").notNull(),
  destinationLng: text("destination_lng").notNull(),
  destinationAddress: text("destination_address").notNull(),
  fare: real("fare").notNull(),                      // precio estimado en COP
  distanceKm: real("distance_km"),
  status: rideStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ── Tabla: earnings ───────────────────────────────────────────────────────────

export const earnings = pgTable("earnings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxiUsername: text("taxi_username").notNull(),
  rideId: varchar("ride_id").notNull().references(() => rides.id),
  amount: real("amount").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ── Tabla: withdrawals ────────────────────────────────────────────────────────

export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxiUsername: text("taxi_username").notNull(),
  amount: real("amount").notNull(),
  status: withdrawalStatusEnum("status").notNull().default("pending"),
  bankAccount: text("bank_account"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// ── Extensión de users (columnas a agregar via /api/migrate) ──────────────────
// ALTER TABLE users ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT false;
// ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_type text;
// ALTER TABLE users ADD COLUMN IF NOT EXISTS plate text;
// ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;

// ── Insert Schemas (Zod) ──────────────────────────────────────────────────────

export const insertRideSchema = createInsertSchema(rides).pick({
  travelerUsername: true,
  originLat: true,
  originLng: true,
  originAddress: true,
  destinationLat: true,
  destinationLng: true,
  destinationAddress: true,
  fare: true,
  distanceKm: true,
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).pick({
  taxiUsername: true,
  amount: true,
  bankAccount: true,
  notes: true,
});

// ── Zod validators (para endpoints sin Drizzle) ───────────────────────────────

export const patchRideSchema = z.object({
  status: z.enum(["accepted", "in_progress", "completed", "cancelled"]),
  taxiUsername: z.string().optional(),
});

export const taxiStatusSchema = z.object({
  username: z.string().min(1),
  isAvailable: z.boolean(),
});

export const withdrawSchema = z.object({
  taxiUsername: z.string().min(1),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  bankAccount: z.string().min(5, "Ingresa una cuenta bancaria válida"),
  notes: z.string().optional(),
});

// ── TypeScript Types ──────────────────────────────────────────────────────────

export type Ride = typeof rides.$inferSelect;
export type Earning = typeof earnings.$inferSelect;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertRide = z.infer<typeof insertRideSchema>;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
