import { neon } from "@neondatabase/serverless";
import { sql as drizzleSql } from "drizzle-orm";
import { getDb } from "./storage.js";
import { ensureAnalyticsSchema } from "./analytics.js";

/**
 * Catálogo restringido del asistente.
 *
 * El chatbot NUNCA consulta las tablas públicas de la aplicación. Todo el
 * contenido turístico (servicios y productos) se expone a través de la vista
 * `catalog.catalog_items`. En producción el proceso puede usar una cadena de
 * conexión distinta (`CATALOG_DATABASE_URL`) con un rol de sólo lectura que
 * únicamente tiene privilegios sobre esa vista.
 */

export type CatalogItemType = "service" | "product";

export type CatalogItem = {
  itemType: CatalogItemType;
  itemId: string;
  category: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  currency: string;
  rating: number | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  department: string | null;
  providerUsername: string;
  duration: string | null;
  schedule: string | null;
  stock: number | null;
  priceType: string | null;
};

export const CATALOG_VIEW = "catalog.catalog_items";
export const CATALOG_ROLE = "vianova_catalog_reader";

let schemaPromise: Promise<void> | null = null;

function catalogSqlClient() {
  const url = process.env.CATALOG_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("CATALOG_DATABASE_URL/DATABASE_URL not set");
  return neon(url);
}

function rowsOf(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

export function normalizeCatalogText(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function isCatalogRestricted(): boolean {
  return Boolean(process.env.CATALOG_DATABASE_URL);
}

/**
 * Crea (de forma idempotente) las columnas de catálogo y la vista restringida.
 * Se ejecuta con la conexión administrativa porque es una migración, no una
 * consulta del asistente.
 */
export function ensureCatalogSchema(): Promise<void> {
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await ensureAnalyticsSchema();
    const db = getDb();

    const statements = [
      `CREATE SCHEMA IF NOT EXISTS catalog`,
      `ALTER TABLE services ADD COLUMN IF NOT EXISTS city text`,
      `ALTER TABLE services ADD COLUMN IF NOT EXISTS department text`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS city text`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS department text`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS latitude double precision`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS longitude double precision`,
    ];
    for (const statement of statements) {
      await db.execute(drizzleSql.raw(statement));
    }

    await db.execute(drizzleSql.raw(`
      CREATE OR REPLACE VIEW catalog.catalog_items AS
      SELECT
        'service'::text AS item_type,
        s.id AS item_id,
        s.category::text AS category,
        s.name AS name,
        COALESCE(s.description, '') AS description,
        s.image_url AS image_url,
        COALESCE(s.price, 0)::numeric(12,2) AS price,
        COALESCE(s.currency, 'COP') AS currency,
        s.rating::numeric AS rating,
        CASE
          WHEN s.location_lat ~ '^-?[0-9]+([.][0-9]+)?$' THEN s.location_lat::double precision
          ELSE NULL
        END AS latitude,
        CASE
          WHEN s.location_lng ~ '^-?[0-9]+([.][0-9]+)?$' THEN s.location_lng::double precision
          ELSE NULL
        END AS longitude,
        NULLIF(btrim(s.city), '') AS city,
        NULLIF(btrim(s.department), '') AS department,
        s.provider_username AS provider_username,
        s.duration AS duration,
        s.schedule AS schedule,
        NULL::integer AS stock,
        true AS is_active,
        s.price_type AS price_type,
        lower(concat_ws(' ',
          s.name, s.description, s.category::text, s.provider_username,
          s.city, s.department, s.duration, s.schedule, s.price_type
        )) AS search_text,
        s.created_at AS created_at
      FROM services s
      UNION ALL
      SELECT
        'product'::text AS item_type,
        p.id AS item_id,
        p.role_category AS category,
        p.name AS name,
        COALESCE(p.description, '') AS description,
        COALESCE(p.cover_image, img.file_url) AS image_url,
        COALESCE(p.price, 0)::numeric(12,2) AS price,
        COALESCE(p.currency, 'COP') AS currency,
        NULL::numeric AS rating,
        p.latitude AS latitude,
        p.longitude AS longitude,
        NULLIF(btrim(p.city), '') AS city,
        NULLIF(btrim(p.department), '') AS department,
        p.provider_username AS provider_username,
        NULL::text AS duration,
        NULL::text AS schedule,
        p.stock AS stock,
        p.is_active AS is_active,
        NULL::text AS price_type,
        lower(concat_ws(' ',
          p.name, p.description, p.role_category, p.provider_username,
          p.city, p.department
        )) AS search_text,
        p.created_at AS created_at
      FROM products p
      LEFT JOIN LATERAL (
        SELECT ma.file_url
        FROM media_assets ma
        WHERE ma.entity_id = p.id
          AND ma.entity_type = 'product'
          AND ma.asset_type = 'IMAGE'
        ORDER BY ma.created_at ASC
        LIMIT 1
      ) img ON true
      WHERE p.is_active = true
    `));

    // Si el rol restringido ya existe, refrescamos sus permisos. El alta del
    // rol (con contraseña) la hace scripts/seed-neiva.mjs.
    try {
      const role = await db.execute(
        drizzleSql`SELECT 1 FROM pg_roles WHERE rolname = ${CATALOG_ROLE} LIMIT 1`,
      );
      if (rowsOf(role).length > 0) {
        await db.execute(drizzleSql.raw(`GRANT USAGE ON SCHEMA catalog TO ${CATALOG_ROLE}`));
        await db.execute(drizzleSql.raw(`GRANT SELECT ON ${CATALOG_VIEW} TO ${CATALOG_ROLE}`));
      }
    } catch (error: any) {
      console.warn("[catalog] no se pudieron refrescar permisos del rol:", error?.message || error);
    }
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });

  return schemaPromise;
}

