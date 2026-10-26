import "dotenv/config";
import fs from "node:fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { v2 as cloudinary } from "cloudinary";
import {
  NEIVA_DATA,
  makePosterPng,
  makeLandmarkGlb,
} from "./neiva-assets.mjs";
import { ensureCatalogSchema } from "../server/catalog.js";
import { ensureTripSchema } from "../server/trips.js";

const argv = new Set(process.argv.slice(2));
const REUSE_ASSETS = argv.has("--reuse-assets");
const ASSETS_ONLY = argv.has("--assets-only");
const DB_ONLY = argv.has("--db-only");

const CACHE_PATH = "scripts/.neiva-assets-cache.json";
const CATALOG_ROLE = "vianova_catalog_reader";

function must(value, name) {
  if (!value) throw new Error(`Falta ${name} en el entorno`);
  return value;
}

const databaseUrl = must(process.env.DATABASE_URL, "DATABASE_URL");
const sql = neon(databaseUrl);
const rowsOf = (result) => (Array.isArray(result) ? result : result?.rows || []);
const q = async (text, params = []) => rowsOf(await sql(text, params));

function log(message) {
  console.log(`[seed-neiva] ${message}`);
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    stream.end(buffer);
  });
}

async function uploadAssets() {
  cloudinary.config({
    cloud_name: must(process.env.CLOUDINARY_CLOUD_NAME, "CLOUDINARY_CLOUD_NAME"),
    api_key: must(process.env.CLOUDINARY_API_KEY, "CLOUDINARY_API_KEY"),
    api_secret: must(process.env.CLOUDINARY_API_SECRET, "CLOUDINARY_API_SECRET"),
    secure: true,
  });

  if (REUSE_ASSETS && fs.existsSync(CACHE_PATH)) {
    const cached = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    if (Array.isArray(cached.images) && cached.images.length === 48 && Array.isArray(cached.models) && cached.models.length === 12) {
      log("usando 48 imágenes y 12 modelos 3D cacheados");
      return cached;
    }
  }

  log("generando y subiendo 48 pósters PNG a Cloudinary...");
  const images = await mapLimit(Array.from({ length: 48 }, (_, index) => index), 4, async (index) => {
    const buffer = makePosterPng(index);
    const result = await uploadBuffer(buffer, {
      resource_type: "image",
      folder: "vianova/neiva/images",
      public_id: `neiva-poster-${String(index + 1).padStart(2, "0")}`,
      format: "png",
      overwrite: true,
      invalidate: true,
    });
    log(`imagen ${index + 1}/48 subida (${Math.round(buffer.length / 1024)} KB)`);
    return { url: result.secure_url, publicId: result.public_id, bytes: buffer.length };
  });

  log("generando y subiendo 12 modelos GLB...");
  const models = await mapLimit(Array.from({ length: 12 }, (_, index) => index), 3, async (index) => {
    const buffer = makeLandmarkGlb(index);
    const result = await uploadBuffer(buffer, {
      resource_type: "raw",
      folder: "vianova/neiva/3d",
      public_id: `neiva-landmark-${String(index + 1).padStart(2, "0")}.glb`,
      overwrite: true,
      invalidate: true,
    });
    log(`modelo ${index + 1}/12 subido (${Math.round(buffer.length / 1024)} KB)`);
    return { url: result.secure_url, publicId: result.public_id, bytes: buffer.length };
  });

  const cache = { images, models, generatedAt: new Date().toISOString() };
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  log(`assets cacheados en ${CACHE_PATH}`);
  return cache;
}

