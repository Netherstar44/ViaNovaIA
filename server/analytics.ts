import { sql as drizzleSql } from "drizzle-orm";
import { getDb, storage } from "./storage.js";

const PLATFORM_FEE_RATE = 0.03;
const PAID_ORDER_STATUSES = ["paid", "completed"];
const CONFIRMED_BOOKING_STATUSES = ["confirmed", "completed"];

export const VALID_ROLES = ["traveler", "hotel", "restaurant", "recreation", "taxi", "translator", "admin"];

export const ROLE_SERVICE_CATEGORY: Record<string, string | undefined> = {
  hotel: "hotel",
  restaurant: "restaurant",
  recreation: "recreation",
  taxi: "transport",
  translator: "translator",
};

type Row = Record<string, any>;
export type DashboardScope = "consumer" | "business" | "admin";

type TrendPoint = { date: string; revenue: number; expenses: number; profit: number; orders: number };

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

const rowsOf = (result: any): Row[] => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
};

const dayKey = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
};

function buildTrend(days: number): Map<string, TrendPoint> {
  const map = new Map<string, TrendPoint>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = dayKey(i);
    map.set(key, { date: key, revenue: 0, expenses: 0, profit: 0, orders: 0 });
  }
  return map;
}

function addTrend(map: Map<string, TrendPoint>, day: unknown, values: { revenue?: number; expenses?: number; orders?: number }) {
  if (!day) return;
  const key = String(day).slice(0, 10);
  const point = map.get(key);
  if (!point) return;
  point.revenue += num(values.revenue);
  point.expenses += num(values.expenses);
  point.orders += num(values.orders);
}

function finalizeTrend(map: Map<string, TrendPoint>) {
  return Array.from(map.values()).map((point) => ({
    date: point.date,
    revenue: round2(point.revenue),
    expenses: round2(point.expenses),
    profit: round2(point.revenue - point.expenses),
    orders: Math.round(point.orders),
  }));
}

/**
 * Idempotent, per-process schema safety net.
 * Keeps the dashboard/chat analytics working even on databases created before
 * the e-commerce module added cost tracking or multi-role tables.
 */
let schemaPromise: Promise<void> | null = null;
let userSchemaPromise: Promise<void> | null = null;

/**
 * Minimal columns required by the shared Drizzle `users` schema. These are
 * checked before any API route touches `storage.getUserByUsername`, because a
 * legacy database missing one of these columns would otherwise break login and
 * every authenticated request with a generic 500.
 */
