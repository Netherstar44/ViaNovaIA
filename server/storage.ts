import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, and, sql as drizzleSql } from "drizzle-orm";
import {
  users,
  messages,
  conversations,
  media,
  services,
  comments,
  passwordResetTokens,
  userRoles,
  reviews,
  paymentMethods,
  notifications,
  type User,
  type InsertUser,
  type Message,
  type Conversation,
  type Service,
  type Comment,
  type InsertService,
  type InsertComment,
  type PasswordResetToken,
  type UserRoleRecord,
  type InsertUserRole,
  type Review,
  type InsertReview,
  type PaymentMethod,
  type InsertPaymentMethod,
  type Notification as DbNotification,
  type InsertNotification
} from "../shared/schema.js";

// Storage interface for DB-backed operations
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  updateUserRole(userId: string, role: string): Promise<User>;
  updateUserProfile(userId: string, data: { name?: string; email?: string }): Promise<User>;
  upsertConversation(userId: string, title?: string): Promise<Conversation>;
  addMessage(conversationId: string, role: string, content: string, metadata?: any): Promise<Message>;
  getMessages(conversationId: string, limit?: number): Promise<Message[]>;
  insertService(svc: InsertService): Promise<Service>;
  updateService(id: string, data: Partial<InsertService>): Promise<Service>;
  deleteService(id: string, providerUsername: string): Promise<void>;
  listServicesByCategory(category: string): Promise<Service[]>;
  listProviderServices(providerUsername: string): Promise<Service[]>;
  listServicesByCity(city: string): Promise<Service[]>;
  insertComment(cmt: InsertComment): Promise<Comment>;
  listCommentsByLocation(locationId: string): Promise<Comment[]>;
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(token: string): Promise<void>;
  
  insertNotification(data: InsertNotification): Promise<DbNotification>;
  getProviderNotifications(providerUsername: string): Promise<DbNotification[]>;
  markNotificationAsRead(id: string): Promise<void>;
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = neon(url);
  return drizzle({ client: sql });
}

export class DbStorage implements IStorage {
  async insertService(svc: InsertService): Promise<Service> {
    const db = getDb();
    const rows = await db.insert(services).values(svc).returning();
    return rows[0];
  }

  async updateService(id: string, data: Partial<InsertService>): Promise<Service> {
    const db = getDb();
    const rows = await db.update(services).set(data as any).where(eq(services.id, id)).returning();
    return rows[0];
  }

  async deleteService(id: string, providerUsername: string): Promise<void> {
    const db = getDb();
    await db.delete(services).where(and(eq(services.id, id), eq(services.providerUsername, providerUsername)));
  }

  async listServicesByCategory(category: string): Promise<Service[]> {
    const db = getDb();
    return await db.select().from(services).where(eq(services.category, category as any));
  }

  async listProviderServices(providerUsername: string): Promise<Service[]> {
    const db = getDb();
    return await db.select().from(services).where(eq(services.providerUsername, providerUsername));
  }

  async listServicesByCity(city: string): Promise<Service[]> {
    const db = getDb();
    // Case-insensitive match on city column (added by seed script)
    const rows = await db.execute(
      drizzleSql`SELECT * FROM services WHERE lower(city) LIKE lower(${'%' + city + '%'}) ORDER BY rating DESC NULLS LAST LIMIT 20`
    );
    return (rows as any).rows ?? (rows as any) ?? [];
  }

  async insertComment(cmt: InsertComment): Promise<Comment> {
    const db = getDb();
    const rows = await db.insert(comments).values(cmt).returning();
    return rows[0];
  }

  async insertNotification(data: InsertNotification): Promise<DbNotification> {
    const db = getDb();
    const rows = await db.insert(notifications).values(data).returning();
    return rows[0];
  }