async function cleanupPreviousSeed(demo, serviceNames, productNames) {
  const services = await q(
    "SELECT id FROM services WHERE provider_username = $1 AND name = ANY($2::text[])",
    [demo.username, serviceNames],
  );
  const serviceIds = services.map((row) => row.id);
  const products = await q(
    "SELECT id FROM products WHERE provider_username = $1 AND name = ANY($2::text[])",
    [demo.username, productNames],
  );
  const productIds = products.map((row) => row.id);

  if (serviceIds.length > 0) {
    await q("DELETE FROM comments WHERE location_id = ANY($1::varchar[])", [serviceIds]);
    await q(
      "DELETE FROM bookings WHERE slot_id IN (SELECT id FROM availability_slots WHERE service_id = ANY($1::varchar[]))",
      [serviceIds],
    );
    await q("DELETE FROM availability_slots WHERE service_id = ANY($1::varchar[])", [serviceIds]);
    await q("DELETE FROM services WHERE id = ANY($1::varchar[])", [serviceIds]);
  }

  if (productIds.length > 0) {
    await q("DELETE FROM media_assets WHERE entity_id = ANY($1::varchar[])", [productIds]);
    await q("DELETE FROM orders WHERE product_id = ANY($1::varchar[])", [productIds]);
    await q("DELETE FROM products WHERE id = ANY($1::varchar[])", [productIds]);
  }

  await q("DELETE FROM trip_stops WHERE trip_id IN (SELECT id FROM trips WHERE username = $1)", [demo.username]);
  await q("DELETE FROM trips WHERE username = $1", [demo.username]);
  await q("DELETE FROM notifications WHERE provider_username = $1 AND type LIKE 'seed_neiva%'", [demo.username]);

  return { serviceIds, productIds };
}

async function ensureDemoUser() {
  const demo = NEIVA_DATA.demoUser;
  if (!demo.password || demo.password.length < 12) {
    throw new Error("SEED_DEMO_PASSWORD is required (min 12 chars) to seed the demo user");
  }
  const passwordHash = (await bcrypt.hash(demo.password, 12)).replace(/^\$2b\$/, "$2a$");

  let existing = await q("SELECT id FROM users WHERE username = $1 LIMIT 1", [demo.username]);
  let userId;
  if (existing[0]) {
    userId = existing[0].id;
    await q(
      `UPDATE users SET password = $1, email = $2, name = $3, role = 'restaurant'::user_role,
         is_verified = 'true', failed_login_attempts = 0, lock_until = NULL,
         deleted_at = NULL, updated_at = now()
       WHERE id = $4`,
      [passwordHash, demo.email, demo.name, userId],
    );
  } else {
    const inserted = await q(
      `INSERT INTO users (username, password, email, name, role, is_verified, is_active, created_at)
       VALUES ($1, $2, $3, $4, 'restaurant'::user_role, 'true', 'true', now())
       RETURNING id`,
      [demo.username, passwordHash, demo.email, demo.name],
    );
    userId = inserted[0].id;
  }

  await q(
    "DELETE FROM user_roles WHERE user_id = $1 AND role IN ('traveler','hotel','restaurant','recreation')",
    [userId],
  );
  for (const role of demo.roles) {
    await q("INSERT INTO user_roles (user_id, role) VALUES ($1, $2::user_role)", [userId, role]);
  }

  return { id: userId, ...demo };
}

async function seedServices(demo, assetCache) {
  const serviceIds = [];
  for (let index = 0; index < NEIVA_DATA.services.length; index += 1) {
    const service = NEIVA_DATA.services[index];
    const asset = assetCache.images[service.imageIndex];
    const inserted = await q(
      `INSERT INTO services (
         provider_username, category, name, description, image_url, location_lat,
         location_lng, rating, price, currency, price_type, duration,
         min_capacity, max_capacity, difficulty, min_age, included, what_to_bring,
         schedule, city, department, created_at
       ) VALUES (
         $1, $2::service_category, $3, $4, $5, $6, $7, $8, $9, 'COP', $10, $11,
         $12, $13, $14, 0, $15::jsonb, $16, $17, 'Neiva', 'Huila',
         now() - ($18 * interval '1 day')
       ) RETURNING id`,
      [
        demo.username,
        service.category,
        service.name,
        service.description,
        asset.url,
        String(service.lat),
        String(service.lng),
        service.rating,
        service.price,
        service.priceType,
        service.duration,
        service.minCapacity,
        service.maxCapacity,
        service.difficulty,
        JSON.stringify(service.included),
        service.whatToBring,
        service.schedule,
        (index % 20) + 1,
      ],
    );
    serviceIds.push({ id: inserted[0].id, ...service });
  }
  return serviceIds;
}