export function ensureUserSchema(): Promise<void> {
  if (userSchemaPromise) return userSchemaPromise;

  userSchemaPromise = (async () => {
    const db = getDb();
    for (const statement of [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_attempts integer DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider text DEFAULT 'local'`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamp without time zone`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url text`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_email text`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_phone text`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_website text`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_visibility text DEFAULT 'private'`,
      `CREATE TABLE IF NOT EXISTS revoked_tokens (
        jti text PRIMARY KEY,
        expires_at timestamptz NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS revoked_tokens_expires_at_idx ON revoked_tokens (expires_at)`,
    ]) {
      try {
        await db.execute(drizzleSql.raw(statement));
      } catch (error: any) {
        console.warn("[analytics] user schema step skipped:", error?.message || error);
      }
    }
  })().catch((error) => {
    userSchemaPromise = null;
    throw error;
  });

  return userSchemaPromise;
}

export function ensureAnalyticsSchema(): Promise<void> {
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const db = getDb();
    const statements: Array<{ label: string; run: () => Promise<unknown> }> = [
      {
        label: "user_role enum",
        run: () => db.execute(drizzleSql`
          DO $$ BEGIN
            CREATE TYPE user_role AS ENUM ('traveler', 'hotel', 'restaurant', 'recreation', 'taxi', 'translator', 'admin');
          EXCEPTION WHEN duplicate_object THEN null; END $$;
        `),
      },
      {
        label: "user_role translator",
        run: () => db.execute(drizzleSql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'translator'`),
      },
      {
        label: "user_role admin",
        run: () => db.execute(drizzleSql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin'`),
      },
      {
        label: "service_category translator",
        run: () => db.execute(drizzleSql`ALTER TYPE service_category ADD VALUE IF NOT EXISTS 'translator'`),
      },
      {
        label: "user_roles table",
        run: () => db.execute(drizzleSql`
          CREATE TABLE IF NOT EXISTS user_roles (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role user_role NOT NULL,
            business_name text,
            business_address text,
            business_phone text,
            vehicle_type text,
            plate text,
            phone text,
            created_at timestamp DEFAULT now()
          )
        `),
      },
      {
        label: "products table",
        run: () => db.execute(drizzleSql`
          CREATE TABLE IF NOT EXISTS products (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider_username text NOT NULL,
            role_category text NOT NULL,
            name text NOT NULL,
            description text,
            price numeric(12,2) NOT NULL DEFAULT 0,
            cost numeric(12,2) NOT NULL DEFAULT 0,
            currency text NOT NULL DEFAULT 'COP',
            stock integer NOT NULL DEFAULT -1,
            is_active boolean NOT NULL DEFAULT true,
            cover_image text,
            created_at timestamp DEFAULT now(),
            updated_at timestamp DEFAULT now()
          )
        `),
      },
      {
        label: "products.cost column",
        run: () => db.execute(drizzleSql`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost numeric(12,2) NOT NULL DEFAULT 0`),
      },
      {
        label: "asset_type enum",
        run: () => db.execute(drizzleSql`
          DO $$ BEGIN
            CREATE TYPE asset_type AS ENUM ('IMAGE', 'VIDEO', 'IMAGE_360', 'MODEL_3D', 'VR_TOUR');
          EXCEPTION WHEN duplicate_object THEN null; END $$;
        `),
      },
      {
        label: "media_assets table",
        run: () => db.execute(drizzleSql`
          CREATE TABLE IF NOT EXISTS media_assets (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            owner_role text,
            entity_id varchar NOT NULL,
            entity_type text NOT NULL,
            title text,
            asset_type asset_type NOT NULL DEFAULT 'IMAGE',
            file_url text NOT NULL,
            cloudinary_public_id text,
            mime_type text,
            file_size integer NOT NULL DEFAULT 0,
            created_at timestamp DEFAULT now()
          )
        `),
      },
      {
        label: "media_assets entity index",
        run: () => db.execute(drizzleSql`
          CREATE INDEX IF NOT EXISTS idx_media_assets_entity
          ON media_assets(entity_type, entity_id, created_at)
        `),
      },
      {
        label: "orders table",
        run: () => db.execute(drizzleSql`
          CREATE TABLE IF NOT EXISTS orders (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            buyer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_id varchar NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            quantity integer NOT NULL DEFAULT 1,
            unit_price numeric(12,2) NOT NULL,
            total numeric(12,2) NOT NULL,
            status text NOT NULL DEFAULT 'pending',
            payment_intent text,
            notes text,
            created_at timestamp DEFAULT now(),
            updated_at timestamp DEFAULT now()
          )
        `),
      },
      {
        label: "orders indexes",
        run: () => db.execute(drizzleSql`CREATE INDEX IF NOT EXISTS idx_orders_product_created ON orders(product_id, created_at DESC)`),
      },
    ];

    for (const statement of statements) {
      try {
        await statement.run();
      } catch (error: any) {
        console.warn(`[analytics] schema step skipped (${statement.label}):`, error?.message || error);
      }
    }
  })();

  return schemaPromise;
}

async function querySafe(db: any, query: any, label: string): Promise<Row[]> {
  try {
    return rowsOf(await db.execute(query));
  } catch (error: any) {
    console.warn(`[analytics] ${label} unavailable:`, error?.message || error);
    return [];
  }
}

export async function getDashboardAnalytics(options: { username?: string; role?: string; days?: number }) {
  const { username, role, days = 30 } = options;
  const periodDays = Math.min(Math.max(Number(days) || 30, 7), 365);
  if (!username) {
    throw Object.assign(new Error("username es obligatorio"), { status: 400 });
  }

  await ensureAnalyticsSchema();

  const user = await storage.getUserByUsername(username);
  if (!user) {
    throw Object.assign(new Error("Usuario no encontrado"), { status: 404 });
  }

  let dbRoles: Row[] = [];
  try {
    dbRoles = await storage.getUserRoles(user.id);
  } catch {
    dbRoles = [];
  }
  // Every account can see its own consumer activity, even if it has never
  // explicitly added the traveler role. This also keeps the traveler sheet of
  // account-wide reports from silently falling back to the active business role.
  const roleOptions = Array.from(new Set([
    ...(dbRoles || []).map((r: any) => r.role),
    user.role,
    "traveler",
    ...(user.role === "admin" ? ["admin"] : []),
  ].filter(Boolean))) as string[];

  let activeRole = role && VALID_ROLES.includes(role) ? role : (user.role as string) || "traveler";
  const isAdmin = activeRole === "admin" && user.role === "admin";
  if (!isAdmin && roleOptions.length > 0 && !roleOptions.includes(activeRole)) {
    activeRole = (user.role as string) || "traveler";
  }
  if (activeRole === "admin" && user.role !== "admin") {
    activeRole = (user.role as string) || "traveler";
  }

  const scope: DashboardScope = activeRole === "admin" ? "admin" : activeRole === "traveler" ? "consumer" : "business";
  const businessRole = scope === "business" ? activeRole : undefined;
  const serviceCategory = businessRole ? ROLE_SERVICE_CATEGORY[businessRole] : undefined;
  const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const db = getDb();
  const trend = buildTrend(periodDays);
  const categoryMap = new Map<string, number>();
  const addCategory = (name: string | null | undefined, value: number) => {
    if (!name || value <= 0) return;
    categoryMap.set(name, (categoryMap.get(name) || 0) + value);
  };

  const payload: any = {
    scope,
    role: activeRole,
    roleOptions,
    days: periodDays,
    generatedAt: new Date().toISOString(),
    currency: "COP",
    user: { username: user.username, name: user.name || user.username, role: user.role },
    metrics: {} as Record<string, number>,
    trend: [] as TrendPoint[],
    categoryBreakdown: [] as Array<{ name: string; value: number }>,
    recentOrders: [] as Row[],
    recentBookings: [] as Row[],
    recentRides: [] as Row[],
    recentUsers: [] as Row[],
    topProducts: [] as Row[],
    topServices: [] as Row[],
    topProviders: [] as Row[],
    revenueByRole: [] as Array<{ role: string; revenue: number; orders: number }>,
    lowStock: [] as Row[],
    recommendations: [] as Row[],
  };

  if (scope === "consumer") {
    const orderFilter = drizzleSql`o.buyer_id = ${user.id}`;
    const bookingFilter = drizzleSql`b.traveler_username = ${username}`;
    const rideFilter = drizzleSql`r.traveler_username = ${username}`;

    const orderAggRows = await querySafe(db, drizzleSql`
      SELECT
        COUNT(*) FILTER (WHERE o.status IN ('paid', 'completed')) AS paid_orders,
        COUNT(*) FILTER (WHERE o.status = 'pending') AS pending_orders,
        COALESCE(SUM(o.total) FILTER (WHERE o.status IN ('paid', 'completed')), 0) AS spend
      FROM orders o
      WHERE ${orderFilter} AND o.created_at >= ${cutoff}
    `, "consumer orders");
    const orderAgg = orderAggRows[0] || {};

    const bookingAggRows = await querySafe(db, drizzleSql`
      SELECT
        COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed')) AS confirmed_bookings,
        COUNT(*) FILTER (WHERE b.status IN ('pending', 'reserved_temp')) AS pending_bookings,
        COALESCE(SUM(b.total_price) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0) AS spend
      FROM bookings b
      WHERE ${bookingFilter} AND b.created_at >= ${cutoff}
    `, "consumer bookings");
    const bookingAgg = bookingAggRows[0] || {};

    const rideAggRows = await querySafe(db, drizzleSql`
      SELECT
        COUNT(*) FILTER (WHERE r.status = 'completed') AS completed_rides,
        COUNT(*) FILTER (WHERE r.status IN ('pending', 'accepted', 'in_progress')) AS active_rides,
        COALESCE(SUM(r.fare) FILTER (WHERE r.status = 'completed'), 0) AS spend
      FROM rides r
      WHERE ${rideFilter} AND r.created_at >= ${cutoff}
    `, "consumer rides");
    const rideAgg = rideAggRows[0] || {};

    const reviewsRows = await querySafe(db, drizzleSql`
      SELECT COUNT(*) AS reviews FROM reviews WHERE author_username = ${username}
    `, "consumer reviews");
    const reviews = num(reviewsRows[0]?.reviews);
    const posts = num((await querySafe(db, drizzleSql`SELECT COUNT(*) AS posts FROM social_posts WHERE username = ${username}`, "consumer posts"))[0]?.posts);

    const orderRows = await querySafe(db, drizzleSql`
      SELECT o.id, o.quantity, o.total, o.status, o.created_at,
             p.name AS product_name, p.role_category, p.cover_image, p.provider_username,
             u.name AS provider_name
      FROM orders o
      JOIN products p ON p.id = o.product_id
      LEFT JOIN users u ON u.id = p.provider_id
      WHERE ${orderFilter}
      ORDER BY o.created_at DESC LIMIT 12
    `, "consumer recent orders");

    const bookingRows = await querySafe(db, drizzleSql`
      SELECT b.id, b.units, b.total_price, b.status, b.created_at,
             sv.name AS service_name, sv.category, sv.image_url,
             b.provider_username
      FROM bookings b
      LEFT JOIN availability_slots s ON s.id = b.slot_id
      LEFT JOIN services sv ON sv.id = s.service_id
      WHERE ${bookingFilter}
      ORDER BY b.created_at DESC LIMIT 12
    `, "consumer recent bookings");

    const rideRows = await querySafe(db, drizzleSql`
      SELECT r.id, r.fare, r.status, r.created_at, r.destination_address, r.distance_km, r.taxi_username
      FROM rides r
      WHERE ${rideFilter}
      ORDER BY r.created_at DESC LIMIT 12
    `, "consumer recent rides");

    const purchased = await querySafe(db, drizzleSql`
      SELECT p.id, p.name, p.cover_image, p.role_category, p.provider_username,
             SUM(o.quantity) AS units, SUM(o.total) AS spent
      FROM orders o
      JOIN products p ON p.id = o.product_id
      WHERE ${orderFilter} AND o.status IN ('paid', 'completed') AND o.created_at >= ${cutoff}
      GROUP BY p.id, p.name, p.cover_image, p.role_category, p.provider_username
      ORDER BY spent DESC LIMIT 8
    `, "consumer top products");

    const recommendations = await querySafe(db, drizzleSql`
      SELECT p.id, p.name, p.description, p.price, p.currency, p.cover_image,
             p.role_category, p.stock, p.provider_username, u.name AS provider_name
      FROM products p
      JOIN users u ON u.id = p.provider_id
      WHERE p.is_active = true AND p.stock <> 0
        AND NOT EXISTS (
          SELECT 1 FROM orders o2
          WHERE o2.product_id = p.id AND o2.buyer_id = ${user.id}
        )
      ORDER BY p.created_at DESC LIMIT 8
    `, "consumer recommendations");

    const dailyOrderRows = await querySafe(db, drizzleSql`
      SELECT to_char(o.created_at, 'YYYY-MM-DD') AS day, SUM(o.total) AS spend, COUNT(*) AS orders
      FROM orders o
      WHERE ${orderFilter} AND o.status IN ('paid', 'completed') AND o.created_at >= ${cutoff}
      GROUP BY 1
    `, "consumer order trend");
    dailyOrderRows.forEach((row) => addTrend(trend, row.day, { revenue: num(row.spend), orders: num(row.orders) }));

    const dailyBookingRows = await querySafe(db, drizzleSql`
      SELECT to_char(b.created_at, 'YYYY-MM-DD') AS day, SUM(b.total_price) AS spend, COUNT(*) AS orders
      FROM bookings b
      WHERE ${bookingFilter} AND b.status IN ('confirmed', 'completed') AND b.created_at >= ${cutoff}
      GROUP BY 1
    `, "consumer booking trend");
    dailyBookingRows.forEach((row) => addTrend(trend, row.day, { revenue: num(row.spend), orders: num(row.orders) }));

    const dailyRideRows = await querySafe(db, drizzleSql`
      SELECT to_char(r.created_at, 'YYYY-MM-DD') AS day, SUM(r.fare) AS spend, COUNT(*) AS orders
      FROM rides r
      WHERE ${rideFilter} AND r.status = 'completed' AND r.created_at >= ${cutoff}
      GROUP BY 1
    `, "consumer ride trend");
    dailyRideRows.forEach((row) => addTrend(trend, row.day, { revenue: num(row.spend), orders: num(row.orders) }));

    const categoryRows = await querySafe(db, drizzleSql`
      SELECT p.role_category AS name, SUM(o.total) AS value
      FROM orders o JOIN products p ON p.id = o.product_id
      WHERE ${orderFilter} AND o.status IN ('paid', 'completed') AND o.created_at >= ${cutoff}
      GROUP BY 1
    `, "consumer category orders");
    categoryRows.forEach((row) => addCategory(row.name, num(row.value)));
    const bookingCategoryRows = await querySafe(db, drizzleSql`
      SELECT sv.category AS name, SUM(b.total_price) AS value
      FROM bookings b LEFT JOIN availability_slots s ON s.id = b.slot_id LEFT JOIN services sv ON sv.id = s.service_id
      WHERE ${bookingFilter} AND b.status IN ('confirmed', 'completed') AND b.created_at >= ${cutoff}
      GROUP BY 1
    `, "consumer category bookings");
    bookingCategoryRows.forEach((row) => addCategory(row.name, num(row.value)));
    addCategory("taxi", num(rideAgg.spend));

    const orderSpend = num(orderAgg.spend);
    const bookingSpend = num(bookingAgg.spend);
    const rideSpend = num(rideAgg.spend);
    const totalSpent = orderSpend + bookingSpend + rideSpend;
    const orders = num(orderAgg.paid_orders);
    const bookings = num(bookingAgg.confirmed_bookings);
    const rides = num(rideAgg.completed_rides);
    const transactionCount = Math.max(1, orders + bookings + rides);
    const loyaltyPoints = Math.round(totalSpent / 50000) * 10 + orders * 5 + bookings * 8 + rides * 5;
    const level = loyaltyPoints >= 150 ? "Embajador" : loyaltyPoints >= 50 ? "Viajero Frecuente" : "Explorador";

    payload.metrics = {
      totalSpent: round2(totalSpent),
      orders,
      bookings,
      rides,
      pendingOrders: num(orderAgg.pending_orders) + num(bookingAgg.pending_bookings),
      activeRides: num(rideAgg.active_rides),
      avgTicket: round2(totalSpent / transactionCount),
      loyaltyPoints,
      reviews,
      posts,
      level,
    };
    payload.recentOrders = orderRows;
    payload.recentBookings = bookingRows;
    payload.recentRides = rideRows;
    payload.topProducts = purchased;
    payload.recommendations = recommendations;
  }

  if (scope === "business" || scope === "admin") {
    const orderScope = scope === "admin"
      ? drizzleSql``
      : drizzleSql`AND p.provider_username = ${user.username}`;
    const orderRole = businessRole
      ? drizzleSql`AND p.role_category = ${businessRole}`
      : drizzleSql``;

    const orderAggRows = await querySafe(db, drizzleSql`
      SELECT
        COUNT(*) FILTER (WHERE o.status IN ('paid', 'completed')) AS paid_orders,
        COUNT(*) FILTER (WHERE o.status = 'pending') AS pending_orders,
        COUNT(DISTINCT o.buyer_id) FILTER (WHERE o.status IN ('paid', 'completed')) AS clients,
        COALESCE(SUM(o.total) FILTER (WHERE o.status IN ('paid', 'completed')), 0) AS revenue,
        COALESCE(SUM(COALESCE(p.cost, 0) * o.quantity) FILTER (WHERE o.status IN ('paid', 'completed')), 0) AS cogs
      FROM orders o
      JOIN products p ON p.id = o.product_id
      WHERE o.created_at >= ${cutoff} ${orderScope} ${orderRole}
    `, "business orders");
    const orderAgg = orderAggRows[0] || {};

    const bookingScope = scope === "admin"
      ? drizzleSql``
      : drizzleSql`AND b.provider_username = ${user.username}`;
    const bookingCategory = serviceCategory
      ? drizzleSql`AND sv.category = ${serviceCategory}`
      : businessRole === "translator"
        ? drizzleSql`AND false`
        : drizzleSql``;

    const bookingAggRows = await querySafe(db, drizzleSql`
      SELECT
        COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed')) AS confirmed_bookings,
        COUNT(*) FILTER (WHERE b.status IN ('pending', 'reserved_temp')) AS pending_bookings,
        COALESCE(SUM(b.total_price) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0) AS revenue
      FROM bookings b
      LEFT JOIN availability_slots s ON s.id = b.slot_id
      LEFT JOIN services sv ON sv.id = s.service_id
      WHERE b.created_at >= ${cutoff} ${bookingScope} ${bookingCategory}
    `, "business bookings");
    const bookingAgg = bookingAggRows[0] || {};

    const earningsScope = scope === "admin"
      ? drizzleSql``
      : drizzleSql`AND taxi_username = ${username}`;
    const earningsAggRows = await querySafe(db, drizzleSql`
      SELECT COALESCE(SUM(amount), 0) AS revenue, COUNT(*) AS trips
      FROM earnings
      WHERE created_at >= ${cutoff} ${earningsScope}
    `, "business earnings");
    const earningsAgg = earningsAggRows[0] || {};

    const productRows = await querySafe(db, drizzleSql`
      SELECT p.*, COALESCE(p.cost, 0) AS cost
      FROM products p
      WHERE true
        ${scope === "admin" ? drizzleSql`` : drizzleSql`AND p.provider_username = ${user.username}`}
        ${businessRole ? drizzleSql`AND p.role_category = ${businessRole}` : drizzleSql``}
      ORDER BY p.created_at DESC
    `, "business products");

    const lowStock = productRows
      .filter((p) => num(p.stock) >= 0)
      .sort((a, b) => num(a.stock) - num(b.stock))
      .slice(0, 12)
      .map((p) => ({
        id: p.id,
        name: p.name,
        stock: num(p.stock),
        price: num(p.price),
        provider_username: p.provider_username,
        role_category: p.role_category,
        cover_image: p.cover_image,
      }));

    const orderRows = await querySafe(db, drizzleSql`
      SELECT o.id, o.quantity, o.unit_price, o.total, o.status, o.created_at,
             p.name AS product_name, p.role_category, p.cover_image,
             p.provider_username, u.username AS buyer_username, u.name AS buyer_name
      FROM orders o
      JOIN products p ON p.id = o.product_id
      LEFT JOIN users u ON u.id = o.buyer_id
      WHERE o.created_at >= ${cutoff} ${orderScope} ${orderRole}
      ORDER BY o.created_at DESC LIMIT 12
    `, "business recent orders");

    const bookingRows = await querySafe(db, drizzleSql`
      SELECT b.id, b.units, b.total_price, b.status, b.created_at,
             b.traveler_username, b.provider_username,
             sv.name AS service_name, sv.category, sv.image_url
      FROM bookings b
      LEFT JOIN availability_slots s ON s.id = b.slot_id
      LEFT JOIN services sv ON sv.id = s.service_id
      WHERE b.created_at >= ${cutoff} ${bookingScope} ${bookingCategory}
      ORDER BY b.created_at DESC LIMIT 12
    `, "business recent bookings");

    const rideRows = await querySafe(db, drizzleSql`
      SELECT r.id, r.fare, r.status, r.created_at, r.destination_address, r.distance_km,
             r.traveler_username, r.taxi_username
      FROM rides r
      WHERE r.created_at >= ${cutoff}
        ${scope === "admin" ? drizzleSql`` : drizzleSql`AND r.taxi_username = ${username}`}
      ORDER BY r.created_at DESC LIMIT 12
    `, "business recent rides");

    const topProducts = await querySafe(db, drizzleSql`
      SELECT p.id, p.name, p.stock, p.price, p.cover_image, p.role_category, p.provider_username,
             SUM(o.quantity) AS units, SUM(o.total) AS revenue,
             SUM(o.total - COALESCE(p.cost, 0) * o.quantity) AS margin
      FROM orders o
      JOIN products p ON p.id = o.product_id
      WHERE o.status IN ('paid', 'completed') AND o.created_at >= ${cutoff} ${orderScope} ${orderRole}
      GROUP BY p.id, p.name, p.stock, p.price, p.cover_image, p.role_category, p.provider_username
      ORDER BY revenue DESC LIMIT 8
    `, "business top products");

    const topServices = await querySafe(db, drizzleSql`
      SELECT sv.id, sv.name, sv.category, sv.provider_username, sv.image_url,
             COUNT(*) AS bookings, SUM(b.total_price) AS revenue
      FROM bookings b
      LEFT JOIN availability_slots s ON s.id = b.slot_id
      LEFT JOIN services sv ON sv.id = s.service_id
      WHERE b.status IN ('confirmed', 'completed') AND b.created_at >= ${cutoff}
        AND sv.id IS NOT NULL ${bookingScope} ${bookingCategory}
      GROUP BY sv.id, sv.name, sv.category, sv.provider_username, sv.image_url
      ORDER BY revenue DESC LIMIT 8
    `, "business top services");

    const dailyOrderRows = await querySafe(db, drizzleSql`
      SELECT to_char(o.created_at, 'YYYY-MM-DD') AS day,
             SUM(o.total) AS revenue,
             SUM(COALESCE(p.cost, 0) * o.quantity) AS cogs,
             COUNT(*) AS orders
      FROM orders o JOIN products p ON p.id = o.product_id
      WHERE o.status IN ('paid', 'completed') AND o.created_at >= ${cutoff} ${orderScope} ${orderRole}
      GROUP BY 1
    `, "business order trend");
    dailyOrderRows.forEach((row) => {
      const revenue = num(row.revenue);
      addTrend(trend, row.day, {
        revenue,
        expenses: num(row.cogs) + revenue * PLATFORM_FEE_RATE,
        orders: num(row.orders),
      });
    });

    const dailyBookingRows = await querySafe(db, drizzleSql`
      SELECT to_char(b.created_at, 'YYYY-MM-DD') AS day, SUM(b.total_price) AS revenue, COUNT(*) AS orders
      FROM bookings b
      LEFT JOIN availability_slots s ON s.id = b.slot_id
      LEFT JOIN services sv ON sv.id = s.service_id
      WHERE b.status IN ('confirmed', 'completed') AND b.created_at >= ${cutoff} ${bookingScope} ${bookingCategory}
      GROUP BY 1
    `, "business booking trend");
    dailyBookingRows.forEach((row) => {
      const revenue = num(row.revenue);
      addTrend(trend, row.day, { revenue, expenses: revenue * PLATFORM_FEE_RATE, orders: num(row.orders) });
    });

    const dailyRideRows = await querySafe(db, drizzleSql`
      SELECT to_char(created_at, 'YYYY-MM-DD') AS day, SUM(amount) AS revenue, COUNT(*) AS orders
      FROM earnings
      WHERE created_at >= ${cutoff} ${earningsScope}
      GROUP BY 1
    `, "business earnings trend");
    dailyRideRows.forEach((row) => {
      const revenue = num(row.revenue);
      addTrend(trend, row.day, { revenue, expenses: revenue * PLATFORM_FEE_RATE, orders: num(row.orders) });
    });

    const categoryRows = await querySafe(db, drizzleSql`
      SELECT p.role_category AS name, SUM(o.total) AS value
      FROM orders o JOIN products p ON p.id = o.product_id
      WHERE o.status IN ('paid', 'completed') AND o.created_at >= ${cutoff} ${orderScope} ${orderRole}
      GROUP BY 1
    `, "business category orders");
    categoryRows.forEach((row) => addCategory(row.name, num(row.value)));
    const bookingCategoryRows = await querySafe(db, drizzleSql`
      SELECT sv.category AS name, SUM(b.total_price) AS value
      FROM bookings b
      LEFT JOIN availability_slots s ON s.id = b.slot_id
      LEFT JOIN services sv ON sv.id = s.service_id
      WHERE b.status IN ('confirmed', 'completed') AND b.created_at >= ${cutoff} ${bookingScope} ${bookingCategory}
      GROUP BY 1
    `, "business category bookings");
    bookingCategoryRows.forEach((row) => addCategory(row.name, num(row.value)));
    addCategory("taxi", num(earningsAgg.revenue));

    const stockProducts = productRows.filter((p) => num(p.stock) >= 0);
    const totalStock = stockProducts.reduce((sum, p) => sum + num(p.stock), 0);
    const inventoryValue = stockProducts.reduce((sum, p) => sum + num(p.stock) * num(p.price), 0);
    const revenue = num(orderAgg.revenue) + num(bookingAgg.revenue) + num(earningsAgg.revenue);
    const cogs = num(orderAgg.cogs);
    const platformFee = revenue * PLATFORM_FEE_RATE;
    const expenses = cogs + platformFee;
    const profit = revenue - expenses;
    const orders = num(orderAgg.paid_orders) + num(bookingAgg.confirmed_bookings) + num(earningsAgg.trips);
    const ratingRows = await querySafe(db, drizzleSql`
      SELECT COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE target_username = ${username}
    `, "business rating");
    const rating = scope === "business" ? round2(num(ratingRows[0]?.avg)) : 0;

    const metrics: Record<string, number> = {
      revenue: round2(revenue),
      expenses: round2(expenses),
      cogs: round2(cogs),
      platformFee: round2(platformFee),
      profit: round2(profit),
      margin: revenue > 0 ? round2((profit / revenue) * 100) : 0,
      orders,
      paidOrders: num(orderAgg.paid_orders),
      pendingOrders: num(orderAgg.pending_orders) + num(bookingAgg.pending_bookings),
      bookings: num(bookingAgg.confirmed_bookings),
      rides: num(earningsAgg.trips),
      clients: num(orderAgg.clients),
      products: productRows.length,
      totalStock,
      lowStock: stockProducts.filter((p) => num(p.stock) > 0 && num(p.stock) < 5).length,
      outOfStock: stockProducts.filter((p) => num(p.stock) === 0).length,
      inventoryValue: round2(inventoryValue),
      avgTicket: orders > 0 ? round2(revenue / orders) : 0,
      rating,
    };

    if (scope === "admin") {
      const userRows = await querySafe(db, drizzleSql`
        SELECT
          COUNT(*) AS users,
          COUNT(*) FILTER (WHERE created_at >= ${cutoff}) AS new_users,
          COUNT(*) FILTER (WHERE role NOT IN ('traveler', 'admin')) AS providers
        FROM users
      `, "admin users");
      const userAgg = userRows[0] || {};
      const roleRows = await querySafe(db, drizzleSql`
        SELECT role, COUNT(DISTINCT user_id) AS total
        FROM user_roles
        GROUP BY role
      `, "admin roles");
      const roles = Object.fromEntries(roleRows.map((row) => [String(row.role), num(row.total)]));

      const providerRows = await querySafe(db, drizzleSql`
        SELECT p.provider_username, MAX(p.role_category) AS role_category,
               SUM(o.total) AS revenue, COUNT(*) AS orders
        FROM orders o JOIN products p ON p.id = o.product_id
        WHERE o.status IN ('paid', 'completed') AND o.created_at >= ${cutoff}
        GROUP BY p.provider_username
        ORDER BY revenue DESC LIMIT 10
      `, "admin top providers");

      const providerRevenue: Row[] = providerRows.map((row) => ({
        username: row.provider_username,
        role: row.role_category,
        revenue: round2(num(row.revenue)),
        orders: num(row.orders),
      }));
      const taxiProviderRows = await querySafe(db, drizzleSql`
        SELECT taxi_username, SUM(amount) AS revenue, COUNT(*) AS orders
        FROM earnings WHERE created_at >= ${cutoff}
        GROUP BY taxi_username ORDER BY revenue DESC LIMIT 10
      `, "admin taxi providers");
      for (const row of taxiProviderRows) {
        const existing = providerRevenue.find((p) => p.username === row.taxi_username);
        if (existing) {
          existing.revenue = round2(existing.revenue + num(row.revenue));
          existing.orders += num(row.orders);
        } else {
          providerRevenue.push({
            username: row.taxi_username,
            role: "taxi",
            revenue: round2(num(row.revenue)),
            orders: num(row.orders),
          });
        }
      }
      providerRevenue.sort((a, b) => b.revenue - a.revenue);

      const revenueByRoleMap = new Map<string, { revenue: number; orders: number }>();
      const addRoleRevenue = (roleName: string | null | undefined, amount: number, count = 0) => {
        if (!roleName) return;
        const current = revenueByRoleMap.get(roleName) || { revenue: 0, orders: 0 };
        current.revenue += amount;
        current.orders += count;
        revenueByRoleMap.set(roleName, current);
      };
      categoryRows.forEach((row) => addRoleRevenue(row.name, num(row.value)));
      bookingCategoryRows.forEach((row) => addRoleRevenue(row.name === "transport" ? "taxi" : row.name, num(row.value)));
      addRoleRevenue("taxi", num(earningsAgg.revenue), num(earningsAgg.trips));
      await querySafe(db, drizzleSql`
        SELECT p.role_category AS name, COUNT(*) AS orders
        FROM orders o JOIN products p ON p.id = o.product_id
        WHERE o.status IN ('paid', 'completed') AND o.created_at >= ${cutoff}
        GROUP BY 1
      `, "admin role orders").then((rows) => {
        rows.forEach((row) => {
          const existing = revenueByRoleMap.get(String(row.name));
          if (existing) existing.orders = Math.max(existing.orders, num(row.orders));
        });
      });

      const recentUsers = await querySafe(db, drizzleSql`
        SELECT username, name, role, email, created_at
        FROM users ORDER BY created_at DESC LIMIT 10
      `, "admin recent users");

      const adminOrders = await querySafe(db, drizzleSql`
        SELECT o.id, o.quantity, o.total, o.status, o.created_at,
               p.name AS product_name, p.role_category, p.provider_username,
               u.username AS buyer_username
        FROM orders o
        JOIN products p ON p.id = o.product_id
        LEFT JOIN users u ON u.id = o.buyer_id
        WHERE o.created_at >= ${cutoff}
        ORDER BY o.created_at DESC LIMIT 12
      `, "admin recent orders");

      const adminBookings = await querySafe(db, drizzleSql`
        SELECT b.id, b.units, b.total_price, b.status, b.created_at, b.traveler_username,
               b.provider_username, sv.name AS service_name, sv.category
        FROM bookings b
        LEFT JOIN availability_slots s ON s.id = b.slot_id
        LEFT JOIN services sv ON sv.id = s.service_id
        WHERE b.created_at >= ${cutoff}
        ORDER BY b.created_at DESC LIMIT 12
      `, "admin recent bookings");

      const adminRides = await querySafe(db, drizzleSql`
        SELECT id, fare, status, created_at, destination_address, traveler_username, taxi_username
        FROM rides WHERE created_at >= ${cutoff}
        ORDER BY created_at DESC LIMIT 12
      `, "admin recent rides");

      Object.assign(metrics, {
        users: num(userAgg.users),
        newUsers: num(userAgg.new_users),
        providers: num(userAgg.providers),
        hotelProviders: roles.hotel || 0,
        restaurantProviders: roles.restaurant || 0,
        recreationProviders: roles.recreation || 0,
        taxiProviders: roles.taxi || 0,
        translatorProviders: roles.translator || 0,
      });

      payload.recentUsers = recentUsers;
      payload.recentOrders = adminOrders;
      payload.recentBookings = adminBookings;
      payload.recentRides = adminRides;
      payload.topProviders = providerRevenue.slice(0, 10);
      payload.revenueByRole = Array.from(revenueByRoleMap.entries())
        .map(([roleName, value]) => ({ role: roleName, revenue: round2(value.revenue), orders: value.orders }))
        .sort((a, b) => b.revenue - a.revenue);
    } else {
      payload.recentOrders = orderRows;
      payload.recentBookings = bookingRows;
      payload.recentRides = rideRows;
    }

    payload.metrics = metrics;
    payload.topProducts = topProducts;
    payload.topServices = topServices;
    payload.lowStock = lowStock;
  }

  payload.trend = finalizeTrend(trend);
  payload.categoryBreakdown = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value: round2(value) }))
    .sort((a, b) => b.value - a.value);

  return payload;
}