export type CatalogSearchOptions = {
  city?: string | null;
  category?: string | null;
  query?: string | null;
  limit?: number;
};

/**
 * Única puerta de lectura del chatbot hacia datos turísticos. Si existe
 * CATALOG_DATABASE_URL se usa esa conexión; en cualquier caso sólo se consulta
 * la vista restringida.
 */
export async function searchCatalog(options: CatalogSearchOptions = {}): Promise<CatalogItem[]> {
  await ensureCatalogSchema();
  const sql = catalogSqlClient();

  const clauses: string[] = ["is_active = true"];
  const params: unknown[] = [];

  const city = normalizeCatalogText(options.city);
  if (city) {
    params.push(`%${city}%`);
    clauses.push(`lower(coalesce(city, '')) LIKE $${params.length}`);
  }

  const category = normalizeCatalogText(options.category);
  if (category && category !== "all" && category !== "todos") {
    params.push(category);
    clauses.push(`lower(category) = $${params.length}`);
  }

  const query = normalizeCatalogText(options.query);
  if (query) {
    const tokens = query
      .replace(/[^a-z0-9áéíóúñü ]/gi, " ")
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
      .slice(0, 6);
    if (tokens.length > 0) {
      const tokenClauses = tokens.map((token) => {
        params.push(`%${token}%`);
        return `search_text LIKE $${params.length}`;
      });
      clauses.push(`(${tokenClauses.join(" OR ")})`);
    }
  }

  const limit = Math.min(Math.max(Number(options.limit) || 40, 1), 80);
  params.push(limit);

  const result = await sql(
    `SELECT item_type, item_id, category, name, description, image_url,
            price, currency, rating, latitude, longitude, city, department,
            provider_username, duration, schedule, stock, price_type
     FROM ${CATALOG_VIEW}
     WHERE ${clauses.join(" AND ")}
     ORDER BY (rating IS NULL) ASC, rating DESC NULLS LAST, price ASC
     LIMIT $${params.length}`,
    params,
  );

  return rowsOf(result).map((row: any) => ({
    itemType: row.item_type === "product" ? "product" : "service",
    itemId: String(row.item_id),
    category: String(row.category || "").toLowerCase(),
    name: String(row.name || ""),
    description: String(row.description || ""),
    imageUrl: row.image_url ? String(row.image_url) : null,
    price: Number(row.price || 0),
    currency: String(row.currency || "COP"),
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    city: row.city ? String(row.city) : null,
    department: row.department ? String(row.department) : null,
    providerUsername: String(row.provider_username || ""),
    duration: row.duration ? String(row.duration) : null,
    schedule: row.schedule ? String(row.schedule) : null,
    stock: row.stock === null || row.stock === undefined ? null : Number(row.stock),
    priceType: row.price_type ? String(row.price_type) : null,
  }));
}

export function catalogCategoryLabel(category: string): string {
  const key = normalizeCatalogText(category);
  if (key.startsWith("hotel")) return "HOTEL";
  if (key.startsWith("restaurant") || key.startsWith("comida")) return "RESTAURANTE";
  if (key.startsWith("recreation") || key.startsWith("actividad") || key.startsWith("tour")) return "RECREACIÓN";
  if (key.startsWith("transport") || key.startsWith("taxi")) return "TRANSPORTE";
  if (key.startsWith("translator")) return "TRADUCTOR";
  return key.toUpperCase();
}