async function seedProducts(demo, assetCache) {
  const products = [];
  for (let index = 0; index < NEIVA_DATA.products.length; index += 1) {
    const product = NEIVA_DATA.products[index];
    const cover = assetCache.images[product.imageIndex];
    const inserted = await q(
      `INSERT INTO products (
         provider_id, provider_username, role_category, name, description, price,
         cost, currency, stock, is_active, cover_image, city, department,
         latitude, longitude, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, 'COP', $8, true, $9, 'Neiva', 'Huila',
         $10, $11, now() - ($12 * interval '1 day'), now()
       ) RETURNING id`,
      [
        demo.id,
        demo.username,
        product.roleCategory,
        product.name,
        product.description,
        product.price,
        product.cost,
        product.stock,
        cover.url,
        product.lat,
        product.lng,
        (index % 18) + 1,
      ],
    );
    const productId = inserted[0].id;

    await q(
      `INSERT INTO media_assets (
         owner_id, owner_role, entity_id, entity_type, title, asset_type,
         file_url, cloudinary_public_id, mime_type, file_size, created_at
       ) VALUES ($1, $2, $3, 'product', $4, 'IMAGE', $5, $6, 'image/png', $7, now())`,
      [
        demo.id,
        product.roleCategory,
        productId,
        `${product.name} — portada`,
        cover.url,
        cover.publicId,
        cover.bytes || 0,
      ],
    );

    if (product.modelIndex !== null) {
      const model = assetCache.models[product.modelIndex];
      await q(
        `INSERT INTO media_assets (
           owner_id, owner_role, entity_id, entity_type, title, asset_type,
           file_url, cloudinary_public_id, mime_type, file_size, created_at
         ) VALUES ($1, $2, $3, 'product', $4, 'MODEL_3D', $5, $6, 'model/gltf-binary', $7, now())`,
        [
          demo.id,
          product.roleCategory,
          productId,
          `${product.name} — modelo 3D`,
          model.url,
          model.publicId,
          model.bytes || 0,
        ],
      );
    }

    products.push({ id: productId, ...product });
  }
  return products;
}

async function seedOrders(products, demo) {
  const buyers = await q(
    `SELECT id, username FROM users
     WHERE username <> $1 AND deleted_at IS NULL
     ORDER BY created_at ASC LIMIT 14`,
    [demo.username],
  );
  if (buyers.length === 0) throw new Error("No hay usuarios compradores para las órdenes de la semilla");

  let orderCount = 0;
  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    for (let round = 0; round < 2; round += 1) {
      const buyer = buyers[(index * 2 + round) % buyers.length];
      const quantity = 1 + ((index + round) % 3);
      const total = product.price * quantity;
      const status = index % 7 === 0 && round === 1
        ? "pending"
        : index % 5 === 0
          ? "completed"
          : "paid";
      await q(
        `INSERT INTO orders (
           buyer_id, product_id, quantity, unit_price, total, status, notes, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7,
           now() - (($8) * interval '1 day'), now() - (($8) * interval '1 day'))`,
        [
          buyer.id,
          product.id,
          quantity,
          product.price,
          total,
          status,
          "Orden sembrada para datos de demostración de Neiva",
          (index + round * 3) % 27 + 1,
        ],
      );
      orderCount += 1;
    }
  }
  return orderCount;
}