  async getProviderNotifications(providerUsername: string): Promise<DbNotification[]> {
    const db = getDb();
    return await db.select().from(notifications).where(eq(notifications.providerUsername, providerUsername)).orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(id: string): Promise<void> {
    const db = getDb();
    await db.update(notifications).set({ isRead: "true" }).where(eq(notifications.id, id));
  }

  async listCommentsByLocation(locationId: string): Promise<Comment[]> {
    const db = getDb();
    return await db.select().from(comments).where(eq(comments.locationId, locationId)).orderBy(desc(comments.createdAt));
  }

  async getUser(id: string): Promise<User | undefined> {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0];
  }

  async getUserByUsername(usernameVal: string): Promise<User | undefined> {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.username, usernameVal));
    return rows[0];
  }

  async getUserByEmail(emailVal: string): Promise<User | undefined> {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.email, emailVal));
    return rows[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const db = getDb();
    const rows = await db.insert(users).values(insertUser).returning();
    return rows[0];
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    const db = getDb();
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }

  async updateUserRole(userId: string, role: string): Promise<User> {
    const db = getDb();
    const rows = await db.update(users).set({ role: role as any, roleChangedAt: new Date() }).where(eq(users.id, userId)).returning();
    if (!rows.length) throw new Error("User not found");
    return rows[0];
  }

  async updateUserProfile(userId: string, data: { name?: string; email?: string }): Promise<User> {
    const db = getDb();
    const rows = await db.update(users).set(data).where(eq(users.id, userId)).returning();
    if (!rows.length) throw new Error("User not found");
    return rows[0];
  }

  // Cambiar rol activo sin cooldown (sistema multi-rol)
  async setActiveRole(userId: string, role: string): Promise<User> {
    const db = getDb();
    const rows = await db.update(users).set({ role: role as any }).where(eq(users.id, userId)).returning();
    return rows[0];
  }

  async upsertConversation(userId: string, title?: string): Promise<Conversation> {
    const db = getDb();
    const existing = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(1);
    if (existing[0]) return existing[0];
    const created = await db
      .insert(conversations)
      .values({ userId, title: title || "Conversación" })
      .returning();
    return created[0];
  }

  async addMessage(conversationId: string, role: string, content: string, metadata?: any): Promise<Message> {
    const db = getDb();
    const created = await db
      .insert(messages)
      .values({ conversationId, role, content, metadata })
      .returning();
    return created[0];
  }

  async getMessages(conversationId: string, limit: number = 15): Promise<Message[]> {
    const db = getDb();
    // Fetch the last `limit` messages, ordered ascending so they appear in correct timeline order
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    return rows.reverse(); // Return in chronological order for the LLM
  }

  // --- Password Reset Tokens ---

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const db = getDb();
    const rows = await db.insert(passwordResetTokens).values({ userId, token, expiresAt }).returning();
    return rows[0];
  }

  async getPasswordResetToken(tokenVal: string): Promise<PasswordResetToken | undefined> {
    const db = getDb();
    const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, tokenVal));
    return rows[0];
  }

  async deletePasswordResetToken(tokenVal: string): Promise<void> {
    const db = getDb();
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, tokenVal));
  }

  // ── USER ROLES (Multi-rol) ─────────────────────────────────────────────────

  async getUserRoles(userId: string): Promise<UserRoleRecord[]> {
    const db = getDb();
    return await db.select().from(userRoles).where(eq(userRoles.userId, userId)).orderBy(desc(userRoles.createdAt));
  }

  async getUserRolesByUsername(username: string): Promise<UserRoleRecord[]> {
    const db = getDb();
    const user = await this.getUserByUsername(username);
    if (!user) return [];
    return this.getUserRoles(user.id);
  }

  async addUserRole(data: InsertUserRole): Promise<UserRoleRecord> {
    const db = getDb();
    // Check if role already exists
    const existing = await db.select().from(userRoles)
      .where(and(eq(userRoles.userId, data.userId), eq(userRoles.role, data.role as any)));
    if (existing.length > 0) {
      // Update existing role data
      const rows = await db.update(userRoles)
        .set({
          businessName: data.businessName,
          businessAddress: data.businessAddress,
          businessPhone: data.businessPhone,
          vehicleType: data.vehicleType,
          plate: data.plate,
          phone: data.phone,
        })
        .where(eq(userRoles.id, existing[0].id))
        .returning();
      return rows[0];
    }
    const rows = await db.insert(userRoles).values(data as any).returning();
    return rows[0];
  }

  async removeUserRole(userId: string, role: string): Promise<void> {
    const db = getDb();
    await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, role as any)));
  }

  async getUserRoleData(userId: string, role: string): Promise<UserRoleRecord | undefined> {
    const db = getDb();
    const rows = await db.select().from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role as any)));
    return rows[0];
  }

  async updateUserRoleData(userId: string, role: string, data: Partial<InsertUserRole>): Promise<UserRoleRecord> {
    const db = getDb();
    const rows = await db.update(userRoles)
      .set(data as any)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role as any)))
      .returning();
    return rows[0];
  }

  // ── REVIEWS ─────────────────────────────────────────────────────────────────

  async createReview(data: InsertReview): Promise<Review> {
    const db = getDb();
    const rows = await db.insert(reviews).values(data as any).returning();
    return rows[0];
  }

  async getReviewsByUsername(username: string): Promise<Review[]> {
    const db = getDb();
    return await db.select().from(reviews)
      .where(eq(reviews.targetUsername, username))
      .orderBy(desc(reviews.createdAt));
  }

  async getReviewsByRide(rideId: string): Promise<Review[]> {
    const db = getDb();
    return await db.select().from(reviews)
      .where(eq(reviews.rideId, rideId));
  }

  async getAverageRating(username: string): Promise<number> {
    const db = getDb();
    const result = await db.select({
      avg: drizzleSql<number>`COALESCE(AVG(${reviews.rating}), 0)`
    }).from(reviews).where(eq(reviews.targetUsername, username));
    return Math.round((Number(result[0]?.avg ?? 0)) * 10) / 10;
  }

  async hasReviewedRide(rideId: string, authorUsername: string): Promise<boolean> {
    const db = getDb();
    const rows = await db.select().from(reviews)
      .where(and(eq(reviews.rideId, rideId), eq(reviews.authorUsername, authorUsername)));
    return rows.length > 0;
  }

  // ── PAYMENT METHODS ────────────────────────────────────────────────────────

  async getPaymentMethods(username: string): Promise<PaymentMethod[]> {
    const db = getDb();
    return await db.select().from(paymentMethods)
      .where(eq(paymentMethods.username, username))
      .orderBy(desc(paymentMethods.createdAt));
  }

  async addPaymentMethod(data: InsertPaymentMethod): Promise<PaymentMethod> {
    const db = getDb();
    // If setting as default, unset other defaults first
    if (data.isDefault === "true") {
      await db.update(paymentMethods)
        .set({ isDefault: "false" })
        .where(eq(paymentMethods.username, data.username));
    }
    const rows = await db.insert(paymentMethods).values(data as any).returning();
    return rows[0];
  }

  async removePaymentMethod(id: string, username: string): Promise<void> {
    const db = getDb();
    await db.delete(paymentMethods).where(and(eq(paymentMethods.id, id), eq(paymentMethods.username, username)));
  }

  async setDefaultPaymentMethod(id: string, username: string): Promise<void> {
    const db = getDb();
    // Unset all defaults
    await db.update(paymentMethods)
      .set({ isDefault: "false" })
      .where(eq(paymentMethods.username, username));
    // Set new default
    await db.update(paymentMethods)
      .set({ isDefault: "true" })
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.username, username)));
  }

  // ── USER PROFILE (público) ─────────────────────────────────────────────────

  async getUserProfile(username: string): Promise<{
    username: string;
    name: string | null;
    role: string | null;
    avatarUrl: string | null;
    roles: UserRoleRecord[];
    averageRating: number;
    reviewCount: number;
  } | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    const [roles, avgRating, revs] = await Promise.all([
      this.getUserRoles(user.id),
      this.getAverageRating(username),
      this.getReviewsByUsername(username),
    ]);
    return {
      username: user.username,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      roles,
      averageRating: avgRating,
      reviewCount: revs.length,
    };
  }
}

export const storage = new DbStorage();