export function formatCatalogItem(item: CatalogItem): string {
  const price = Number(item.price || 0).toLocaleString("es-CO");
  const rating = item.rating !== null ? ` | ${item.rating}★` : "";
  const duration = item.duration ? ` | ${item.duration}` : "";
  const schedule = item.schedule ? ` | ${item.schedule}` : "";
  const city = item.city ? ` | ${item.city}` : "";
  const description = item.description
    ? ` — ${item.description.replace(/\s+/g, " ").slice(0, 180)}`
    : "";
  return `- [${catalogCategoryLabel(item.category)}] **${item.name}** | $${price} ${item.currency}${rating}${duration}${schedule}${city} | @${item.providerUsername}${description}`;
}

export type CatalogContext = {
  city: string | null;
  items: CatalogItem[];
  context: string;
};

/**
 * Respuesta determinista cuando el proveedor de IA no está disponible. Usa
 * exactamente los mismos items de la vista restringida, sin inventar datos.
 */
export function buildCatalogFallbackReply(
  items: CatalogItem[],
  city: string | null,
  language = "es",
): string {
  if (items.length === 0) {
    const label = city || (language === "en" ? "that destination" : "ese destino");
    return language === "en"
      ? `I don't have active services or products for ${label} in the VIANova catalog yet. Try another destination or category.`
      : `Aún no tengo servicios ni productos activos para ${label} en el catálogo de VIANova. Prueba con otra ciudad o categoría.`;
  }

  const groupOrder = ["hotel", "restaurant", "recreation", "transport", "translator"];
  const grouped = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const key = groupOrder.find((prefix) => normalizeCatalogText(item.category).startsWith(prefix)) || "otros";
    const list = grouped.get(key) || [];
    list.push(item);
    grouped.set(key, list);
  }

  const title = language === "en"
    ? `Here is what the VIANova catalog has${city ? ` in ${city}` : ""}:`
    : `Esto es lo que el catálogo de VIANova tiene${city ? ` en ${city}` : ""}:`;
  const lines: string[] = [title];

  for (const key of [...groupOrder, "otros"]) {
    const list = (grouped.get(key) || []).slice(0, 4);
    if (list.length === 0) continue;
    const heading = language === "en"
      ? ({ hotel: "Hotels", restaurant: "Restaurants", recreation: "Activities", transport: "Transport", translator: "Translators", otros: "Other" } as Record<string, string>)[key]
      : ({ hotel: "Hoteles", restaurant: "Restaurantes", recreation: "Actividades", transport: "Transporte", translator: "Traductores", otros: "Otros" } as Record<string, string>)[key];
    lines.push(`\n**${heading}**`);
    for (const item of list) {
      lines.push(formatCatalogItem(item));
    }
  }

  lines.push(
    language === "en"
      ? "\nAll names and prices above come from the restricted VIANova catalog. Tell me your dates and budget and I can build a route."
      : "\nTodos los nombres y precios de arriba vienen del catálogo restringido de VIANova. Dime fechas y presupuesto y armo una ruta.",
  );
  return lines.join("\n");
}

/**
 * Construye el bloque que se inyecta al prompt. No incluye IDs internos de
 * usuarios ni tablas: sólo los campos públicos de la vista de catálogo.
 */
export async function buildCatalogContext(options: {
  city?: string | null;
  query?: string | null;
  limit?: number;
} = {}): Promise<CatalogContext> {
  const city = options.city ? String(options.city).trim() : null;
  const items = await searchCatalog({
    city,
    query: options.query,
    limit: options.limit ?? 40,
  });

  if (items.length === 0) {
    const label = city ? city.toUpperCase() : "LA PLATAFORMA";
    return {
      city,
      items,
      context: `\n\n---\n**CATÁLOGO VIANOVA — ${label}**\nNo hay servicios ni productos activos que coincidan con esta búsqueda en el catálogo de VIANova. Dilo con honestidad y ofrece otra ciudad o categoría; nunca inventes establecimientos ni precios.`,
    };
  }

  const label = city ? city.toUpperCase() : "RESULTADOS DE BÚSQUEDA";
  const lines = items.map(formatCatalogItem).join("\n");
  return {
    city,
    items,
    context: `\n\n---\n**CATÁLOGO REAL DE VIANOVA — ${label}**\n${lines}\n\n> INSTRUCCIÓN CRÍTICA: usa EXCLUSIVAMENTE los servicios y productos listados arriba. Nunca inventes hoteles, restaurantes, actividades, precios ni proveedores. Si algo no está en esta lista, di que aún no está disponible en VIANova.`,
  };
}
