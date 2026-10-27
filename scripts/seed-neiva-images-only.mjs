import "dotenv/config";
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { v2 as cloudinary } from "cloudinary";
import {
  NEIVA_DATA,
  NEIVA_IMAGE_URLS,
  FALLBACK_URL,
} from "./neiva-assets.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL en el entorno");
}
const sql = neon(databaseUrl);
const rowsOf = (r) => (Array.isArray(r) ? r : r?.rows || []);
const q = async (text, params = []) => rowsOf(await sql(text, params));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const DEMO_USERNAME = "josedavidcorreanunez123@gmail.com";

function log(m) {
  console.log(`[seed-neiva-images-only] ${m}`);
}

async function uploadImage(imageUrl, publicId) {
  let result;
  try {
    result = await cloudinary.uploader.upload(imageUrl, {
      resource_type: "image",
      folder: "vianova/neiva/images",
      public_id: publicId,
      overwrite: true,
      invalidate: true,
    });
    return { url: result.secure_url, publicId: result.public_id, bytes: result.bytes || 0 };
  } catch (error) {
    log(`  ⚠ Falló ${publicId}: ${error.message}. Usando fallback.`);
    result = await cloudinary.uploader.upload(FALLBACK_URL, {
      resource_type: "image",
      folder: "vianova/neiva/images",
      public_id: publicId,
      overwrite: true,
      invalidate: true,
    });
    return { url: result.secure_url, publicId: result.public_id, bytes: result.bytes || 0 };
  }
}

async function main() {
  log("subiendo 72 imágenes reales a Cloudinary...");
  const assets = [];
  for (let i = 0; i < NEIVA_IMAGE_URLS.length; i += 1) {
    const publicId = `neiva-image-${String(i + 1).padStart(2, "0")}`;
    const asset = await uploadImage(NEIVA_IMAGE_URLS[i], publicId);
    assets.push(asset);
    log(`  ${i + 1}/72 ${publicId}`);
  }

  // Servicios: orden hotel(0-11), restaurant(12-23), recreation(24-35)
  const services = NEIVA_DATA.services;
  for (let i = 0; i < services.length; i += 1) {
    const s = services[i];
    const asset = assets[i];
    await q(
      `UPDATE services SET image_url = $1 WHERE provider_username = $2 AND name = $3`,
      [asset.url, DEMO_USERNAME, s.name],
    );
    log(`servicio actualizado: ${s.name}`);
  }

  // Productos: hotel(36-47), restaurant(48-59), recreation(60-71)
  const demoUserRow = await q(
    `SELECT id FROM users WHERE username = $1 LIMIT 1`,
    [DEMO_USERNAME],
  );
  if (demoUserRow.length === 0) throw new Error(`No existe usuario demo ${DEMO_USERNAME}`);
  const demoUserId = demoUserRow[0].id;

  const products = NEIVA_DATA.products;
  for (let i = 0; i < products.length; i += 1) {
    const p = products[i];
    const assetIndex = p.imageIndex; // 36..71
    const asset = assets[assetIndex];
    await q(
      `UPDATE products SET cover_image = $1 WHERE provider_username = $2 AND name = $3`,
      [asset.url, DEMO_USERNAME, p.name],
    );
    const prodRow = await q(
      `SELECT id FROM products WHERE provider_username = $1 AND name = $2 LIMIT 1`,
      [DEMO_USERNAME, p.name],
    );
    if (prodRow.length === 0) {
      log(`  ⚠ producto no encontrado: ${p.name}`);
      continue;
    }
    const productId = prodRow[0].id;
    // Reemplazar media_assets IMAGE previa de este producto (sin borrar MODEL_3D)
    await q(
      `DELETE FROM media_assets WHERE entity_id = $1 AND entity_type = 'product' AND asset_type = 'IMAGE'`,
      [productId],
    );
    await q(
      `INSERT INTO media_assets (owner_id, owner_role, entity_id, entity_type, title, asset_type, file_url, cloudinary_public_id, mime_type, file_size, created_at)
       VALUES ($1, $2, $3, 'product', $4, 'IMAGE', $5, $6, 'image/png', $7, now())`,
      [demoUserId, p.roleCategory, productId, `${p.name} — portada`, asset.url, asset.publicId, asset.bytes || 0],
    );
    log(`producto actualizado: ${p.name}`);
  }

  const countS = await q("SELECT count(*)::int AS n FROM services WHERE provider_username = $1", [DEMO_USERNAME]);
  const countP = await q("SELECT count(*)::int AS n FROM products WHERE provider_username = $1", [DEMO_USERNAME]);
  log(`Listo. Servicios: ${countS[0].n}, Productos: ${countP[0].n}. Solo imágenes reemplazadas; órdenes, reservas, comentarios y viajes intactos.`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exitCode = 1;
});
