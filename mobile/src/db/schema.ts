// Adapted from shared/schema.ts — standalone for mobile
import { sql } from "drizzle-orm";
import { pgEnum, pgTable, text, varchar, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "traveler", "hotel", "restaurant", "recreation", "taxi",
]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  email: text("email"),
  role: userRoleEnum("role").default("traveler"),
  roleChangedAt: timestamp("role_changed_at"),
  avatarUrl: text("avatar_url"),
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const serviceCategoryEnum = pgEnum("service_category", [
  "hotel", "restaurant", "recreation", "transport",
]);

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerUsername: text("provider_username").notNull(),
  category: serviceCategoryEnum("category").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  rating: integer("rating"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  locationId: text("location_id").notNull(),
  authorUsername: text("author_username").notNull(),
  content: text("content").notNull(),
  rating: integer("rating"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Types
export type User = typeof users.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type UserRole = "traveler" | "hotel" | "restaurant" | "recreation" | "taxi";
export type ServiceCategory = "hotel" | "restaurant" | "recreation" | "transport";
