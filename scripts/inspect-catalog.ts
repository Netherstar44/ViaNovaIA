/** Read-only audit. Never starts the app, runs migrations, or reads biometric templates. */
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { PgDialect } from "drizzle-orm/pg-core";
import { mkdir, writeFile } from "node:fs/promises";
import { attachCatalogMedia } from "../server/catalog-media.js";
dotenv.config({ quiet: true });
async function main() {
if (!process.env.DATABASE_URL) throw new Error("Configura DATABASE_URL sin publicarla en el repositorio.");
const query = neon(process.env.DATABASE_URL), dialect = new PgDialect();
const execute = async (statement: any) => {
  const compiled = dialect.sqlToQuery(statement);
  const [rows] = await query.transaction([query(compiled.sql, compiled.params)], { readOnly: true });
  return { rows };
};
const [services, products, assets, identity] = await query.transaction([
  query`SELECT id,category,name,description,image_url AS "imageUrl",location_lat AS "locationLat",location_lng AS "locationLng",rating,price,parent_hotel_id AS "parentHotelId" FROM services ORDER BY created_at,id`,
  query`SELECT p.id,p.name,p.description,p.price,p.currency,p.stock,p.cover_image,p.role_category,p.provider_username,u.name AS provider_name,u.avatar_url FROM products p JOIN users u ON u.id=p.provider_id WHERE p.is_active=true ORDER BY p.created_at DESC`,
  query`SELECT entity_type,asset_type::text,count(*)::int AS count FROM media_assets WHERE entity_type IN ('service','product') GROUP BY entity_type,asset_type`,
  query`SELECT to_regclass('public.identity_verifications') IS NOT NULL AS identity_table,to_regclass('public.identity_audit') IS NOT NULL AS audit_table`,
], { readOnly: true, isolationLevel: 'RepeatableRead' });
const serviceMedia = await attachCatalogMedia(services, 'service', execute);
const productMedia = await attachCatalogMedia(products, 'product', execute);
const summary = { mode: 'READ ONLY', services: services.length, activeProducts: products.length, assets, identity,
  attachedServiceAssets: serviceMedia.reduce((n, row) => n + row.media.length, 0), attachedProductAssets: productMedia.reduce((n, row) => n + row.media.length, 0),
  faceConfigured: { encryption: !!process.env.BIOMETRIC_ENCRYPTION_KEY, threshold: !!process.env.FACE_DISTANCE_THRESHOLD, calibration: !!process.env.FACE_CALIBRATION_ID, approved: process.env.FACE_CALIBRATION_APPROVED === "true" } };
await mkdir('_capture-catalog', { recursive: true });
await writeFile('_capture-catalog/summary.json', JSON.stringify(summary, null, 2));
if (process.argv.includes('--ui-fixture')) {
  // Only existing public catalog fields; no users table dump, documents or templates.
  await writeFile('_capture-catalog/api-fixture.json', JSON.stringify({ services: serviceMedia.map(s => ({ ...s, responsibleVerified: false })), products: productMedia }));
}
console.info(JSON.stringify(summary, null, 2));
}
main().catch(error => {
  console.error('No se pudo completar la consulta de solo lectura:', error?.code ?? error?.name ?? 'error');
  process.exitCode = 1;
});