async function seedBookings(demo, services) {
  const hotels = services.filter((service) => service.category === "hotel").slice(0, 8);
  const buyers = await q(
    `SELECT id, username FROM users
     WHERE username <> $1 AND deleted_at IS NULL
     ORDER BY created_at ASC LIMIT 10`,
    [demo.username],
  );
  let bookingCount = 0;
  for (let index = 0; index < hotels.length; index += 1) {
    const hotel = hotels[index];
    for (let round = 0; round < 2; round += 1) {
      const start = new Date();
      start.setDate(start.getDate() + 2 + round * 3 + index);
      start.setHours(15, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const inserted = await q(
        `INSERT INTO availability_slots (
           service_id, provider_username, slot_type, start_time, end_time,
           capacity, booked, price, status, created_at
         ) VALUES ($1, $2, 'room', $3, $4, 10, 2, $5, 'available', now())
         RETURNING id`,
        [hotel.id, demo.username, start, end, hotel.price],
      );
      const slotId = inserted[0].id;
      for (let guest = 0; guest < 2; guest += 1) {
        const buyer = buyers[(index + guest + round) % buyers.length];
        await q(
          `INSERT INTO bookings (
             slot_id, traveler_username, provider_username, units, total_price,
             status, created_at
           ) VALUES ($1, $2, $3, 1, $4, $5, now() - (($6) * interval '1 day'))`,
          [
            slotId,
            buyer.username,
            demo.username,
            hotel.price,
            (index + guest) % 4 === 0 ? "pending" : "confirmed",
            (index + guest + round) % 14 + 1,
          ],
        );
        bookingCount += 1;
      }
    }
  }
  return bookingCount;
}

async function seedComments(services, demo) {
  const buyers = await q(
    `SELECT username FROM users
     WHERE username <> $1 AND deleted_at IS NULL
     ORDER BY created_at ASC LIMIT 12`,
    [demo.username],
  );
  const comments = [
    "Excelente atención y un lugar muy limpio. Volvería sin dudarlo.",
    "La experiencia superó lo que esperaba; el guía conocía cada detalle.",
    "Buena relación calidad-precio y atención muy amable.",
    "Los sabores de la región son increíbles. Recomendado para familias.",
    "Hermoso lugar para desconectarse y disfrutar del paisaje.",
  ];
  let count = 0;
  for (let index = 0; index < services.length; index += 1) {
    const service = services[index];
    const author = buyers[index % buyers.length]?.username || "viajero_demo";
    await q(
      `INSERT INTO comments (location_id, author_username, content, rating, created_at)
       VALUES ($1, $2, $3, $4, now() - ($5 * interval '1 day'))`,
      [
        service.id,
        author,
        comments[index % comments.length],
        index % 3 === 0 ? 5 : 4,
        (index % 15) + 1,
      ],
    );
    count += 1;
  }
  return count;
}

async function seedNotifications(demo) {
  const notes = [
    ["nuevo_pedido", "Tienes nuevas órdenes pagadas en tu catálogo de Neiva."],
    ["reserva_confirmada", "Se confirmaron reservas para tus hoteles de demostración."],
    ["stock_bajo", "Revisa el stock de tus experiencias: algunas están por agotarse."],
    ["nueva_resena", "Recibiste nuevas reseñas de viajeros en tus servicios."],
  ];
  for (const [type, details] of notes) {
    await q(
      `INSERT INTO notifications (provider_username, type, details, is_read, created_at)
       VALUES ($1, $2, $3, 'false', now())`,
      [demo.username, `seed_neiva_${type}`, details],
    );
  }
}

function randomRolePassword() {
  return crypto.randomBytes(24).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 28);
}

function upsertEnvLine(file, key, value) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  fs.writeFileSync(file, lines.join("\n"));
}

