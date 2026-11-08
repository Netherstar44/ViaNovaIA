import { sql, type SQL } from "drizzle-orm";
import { getDb } from "./storage.js";
import { normalizeCatalogMedia, type CatalogMedia } from "../shared/catalog-media.js";
export async function attachCatalogMedia<T extends { id: string }>(records: T[], entityType: "service" | "product", execute: (query: SQL) => PromiseLike<any> = query => getDb().execute(query)): Promise<(T & { media: CatalogMedia[] })[]> {
  if (!records.length) return [];
  const ids = records.map(row => sql`${row.id}`);
  const ownership = entityType === 'service'
    ? sql`EXISTS (SELECT 1 FROM services s JOIN users u ON u.username = s.provider_username WHERE s.id = m.entity_id AND u.id = m.owner_id)`
    : sql`EXISTS (SELECT 1 FROM products p WHERE p.id = m.entity_id AND p.provider_id = m.owner_id)`;
  const result = await execute(sql`
    SELECT m.id, m.entity_id, m.asset_type::text AS type, m.file_url AS url, m.title AS caption
    FROM media_assets m WHERE m.entity_type = ${entityType}
      AND m.entity_id IN (${sql.join(ids, sql`, `)}) AND ${ownership}
    ORDER BY m.created_at ASC, m.id ASC
  `);
  const rows = ((result as any).rows ?? result) as any[];
  const grouped = new Map<string, any[]>();
  for (const row of rows) { const list = grouped.get(row.entity_id) ?? []; list.push(row); grouped.set(row.entity_id, list); }
  return records.map(row => ({ ...row, media: normalizeCatalogMedia(grouped.get(row.id)) }));
}
