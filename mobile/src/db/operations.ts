// DB operations for services and comments — raw SQL via neon() for React Native reliability
import { neon } from "@neondatabase/serverless";
import { DB_URL } from "../lib/config";
import type { Service, Comment, ServiceCategory } from "./schema";

const sql = neon(DB_URL);

// ── Services ──────────────────────────────────────────────────────────────────

export async function listServices(): Promise<Service[]> {
  const rows = await sql`SELECT * FROM services ORDER BY created_at DESC`;
  return rows.map(mapService);
}

export async function listServicesByCategory(category: ServiceCategory): Promise<Service[]> {
  const rows = await sql`SELECT * FROM services WHERE category = ${category} ORDER BY created_at DESC`;
  return rows.map(mapService);
}

export async function listProviderServices(providerUsername: string): Promise<Service[]> {
  const rows = await sql`SELECT * FROM services WHERE provider_username = ${providerUsername}`;
  return rows.map(mapService);
}

export async function createService(data: {
  providerUsername: string;
  category: ServiceCategory;
  name: string;
  description?: string;
  imageUrl?: string;
  locationLat?: string;
  locationLng?: string;
  rating?: number;
}): Promise<Service> {
  const rows = await sql`
    INSERT INTO services (id, provider_username, category, name, description, image_url, location_lat, location_lng, rating, created_at)
    VALUES (gen_random_uuid(), ${data.providerUsername}, ${data.category}, ${data.name}, ${data.description || null}, ${data.imageUrl || null}, ${data.locationLat || null}, ${data.locationLng || null}, ${data.rating || null}, NOW())
    RETURNING *
  `;
  return mapService(rows[0]);
}

export async function updateService(id: string, data: Partial<{
  name: string;
  description: string;
  imageUrl: string;
  locationLat: string;
  locationLng: string;
  rating: number;
}>): Promise<Service> {
  const rows = await sql`
    UPDATE services SET
      name = COALESCE(${data.name || null}, name),
      description = COALESCE(${data.description || null}, description),
      image_url = COALESCE(${data.imageUrl || null}, image_url),
      location_lat = COALESCE(${data.locationLat || null}, location_lat),
      location_lng = COALESCE(${data.locationLng || null}, location_lng),
      rating = COALESCE(${data.rating || null}, rating)
    WHERE id = ${id}
    RETURNING *
  `;
  return mapService(rows[0]);
}

export async function deleteService(id: string): Promise<void> {
  await sql`DELETE FROM services WHERE id = ${id}`;
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function listComments(locationId: string): Promise<Comment[]> {
  const rows = await sql`SELECT * FROM comments WHERE location_id = ${locationId} ORDER BY created_at DESC`;
  return rows.map(mapComment);
}

export async function addComment(data: {
  locationId: string;
  authorUsername: string;
  content: string;
  rating?: number;
}): Promise<Comment> {
  const rows = await sql`
    INSERT INTO comments (id, location_id, author_username, content, rating, created_at)
    VALUES (gen_random_uuid(), ${data.locationId}, ${data.authorUsername}, ${data.content}, ${data.rating || null}, NOW())
    RETURNING *
  `;
  return mapComment(rows[0]);
}

export async function deleteComment(id: string): Promise<void> {
  await sql`DELETE FROM comments WHERE id = ${id}`;
}

// ── Mappers (snake_case → camelCase) ──────────────────────────────────────────

function mapService(row: any): Service {
  return {
    id: row.id,
    providerUsername: row.provider_username,
    category: row.category,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    locationLat: row.location_lat,
    locationLng: row.location_lng,
    rating: row.rating,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

function mapComment(row: any): Comment {
  return {
    id: row.id,
    locationId: row.location_id,
    authorUsername: row.author_username,
    content: row.content,
    rating: row.rating,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}