async function setupRestrictedCatalogRole() {
  const existingUrl = process.env.CATALOG_DATABASE_URL || "";
  let password = process.env.CATALOG_DB_PASSWORD || "";
  if (!password && existingUrl) {
    try {
      password = decodeURIComponent(new URL(existingUrl).password || "");
    } catch {
      password = "";
    }
  }
  if (!/^[A-Za-z0-9_]{16,64}$/.test(password)) password = randomRolePassword();

  try {
    const exists = await q("SELECT 1 FROM pg_roles WHERE rolname = $1 LIMIT 1", [CATALOG_ROLE]);
    if (exists.length > 0) {
      await q(`ALTER ROLE ${CATALOG_ROLE} WITH LOGIN PASSWORD '${password}'`);
    } else {
      await q(`CREATE ROLE ${CATALOG_ROLE} WITH LOGIN PASSWORD '${password}'`);
    }
    const database = await q("SELECT current_database() AS name");
    const databaseName = String(database[0].name).replace(/"/g, '""');
    await q(`GRANT CONNECT ON DATABASE "${databaseName}" TO ${CATALOG_ROLE}`);
    await q(`GRANT USAGE ON SCHEMA catalog TO ${CATALOG_ROLE}`);
    await q(`GRANT SELECT ON catalog.catalog_items TO ${CATALOG_ROLE}`);
    await q(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${CATALOG_ROLE}`);
  } catch (error) {
    log(`no se pudo crear el rol restringido (seguirá usando la vista con el rol principal): ${error.message}`);
    return null;
  }

  const url = new URL(databaseUrl);
  url.username = CATALOG_ROLE;
  url.password = password;
  const catalogUrl = url.toString();
  upsertEnvLine(".env", "CATALOG_DATABASE_URL", catalogUrl);
  upsertEnvLine(".dev.vars", "CATALOG_DATABASE_URL", catalogUrl);
  process.env.CATALOG_DATABASE_URL = catalogUrl;

  const restricted = neon(catalogUrl);
  const count = rowsOf(await restricted("SELECT count(*)::int AS count FROM catalog.catalog_items"));
  let blocked = false;
  try {
    await restricted("SELECT count(*) FROM public.users");
  } catch {
    blocked = true;
  }
  log(`rol restringido verificado: ${count[0]?.count ?? 0} items visibles; public.users bloqueado=${blocked}`);
  if (!blocked) {
    log("ADVERTENCIA: el rol restringido puede leer public.users; revisa los privilegios.");
  }
  return catalogUrl;
}

async function main() {
  log("iniciando semilla de Neiva");

  const demo = await ensureDemoUser();
  log(`usuario demo listo: ${demo.username} (${demo.id})`);

  await ensureCatalogSchema();
  log("vista catalog.catalog_items lista");
  await ensureTripSchema();
  log("tablas de viajes listas");

  const serviceNames = NEIVA_DATA.services.map((service) => service.name);
  const productNames = NEIVA_DATA.products.map((product) => product.name);
  const removed = await cleanupPreviousSeed(demo, serviceNames, productNames);
  log(`limpieza: ${removed.serviceIds.length} servicios y ${removed.productIds.length} productos previos`);

  if (DB_ONLY && !fs.existsSync(CACHE_PATH)) {
    throw new Error("--db-only requiere scripts/.neiva-assets-cache.json");
  }

  const assetCache = DB_ONLY
    ? JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"))
    : await uploadAssets();
  if (ASSETS_ONLY) {
    log("modo --assets-only: no se escribieron datos");
    return;
  }

  const services = await seedServices(demo, assetCache);
  const products = await seedProducts(demo, assetCache);
  const orders = await seedOrders(products, demo);
  const bookings = await seedBookings(demo, services);
  const comments = await seedComments(services, demo);
  await seedNotifications(demo);

  const roleUrl = await setupRestrictedCatalogRole();

  const counts = await q(`
    SELECT
      (SELECT count(*)::int FROM services WHERE provider_username = $1 AND city = 'Neiva') AS services,
      (SELECT count(*)::int FROM products WHERE provider_username = $1) AS products,
      (SELECT count(*)::int FROM media_assets WHERE owner_id = $2) AS media,
      (SELECT count(*)::int FROM orders o JOIN products p ON p.id = o.product_id WHERE p.provider_username = $1) AS orders,
      (SELECT count(*)::int FROM bookings WHERE provider_username = $1) AS bookings,
      (SELECT count(*)::int FROM comments c JOIN services s ON s.id = c.location_id WHERE s.provider_username = $1) AS comments,
      (SELECT count(*)::int FROM catalog.catalog_items WHERE lower(city) = 'neiva') AS catalog_items
  `, [demo.username, demo.id]);
  const summary = counts[0] || {};

  log("semilla completada");
  console.log(JSON.stringify({
    demoUser: demo.username,
    demoPassword: demo.password,
    services: summary.services,
    products: summary.products,
    mediaAssets: summary.media,
    orders: summary.orders,
    bookings: summary.bookings,
    comments: summary.comments,
    catalogItemsInNeiva: summary.catalog_items,
    imagesUploaded: assetCache.images.length,
    modelsUploaded: assetCache.models.length,
    catalogRestrictedUrl: roleUrl ? "configurada en .env" : "no configurada (se usa la vista con rol principal)",
  }, null, 2));
}

main().catch((error) => {
  console.error("[seed-neiva] ERROR:", error);
  process.exitCode = 1;
});
