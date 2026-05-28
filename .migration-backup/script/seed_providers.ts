/**
 * seed_providers.ts
 * Crea 20 cuentas de proveedor (5 hoteles, 5 restaurantes, 5 recreativos, 5 taxis)
 * en ciudades turísticas de Colombia, sube imágenes reales a Cloudinary y
 * registra cada servicio en la BD.
 *
 * Uso: npx tsx script/seed_providers.ts
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { v2 as cloudinary } from "cloudinary";
import bcrypt from "bcryptjs";
import { users, services, userRoles, reviews } from "../shared/schema.js";
import { eq } from "drizzle-orm";

// ── Cloudinary setup ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const sql  = neon(process.env.DATABASE_URL!);
const db   = drizzle({ client: sql });

// ── Helpers ─────────────────────────────────────────────────────────────────
async function hashPwd(plain: string) {
  const h = await bcrypt.hash(plain, 12);
  return h.replace(/^\$2b\$/, "$2a$");
}

async function uploadFromUrl(imageUrl: string, folder: string, publicId: string) {
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: `vianova/seed/${folder}`,
      public_id: publicId,
      overwrite: true,
      resource_type: "image",
    });
    return result.secure_url;
  } catch (err: any) {
    console.warn(`  ⚠ No se pudo subir imagen para ${publicId}: ${err.message}`);
    // Fallback placeholder
    return `https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80`;
  }
}

async function upsertUser(username: string, name: string, email: string, role: string) {
  const existing = await db.select().from(users).where(eq(users.username, username));
  if (existing[0]) return existing[0];
  const password = await hashPwd("vianova2025");
  const rows = await db.insert(users).values({
    username,
    password,
    name,
    email,
    role: role as any,
  }).returning();
  return rows[0];
}

// ── Datos de Providers ───────────────────────────────────────────────────────

const HOTELS = [
  {
    username: "dann_carlton_cali",
    name: "Hotel Dann Carlton Cali",
    email: "dann.carlton@vianova.test",
    city: "Cali",
    description: "Hotel 5 estrellas en el corazón de Cali. Piscina, spa y gastronomía de autor.",
    price: 320000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
    reviewText: "Excelente servicio, habitaciones amplias y limpias. La ubicación es perfecta.",
  },
  {
    username: "oasis_neiva",
    name: "Hotel Oasis Neiva",
    email: "oasis.neiva@vianova.test",
    city: "Neiva",
    description: "El hotel más completo del Huila. Piscina climatizada, restaurante y zonas húmedas.",
    price: 180000,
    rating: 4,
    imageUrl: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80",
    reviewText: "Muy cómodo y bien ubicado. El desayuno buffet es espectacular.",
  },
  {
    username: "intercontinental_medellin",
    name: "Hotel InterContinental Medellín",
    email: "intercontinental.mde@vianova.test",
    city: "Medellín",
    description: "Lujo e innovación en la ciudad de la eterna primavera. Vistas panorámicas de Medellín.",
    price: 450000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
    reviewText: "La mejor experiencia hotelera de Medellín. Absolutamente recomendado.",
  },
  {
    username: "sofitel_cartagena",
    name: "Sofitel Legend Santa Clara Cartagena",
    email: "sofitel.ctg@vianova.test",
    city: "Cartagena",
    description: "Joya histórica en el corazón de la ciudad amurallada. Mezcla perfecta de historia y lujo.",
    price: 680000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80",
    reviewText: "El hotel más hermoso de Cartagena. La arquitectura colonial es impresionante.",
  },
  {
    username: "irotama_santamarta",
    name: "Irotama Resort Santa Marta",
    email: "irotama@vianova.test",
    city: "Santa Marta",
    description: "Resort frente al mar Caribe con playa privada, múltiples piscinas y actividades acuáticas.",
    price: 390000,
    rating: 4,
    imageUrl: "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=800&q=80",
    reviewText: "La playa privada es increíble. Excelente para familias con niños.",
  },
];

const RESTAURANTS = [
  {
    username: "delicias_pacifico",
    name: "Delicias del Pacífico",
    email: "delicias.pacifico@vianova.test",
    city: "Cali",
    description: "Gastronomía del Pacífico colombiano. Especialidad en mariscos frescos y encocados.",
    price: 65000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
    reviewText: "El sancocho de mariscos es el mejor de Cali. Ambiente acogedor y servicio impecable.",
  },
  {
    username: "sabores_huila",
    name: "Sabores del Huila",
    email: "sabores.huila@vianova.test",
    city: "Neiva",
    description: "Cocina típica huilense. Famosos por el asado huilense, bizcochuelos y insulsos.",
    price: 45000,
    rating: 4,
    imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
    reviewText: "El asado huilense es auténtico y delicioso. Porciones generosas a buen precio.",
  },
  {
    username: "el_cielo_medellin",
    name: "El Cielo Restaurante",
    email: "el.cielo@vianova.test",
    city: "Medellín",
    description: "Alta cocina colombiana con técnica vanguardista. Experiencia gastronómica única.",
    price: 280000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    reviewText: "Una experiencia culinaria que no olvidarás. Cada plato es una obra de arte.",
  },
  {
    username: "la_vitrola_cartagena",
    name: "La Vitrola Cartagena",
    email: "la.vitrola@vianova.test",
    city: "Cartagena",
    description: "Restaurante icónico de Cartagena. Cocina costeña con música en vivo y vista al mar.",
    price: 120000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=800&q=80",
    reviewText: "La mejor combinación de comida, música y ambiente de toda la costa Caribe.",
  },
  {
    username: "lulo_mar_santamarta",
    name: "Lulo Restaurant & Bar",
    email: "lulo.mar@vianova.test",
    city: "Santa Marta",
    description: "Cocina contemporánea con vista al mar Caribe. Cócteles artesanales y mariscos frescos.",
    price: 95000,
    rating: 4,
    imageUrl: "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=800&q=80",
    reviewText: "Vista espectacular al mar. Los ceviches son increíbles y el mojito de lulo es único.",
  },
];

const RECREATION = [
  {
    username: "zoologico_cali",
    name: "Zoológico de Cali",
    email: "zoologico@vianova.test",
    city: "Cali",
    description: "Uno de los mejores zoológicos de América Latina. Hogar de más de 4.000 animales.",
    price: 32000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=800&q=80",
    reviewText: "Espectacular. Los animales tienen espacios amplios y el lugar está muy bien cuidado.",
  },
  {
    username: "desierto_tatacoa",
    name: "Desierto de la Tatacoa",
    email: "tatacoa.tour@vianova.test",
    city: "Neiva",
    description: "Tour al segundo desierto más grande de Colombia. Observación astronómica y senderismo.",
    price: 85000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80",
    reviewText: "Una maravilla natural. La observación de estrellas en la noche es absolutamente mágica.",
  },
  {
    username: "metro_medellin",
    name: "Tour Urbano Medellín — Metrocable",
    email: "tour.metro@vianova.test",
    city: "Medellín",
    description: "Recorrido por las comunas de Medellín en Metrocable. Incluye visita a Parque Arví.",
    price: 55000,
    rating: 4,
    imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    reviewText: "La vista de Medellín desde el Metrocable es impresionante. Guía muy informativo.",
  },
  {
    username: "islas_rosario",
    name: "Islas del Rosario — Tour Acuático",
    email: "islas.rosario@vianova.test",
    city: "Cartagena",
    description: "Excursión a las Islas del Rosario. Snorkel, buceo y almuerzo en playa cristalina.",
    price: 135000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80",
    reviewText: "El agua cristalina y los corales son increíbles. Una experiencia que hay que vivir.",
  },
  {
    username: "parque_tayrona",
    name: "Parque Natural Tayrona",
    email: "tayrona.eco@vianova.test",
    city: "Santa Marta",
    description: "Senderismo en el Parque Tayrona hasta las playas vírgenes de La Piscina y Cabo San Juan.",
    price: 72000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    reviewText: "Una de las playas más hermosas del mundo. La caminata vale completamente la pena.",
  },
];

const TAXIS = [
  {
    username: "transcali_ejecutivo",
    name: "TransCali Ejecutivo",
    email: "transcali@vianova.test",
    city: "Cali",
    description: "Servicio de transporte ejecutivo en Cali. Vehículos de lujo, conductores certificados.",
    price: 28000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80",
    reviewText: "Puntual, limpio y profesional. El mejor servicio de transporte en Cali.",
    plate: "CXK-342",
    vehicleType: "Sedan Ejecutivo",
  },
  {
    username: "moto_taxi_neiva",
    name: "Urbano Express Neiva",
    email: "urbano.neiva@vianova.test",
    city: "Neiva",
    description: "Transporte urbano ágil en Neiva. Cobertura completa de la ciudad y alrededores.",
    price: 12000,
    rating: 4,
    imageUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80",
    reviewText: "Rápido y económico. Siempre disponible y muy conoce las rutas de la ciudad.",
    plate: "HUI-891",
    vehicleType: "Automóvil",
  },
  {
    username: "aeropuerto_transfer_mde",
    name: "Aerotransfer Medellín",
    email: "aerotransfer@vianova.test",
    city: "Medellín",
    description: "Traslados aeropuerto-hotel en Medellín. Monitoreo de vuelos y servicio 24 horas.",
    price: 65000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800&q=80",
    reviewText: "Servicio impecable. Esperaron mi vuelo retrasado sin cargo extra. Muy recomendado.",
    plate: "ANT-445",
    vehicleType: "Van de Lujo",
  },
  {
    username: "caribe_tours_ctg",
    name: "Caribe Tours Cartagena",
    email: "caribe.tours@vianova.test",
    city: "Cartagena",
    description: "Transporte turístico por Cartagena. Visitas a Ciudad Amurallada, Getsemaní y playas.",
    price: 45000,
    rating: 5,
    imageUrl: "https://images.unsplash.com/photo-1558980395-be7e5d3b9063?w=800&q=80",
    reviewText: "El conductor conoce todos los secretos de Cartagena. Ruta cultural increíble.",
    plate: "BOL-777",
    vehicleType: "SUV",
  },
  {
    username: "caribe_transport_sm",
    name: "Sierra Nevada Transfer",
    email: "sierra.transfer@vianova.test",
    city: "Santa Marta",
    description: "Traslados entre Santa Marta, Taganga, Minca y Parque Tayrona.",
    price: 38000,
    rating: 4,
    imageUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80",
    reviewText: "Puntual y conoce muy bien la Sierra Nevada. Recomendado para ir al Tayrona.",
    plate: "MAG-221",
    vehicleType: "4x4",
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Iniciando seed de VIANova...\n");

  // Add city column if not exists
  try {
    await sql`ALTER TABLE services ADD COLUMN IF NOT EXISTS city text`;
    console.log("✅ Columna 'city' asegurada en services\n");
  } catch (e: any) {
    console.log("ℹ  city column:", e.message);
  }

  const OWNER_USERNAME = "josedavidcorreanunez123@gmail.com";
  console.log(`👤 Sembrando bajo la cuenta: ${OWNER_USERNAME}\n`);

  // ── HOTELES ────────────────────────────────────────────────────────────────
  console.log("🏨 Creando Hoteles...");
  for (const h of HOTELS) {
    process.stdout.write(`  → ${h.name} (${h.city})... `);
    const imgUrl = await uploadFromUrl(h.imageUrl, "hotels", h.username);
    const user   = await upsertUser(h.username, h.name, h.email, "hotel");

    // Upsert role
    await sql`
      INSERT INTO user_roles (user_id, role, business_name, business_address)
      VALUES (${user.id}, 'hotel', ${h.name}, ${h.city})
      ON CONFLICT (user_id, role) DO NOTHING
    `;

    // Upsert service
    await sql`
      INSERT INTO services (provider_username, category, name, description, image_url, rating, price, currency, city)
      VALUES (${h.username}, 'hotel', ${h.name}, ${h.description}, ${imgUrl}, ${h.rating}, ${h.price}, 'COP', ${h.city})
      ON CONFLICT DO NOTHING
    `;

    // Add a review
    await sql`
      INSERT INTO reviews (ride_id, author_username, target_username, rating, comment, author_role)
      VALUES (gen_random_uuid(), ${OWNER_USERNAME}, ${h.username}, ${h.rating}, ${h.reviewText}, 'traveler')
      ON CONFLICT DO NOTHING
    `;
    console.log(`✅ Imagen: ${imgUrl.substring(0, 60)}...`);
  }

  // ── RESTAURANTES ──────────────────────────────────────────────────────────
  console.log("\n🍽  Creando Restaurantes...");
  for (const r of RESTAURANTS) {
    process.stdout.write(`  → ${r.name} (${r.city})... `);
    const imgUrl = await uploadFromUrl(r.imageUrl, "restaurants", r.username);
    const user   = await upsertUser(r.username, r.name, r.email, "restaurant");

    await sql`
      INSERT INTO user_roles (user_id, role, business_name, business_address)
      VALUES (${user.id}, 'restaurant', ${r.name}, ${r.city})
      ON CONFLICT (user_id, role) DO NOTHING
    `;
    await sql`
      INSERT INTO services (provider_username, category, name, description, image_url, rating, price, currency, city)
      VALUES (${r.username}, 'restaurant', ${r.name}, ${r.description}, ${imgUrl}, ${r.rating}, ${r.price}, 'COP', ${r.city})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO reviews (ride_id, author_username, target_username, rating, comment, author_role)
      VALUES (gen_random_uuid(), ${OWNER_USERNAME}, ${r.username}, ${r.rating}, ${r.reviewText}, 'traveler')
      ON CONFLICT DO NOTHING
    `;
    console.log(`✅`);
  }

  // ── RECREATIVOS ──────────────────────────────────────────────────────────
  console.log("\n🎭 Creando Sitios Recreativos...");
  for (const rec of RECREATION) {
    process.stdout.write(`  → ${rec.name} (${rec.city})... `);
    const imgUrl = await uploadFromUrl(rec.imageUrl, "recreation", rec.username);
    const user   = await upsertUser(rec.username, rec.name, rec.email, "recreation");

    await sql`
      INSERT INTO user_roles (user_id, role, business_name, business_address)
      VALUES (${user.id}, 'recreation', ${rec.name}, ${rec.city})
      ON CONFLICT (user_id, role) DO NOTHING
    `;
    await sql`
      INSERT INTO services (provider_username, category, name, description, image_url, rating, price, currency, city)
      VALUES (${rec.username}, 'recreation', ${rec.name}, ${rec.description}, ${imgUrl}, ${rec.rating}, ${rec.price}, 'COP', ${rec.city})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO reviews (ride_id, author_username, target_username, rating, comment, author_role)
      VALUES (gen_random_uuid(), ${OWNER_USERNAME}, ${rec.username}, ${rec.rating}, ${rec.reviewText}, 'traveler')
      ON CONFLICT DO NOTHING
    `;
    console.log(`✅`);
  }

  // ── TAXIS ────────────────────────────────────────────────────────────────
  console.log("\n🚕 Creando Servicios de Transporte...");
  for (const t of TAXIS) {
    process.stdout.write(`  → ${t.name} (${t.city})... `);
    const imgUrl = await uploadFromUrl(t.imageUrl, "taxis", t.username);
    const user   = await upsertUser(t.username, t.name, t.email, "taxi");

    await sql`
      INSERT INTO user_roles (user_id, role, business_name, vehicle_type, plate)
      VALUES (${user.id}, 'taxi', ${t.name}, ${t.vehicleType}, ${t.plate})
      ON CONFLICT (user_id, role) DO NOTHING
    `;
    await sql`
      INSERT INTO services (provider_username, category, name, description, image_url, rating, price, currency, city)
      VALUES (${t.username}, 'transport', ${t.name}, ${t.description}, ${imgUrl}, ${t.rating}, ${t.price}, 'COP', ${t.city})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO reviews (ride_id, author_username, target_username, rating, comment, author_role)
      VALUES (gen_random_uuid(), ${OWNER_USERNAME}, ${t.username}, ${t.rating}, ${t.reviewText}, 'traveler')
      ON CONFLICT DO NOTHING
    `;
    console.log(`✅`);
  }

  console.log("\n\n🎉 ¡Seed completado exitosamente!");
  console.log(`   • ${HOTELS.length} hoteles`);
  console.log(`   • ${RESTAURANTS.length} restaurantes`);
  console.log(`   • ${RECREATION.length} sitios recreativos`);
  console.log(`   • ${TAXIS.length} servicios de transporte`);
  console.log(`   • Imágenes subidas a Cloudinary: vianova/seed/`);
}

main().catch((err) => {
  console.error("❌ Error en seed:", err);
  process.exit(1);
});
