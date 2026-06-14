import { sql } from "drizzle-orm";
import { pgEnum, pgTable, text, varchar, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const categoryEnum = pgEnum("category", [
  "hoteles",
  "comidas",
  "actividades",
  "transporte",
  "otros",
]);

export const userRoleEnum = pgEnum("user_role", [
  "traveler",
  "hotel",
  "restaurant",
  "recreation",
  "taxi",
  "translator",
  "admin",
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
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  isActive: text("is_active"),
  updatedAt: timestamp("updated_at"),
  identificationNumber: text("identification_number"),
  allowLocation: text("allow_location"),
  // New fields for security and personalization
  isVerified: text("is_verified").default("false"),
  verificationToken: text("verification_token"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockUntil: timestamp("lock_until"),
  preferences: jsonb("preferences"), // stores user tastes, travel styles, chatbot memory
  bio: text("bio"),
  city: text("city").default("Neiva"),
  // 2FA TOTP fields
  totpSecret: text("totp_secret"),      // AES-256 encrypted TOTP secret
  totpEnabled: boolean("totp_enabled").default(false),
  // Taxi-specific columns (used by raw SQL in taxi.storage.ts)
  isAvailableTaxi: boolean("is_available").default(false),
  vehicleType: text("vehicle_type"),
  plate: text("plate"),
  taxiLat: text("taxi_lat"),
  taxiLng: text("taxi_lng"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const media = pgTable("media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  category: categoryEnum("category").notNull(),
  publicId: text("public_id").notNull(),
  url: text("url").notNull(),
  folder: text("folder").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const serviceCategoryEnum = pgEnum("service_category", [
  "hotel",
  "restaurant",
  "recreation",
  "transport",
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
  price: integer("price"),
  currency: text("currency").default("COP"),
  priceType: text("price_type"),
  duration: text("duration"),
  minCapacity: integer("min_capacity"),
  maxCapacity: integer("max_capacity"),
  difficulty: text("difficulty"),
  minAge: integer("min_age"),
  included: jsonb("included"),
  whatToBring: text("what_to_bring"),
  schedule: text("schedule"),
  parentHotelId: varchar("parent_hotel_id"),
  city: text("city").default("Neiva"),
  isActive: boolean("is_active").default(true),
  priceRange: text("price_range"),
  whatsappNumber: text("whatsapp_number"),
  paymentMethods: text("payment_methods"),
  foodCategories: jsonb("food_categories"),
  acceptsOrders: boolean("accepts_orders").default(true),
  roomService: boolean("room_service").default(false),
  roomServiceSchedule: text("room_service_schedule"),
  hotelMenuSupport: boolean("hotel_menu_support").default(false),
  hasVR: boolean("has_vr").default(false),
  hasAR: boolean("has_ar").default(false),
  vrType: text("vr_type"),
  vrModelUrl: text("vr_model_url"),
  vrInteriorUrl: text("vr_interior_url"),
  externalVrUrl: text("external_vr_url"),
  menuData: jsonb("menu_data"),
  mediaGallery: jsonb("media_gallery"),
  googleMapsUrl: text("google_maps_url"),
  // Analytics columns (used by raw SQL in app.routes.ts)
  viewCount: integer("view_count").default(0),
  mapClicks: integer("map_clicks").default(0),
  vrEngagement: integer("vr_engagement").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  locationId: text("location_id").notNull(), // puede referir a mockData id o services.id
  authorUsername: text("author_username").notNull(),
  content: text("content").notNull(),
  rating: integer("rating"),
  // Moderación por restaurante (persistidas en BD)
  hidden: boolean("hidden").default(false),
  replyContent: text("reply_content"),
  replyCreatedAt: timestamp("reply_created_at"),
  // Ventana de edición de 10 minutos para el autor
  updatedAt: timestamp("updated_at"),
  // Respuestas anidadas de otros usuarios
  parentCommentId: varchar("parent_comment_id"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ── Analytics de vistas reales de servicios ──────────────────────────────────
export const serviceViews = pgTable("service_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull(),
  viewerUsername: text("viewer_username"),
  viewType: text("view_type").default("profile"),
  viewedAt: timestamp("viewed_at").default(sql`now()`),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ── Multi-role: un usuario puede tener múltiples roles ────────────────────────
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: userRoleEnum("role").notNull(),
  businessName: text("business_name"),
  businessAddress: text("business_address"),
  businessPhone: text("business_phone"),
  vehicleType: text("vehicle_type"),
  plate: text("plate"),
  phone: text("phone"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ── Reseñas bidireccionales (taxista↔viajero) ─────────────────────────────────
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").notNull(),
  authorUsername: text("author_username").notNull(),
  targetUsername: text("target_username").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  authorRole: text("author_role").notNull(), // 'traveler' | 'taxi'
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ── Métodos de pago ───────────────────────────────────────────────────────────
export const paymentMethodTypeEnum = pgEnum("payment_method_type", [
  "cash",
  "nequi",
  "daviplata",
  "card",
]);

export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  type: paymentMethodTypeEnum("type").notNull(),
  label: text("label").notNull(),
  details: text("details"),
  isDefault: text("is_default").default("false"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ── SISTEMA DE DISPONIBILIDAD Y RESERVAS (FASE 3) ────────────────────────────
export const availabilitySlots = pgTable("availability_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  providerUsername: text("provider_username").notNull(),
  slotType: text("slot_type").notNull(), // 'room' | 'table' | 'hour'
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  capacity: integer("capacity").notNull(), // Total inventory (e.g. 5 tables, 10 rooms)
  booked: integer("booked").default(0), // Currently booked units
  price: integer("price"), // Override base service price if needed
  status: text("status").default("available"), // 'available' | 'locked'
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slotId: varchar("slot_id").notNull().references(() => availabilitySlots.id),
  travelerUsername: text("traveler_username").notNull(),
  providerUsername: text("provider_username").notNull(),
  units: integer("units").notNull().default(1), // e.g. 2 rooms, 1 table
  totalPrice: integer("total_price").notNull(),
  status: text("status").default("pending"), // 'pending' | 'reserved_temp' | 'confirmed' | 'cancelled'
  lockedUntil: timestamp("locked_until"), // For optimistic locking (5 mins)
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ── RED SOCIAL (FASE 4) ───────────────────────────────────────────────────────
export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorUsername: text("author_username").notNull(),
  content: text("content"),
  mediaUrl: text("media_url"), // Image, Video, or 360/3D model URL
  mediaType: text("media_type"), // 'image' | 'video' | '360' | '3d'
  locationId: varchar("location_id"), // Optional reference to a service/location
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const postLikes = pgTable("post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => posts.id),
  username: text("username").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const postComments = pgTable("post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => posts.id),
  username: text("username").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ── REFRESH TOKENS (JWT Rotation) ─────────────────────────────────────────
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(), // SHA-256 hash of the refresh token
  family: text("family").notNull(), // Token family for rotation detection
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"), // null = active, set = revoked
  replacedByHash: text("replaced_by_hash"), // points to the new token that replaced this one
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ── AUDIT / ACTION LOGS ───────────────────────────────────────────────────
export const actionLogs = pgTable("action_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  username: text("username"),
  action: text("action").notNull(), // 'login' | 'logout' | 'register' | 'password_reset' | 'profile_update' | '2fa_enable' | '2fa_disable' | 'role_change' | 'account_delete' | etc.
  details: jsonb("details"), // extra context (e.g. { ip, userAgent, oldRole, newRole })
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: text("status").default("success"), // 'success' | 'failure'
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ── E2EE KEY PAIRS (Preparación) ──────────────────────────────────────────
export const userKeyPairs = pgTable("user_key_pairs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  publicKey: text("public_key").notNull(),          // Base64 public key (X25519 or ECDH P-256)
  encryptedPrivateKey: text("encrypted_private_key").notNull(), // AES-256 encrypted with user's passphrase
  algorithm: text("algorithm").default("X25519"),   // Key exchange algorithm
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at"),
});

// ── SOCIAL NETWORK (Legacy raw-SQL tables) ────────────────────────────────────
// These tables are used via raw SQL in social.routes.ts and app.routes.ts
// They must be in the schema so Drizzle doesn't delete them during migration.

export const socialPosts = pgTable("social_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  username: text("username").notNull(),
  caption: text("caption"),
  mediaUrl: text("media_url"),
  mediaType: text("media_type").default("image"),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const socialLikes = pgTable("social_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const socialComments = pgTable("social_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  username: text("username").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ── MEDIA ASSETS (used by product gallery via raw SQL) ────────────────────────

export const mediaAssets = pgTable("media_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull(),
  entityType: text("entity_type").notNull().default("product"),
  url: text("url").notNull(),
  type: text("type").default("image"),
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  locationLat: true,
  locationLng: true,
  verificationToken: true,
  isVerified: true,
  failedLoginAttempts: true,
  lockUntil: true,
  preferences: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  role: true,
  content: true,
});

export const insertServiceSchema = createInsertSchema(services).pick({
  providerUsername: true,
  category: true,
  name: true,
  description: true,
  imageUrl: true,
  locationLat: true,
  locationLng: true,
  rating: true,
  price: true,
  currency: true,
  priceType: true,
  duration: true,
  minCapacity: true,
  maxCapacity: true,
  difficulty: true,
  minAge: true,
  included: true,
  whatToBring: true,
  schedule: true,
  parentHotelId: true,
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  locationId: true,
  authorUsername: true,
  content: true,
  rating: true,
  parentCommentId: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).pick({
  userId: true,
  token: true,
  expiresAt: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).pick({
  userId: true,
  role: true,
  businessName: true,
  businessAddress: true,
  businessPhone: true,
  vehicleType: true,
  plate: true,
  phone: true,
});

export const insertReviewSchema = createInsertSchema(reviews).pick({
  rideId: true,
  authorUsername: true,
  targetUsername: true,
  rating: true,
  comment: true,
  authorRole: true,
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).pick({
  username: true,
  type: true,
  label: true,
  details: true,
  isDefault: true,
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerUsername: text("provider_username").notNull(),
  travelerUsername: text("traveler_username"),
  type: text("type").notNull(),
  details: text("details").notNull(),
  isRead: text("is_read").default("false"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertNotificationSchema = createInsertSchema(notifications);
export const insertAvailabilitySlotSchema = createInsertSchema(availabilitySlots);
export const insertBookingSchema = createInsertSchema(bookings);
export const insertPostSchema = createInsertSchema(posts);
export const insertPostCommentSchema = createInsertSchema(postComments);

export type InsertUser = typeof users.$inferInsert;
export type InsertNotification = typeof notifications.$inferInsert;
export type InsertService = typeof services.$inferInsert;
export type InsertComment = typeof comments.$inferInsert;
export type InsertServiceView = typeof serviceViews.$inferInsert;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type InsertUserRole = typeof userRoles.$inferInsert;
export type InsertReview = typeof reviews.$inferInsert;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

export type User = typeof users.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type ServiceView = typeof serviceViews.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type UserRoleRecord = typeof userRoles.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AvailabilitySlot = typeof availabilitySlots.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostLike = typeof postLikes.$inferSelect;
export type PostComment = typeof postComments.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type ActionLog = typeof actionLogs.$inferSelect;
export type UserKeyPair = typeof userKeyPairs.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;
export type InsertActionLog = typeof actionLogs.$inferInsert;
export type InsertUserKeyPair = typeof userKeyPairs.$inferInsert;


export type LocationItem = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  image?: string | null;
  coordinates?: [number, number] | null;
  rating?: number | null;
  priceRange?: number | null;
  hasVR?: boolean | null;
  hasAR?: boolean | null;
  contact?: string | null;
  parentHotelId?: string | null;
};