import { sql as drizzleSql } from "drizzle-orm";
import { getDb, storage } from "./storage.js";
import {
  searchCatalog,
  ensureCatalogSchema,
  catalogCategoryLabel,
  type CatalogItem,
} from "./catalog.js";

/**
 * Planificador de viajes basado exclusivamente en el catálogo restringido.
 * Cada parada se guarda en `trip_stops` y, al establecer la ruta, se escribe
 * un mensaje del asistente por parada en la conversación del usuario.
 */

export type TripStop = {
  id: string;
  tripId: string;
  dayNumber: number;
  stopOrder: number;
  itemType: string;
  itemId: string;
  category: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  currency: string;
  providerUsername: string;
  latitude: number | null;
  longitude: number | null;
  startTime: string;
  duration: string | null;
  notes: string | null;
  message: string | null;
  chatMessageId: string | null;
};

export type TripPlan = {
  id: string;
  username: string;
  destinationCity: string;
  originCity: string | null;
  days: number;
  travelers: number;
  budget: number | null;
  currency: string;
  status: string;
  summary: string;
  totalEstimate: number;
  createdAt: string | null;
  routeEstablishedAt: string | null;
  stops: TripStop[];
};

export type GenerateTripInput = {
  userId: string;
  username: string;
  destinationCity: string;
  originCity?: string | null;
  days?: number;
  travelers?: number;
  budget?: number | null;
  conversationId?: string | null;
};

let schemaPromise: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value: unknown, max = 240): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function ensureTripSchema(): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await ensureCatalogSchema();
    const db = getDb();
    await db.execute(drizzleSql`
      CREATE TABLE IF NOT EXISTS trips (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username text NOT NULL,
        conversation_id varchar,
        destination_city text NOT NULL,
        origin_city text,
        days integer NOT NULL DEFAULT 2,
        travelers integer NOT NULL DEFAULT 2,
        budget numeric(12,2),
        currency text NOT NULL DEFAULT 'COP',
        status text NOT NULL DEFAULT 'draft',
        summary text,
        total_estimate numeric(12,2) NOT NULL DEFAULT 0,
        route_established_at timestamp,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await db.execute(drizzleSql`
      CREATE TABLE IF NOT EXISTS trip_stops (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id varchar NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        day_number integer NOT NULL DEFAULT 1,
        stop_order integer NOT NULL DEFAULT 1,
        item_type text NOT NULL,
        item_id varchar NOT NULL,
        category text NOT NULL,
        name text NOT NULL,
        description text,
        image_url text,
        price numeric(12,2) NOT NULL DEFAULT 0,
        currency text NOT NULL DEFAULT 'COP',
        provider_username text NOT NULL,
        latitude double precision,
        longitude double precision,
        start_time text NOT NULL,
        duration text,
        notes text,
        message text,
        chat_message_id varchar,
        created_at timestamp DEFAULT now()
      )
    `);
    await db.execute(drizzleSql`
      CREATE INDEX IF NOT EXISTS idx_trips_username_created
      ON trips(username, created_at DESC)
    `);
    await db.execute(drizzleSql`
      CREATE INDEX IF NOT EXISTS idx_trip_stops_trip
      ON trip_stops(trip_id, day_number, stop_order)
    `);
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

function mapStop(row: any): TripStop {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    dayNumber: num(row.day_number, 1),
    stopOrder: num(row.stop_order, 1),
    itemType: String(row.item_type || "service"),
    itemId: String(row.item_id || ""),
    category: String(row.category || ""),
    name: String(row.name || ""),
    description: String(row.description || ""),
    imageUrl: row.image_url ? String(row.image_url) : null,
    price: num(row.price),
    currency: String(row.currency || "COP"),
    providerUsername: String(row.provider_username || ""),
    latitude: row.latitude === null || row.latitude === undefined ? null : num(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : num(row.longitude),
    startTime: String(row.start_time || ""),
    duration: row.duration ? String(row.duration) : null,
    notes: row.notes ? String(row.notes) : null,
    message: row.message ? String(row.message) : null,
    chatMessageId: row.chat_message_id ? String(row.chat_message_id) : null,
  };
}

function mapTrip(row: any, stops: TripStop[]): TripPlan {
  return {
    id: String(row.id),
    username: String(row.username || ""),
    destinationCity: String(row.destination_city || ""),
    originCity: row.origin_city ? String(row.origin_city) : null,
    days: num(row.days, 1),
    travelers: num(row.travelers, 1),
    budget: row.budget === null || row.budget === undefined ? null : num(row.budget),
    currency: String(row.currency || "COP"),
    status: String(row.status || "draft"),
    summary: String(row.summary || ""),
    totalEstimate: num(row.total_estimate),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    routeEstablishedAt: row.route_established_at
      ? new Date(row.route_established_at).toISOString()
      : null,
    stops,
  };
}

function pick<T>(items: T[], index: number): T {
  return items[index % items.length];
}

function stopMessage(stop: Omit<TripStop, "id" | "tripId" | "chatMessageId" | "message">): string {
  const price = Number(stop.price || 0).toLocaleString("es-CO");
  const lines = [
    `📍 Día ${stop.dayNumber} · ${stop.startTime} — ${stop.name}`,
    `${catalogCategoryLabel(stop.category)} · $${price} ${stop.currency} · @${stop.providerUsername}`,
  ];
  if (stop.description) lines.push(stop.description.replace(/\s+/g, " ").slice(0, 220));
  if (stop.duration) lines.push(`Duración: ${stop.duration}`);
  if (stop.notes) lines.push(stop.notes);
  return lines.join("\n");
}

/**
 * Genera un itinerario real usando hoteles, restaurantes y actividades del
 * catálogo. No consulta ninguna otra fuente.
 */
export async function generateTripPlan(input: GenerateTripInput): Promise<TripPlan> {
  await ensureTripSchema();

  const destination = cleanText(input.destinationCity, 80) || "Neiva";
  const days = Math.min(Math.max(Math.trunc(input.days ?? 2), 1), 7);
  const travelers = Math.min(Math.max(Math.trunc(input.travelers ?? 2), 1), 10);
  const budget =
    input.budget === null || input.budget === undefined || !Number.isFinite(Number(input.budget))
      ? null
      : Math.max(0, Number(input.budget));

  const catalog = await searchCatalog({ city: destination, limit: 80 });
  const hotels = catalog.filter((item) => item.category.startsWith("hotel"));
  const restaurants = catalog.filter((item) =>
    item.category.startsWith("restaurant") || item.category.startsWith("comida"),
  );
  const recreations = catalog.filter(
    (item) =>
      item.category.startsWith("recreation") ||
      item.category.startsWith("actividad") ||
      item.category.startsWith("tour"),
  );

  if (hotels.length === 0 || restaurants.length === 0 || recreations.length === 0) {
    const missing = [
      hotels.length === 0 ? "hoteles" : null,
      restaurants.length === 0 ? "restaurantes" : null,
      recreations.length === 0 ? "actividades de recreación" : null,
    ].filter(Boolean);
    throw Object.assign(
      new Error(
        `El catálogo de VIANova aún no tiene ${missing.join(", ")} disponibles en ${destination}.`,
      ),
      { status: 422 },
    );
  }

  const stopDrafts: Array<Omit<TripStop, "id" | "tripId" | "chatMessageId" | "message">> = [];
  let restaurantIndex = 0;
  let recreationIndex = 0;
  let order = 1;

  const add = (
    item: CatalogItem,
    dayNumber: number,
    startTime: string,
    notes: string,
  ) => {
    stopDrafts.push({
      dayNumber,
      stopOrder: order++,
      itemType: item.itemType,
      itemId: item.itemId,
      category: item.category,
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl,
      price: item.price,
      currency: item.currency,
      providerUsername: item.providerUsername,
      latitude: item.latitude,
      longitude: item.longitude,
      startTime,
      duration: item.duration,
      notes,
    });
  };

  for (let day = 1; day <= days; day += 1) {
    const hotel = pick(hotels, day - 1);
    if (day === 1) {
      add(
        hotel,
        day,
        "09:00",
        `Check-in y bienvenida. Guarda la confirmación de ${hotel.providerUsername}.`,
      );
    }

    if (day > 1) {
      add(
        pick(restaurants, restaurantIndex++),
        day,
        "08:30",
        "Desayuno incluido en el itinerario sugerido.",
      );
    }

    add(
      pick(restaurants, restaurantIndex++),
      day,
      "13:00",
      "Almuerzo típico de la región.",
    );
    add(
      pick(recreations, recreationIndex++),
      day,
      "15:30",
      "Actividad principal de la tarde.",
    );

    if (day > 1) {
      add(
        pick(recreations, recreationIndex++),
        day,
        "10:30",
        "Actividad de la mañana.",
      );
    }

    add(
      pick(restaurants, restaurantIndex++),
      day,
      "19:30",
      "Cena y descanso.",
    );

    if (day > 1) {
      add(hotel, day, "21:30", "Noche en el hotel seleccionado.");
    }
  }

  // Reordena por día y hora para que la ruta sea cronológica.
  stopDrafts.sort((a, b) => {
    if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
    return a.startTime.localeCompare(b.startTime) || a.stopOrder - b.stopOrder;
  });
  stopDrafts.forEach((stop, index) => {
    stop.stopOrder = index + 1;
  });

  const totalEstimate =
    hotels[0].price * days +
    stopDrafts
      .filter((stop) => !stop.category.startsWith("hotel"))
      .reduce((sum, stop) => sum + stop.price * travelers, 0);

  const summary =
    `Plan de ${days} ${days === 1 ? "día" : "días"} en ${destination} para ${travelers} ` +
    `${travelers === 1 ? "viajero" : "viajeros"}. ` +
    `Incluye ${hotels.length ? "hospedaje, " : ""}restaurantes y actividades del catálogo VIANova. ` +
    `Presupuesto estimado: $${totalEstimate.toLocaleString("es-CO")} COP.`;

  const db = getDb();
  const insertedTrip = rowsOf(
    await db.execute(drizzleSql`
      INSERT INTO trips (
        user_id, username, conversation_id, destination_city, origin_city,
        days, travelers, budget, currency, status, summary, total_estimate
      ) VALUES (
        ${input.userId}, ${input.username}, ${input.conversationId ?? null},
        ${destination}, ${input.originCity ? cleanText(input.originCity, 80) : null},
        ${days}, ${travelers}, ${budget}, 'COP', 'draft', ${summary}, ${totalEstimate}
      )
      RETURNING *
    `),
  )[0];

  if (!insertedTrip) throw new Error("No se pudo crear el viaje");

  const tripId = String(insertedTrip.id);
  for (const stop of stopDrafts) {
    await db.execute(drizzleSql`
      INSERT INTO trip_stops (
        trip_id, day_number, stop_order, item_type, item_id, category, name,
        description, image_url, price, currency, provider_username, latitude,
        longitude, start_time, duration, notes
      ) VALUES (
        ${tripId}, ${stop.dayNumber}, ${stop.stopOrder}, ${stop.itemType},
        ${stop.itemId}, ${stop.category}, ${stop.name}, ${stop.description},
        ${stop.imageUrl}, ${stop.price}, ${stop.currency}, ${stop.providerUsername},
        ${stop.latitude}, ${stop.longitude}, ${stop.startTime}, ${stop.duration}, ${stop.notes}
      )
    `);
  }

  return getTripById(tripId, input.username);
}

export async function getTripById(tripId: string, username: string): Promise<TripPlan> {
  await ensureTripSchema();
  const db = getDb();
  const tripRows = rowsOf(
    await db.execute(drizzleSql`
      SELECT * FROM trips WHERE id = ${tripId} AND username = ${username} LIMIT 1
    `),
  );
  const trip = tripRows[0];
  if (!trip) throw Object.assign(new Error("Viaje no encontrado"), { status: 404 });

  const stops = rowsOf(
    await db.execute(drizzleSql`
      SELECT * FROM trip_stops
      WHERE trip_id = ${tripId}
      ORDER BY day_number ASC, stop_order ASC
    `),
  ).map(mapStop);

  return mapTrip(trip, stops);
}

export async function getLatestTrip(username: string): Promise<TripPlan | null> {
  await ensureTripSchema();
  const db = getDb();
  const rows = rowsOf(
    await db.execute(drizzleSql`
      SELECT * FROM trips
      WHERE username = ${username}
      ORDER BY created_at DESC
      LIMIT 1
    `),
  );
  if (!rows[0]) return null;
  return getTripById(String(rows[0].id), username);
}

/**
 * Marca la ruta como establecida y escribe un mensaje de chat por cada parada.
 * Es idempotente: si la parada ya tiene mensaje no lo duplica.
 */
export async function establishTripRoute(
  tripId: string,
  username: string,
  userId: string,
): Promise<{ trip: TripPlan; messages: Array<{ stopId: string; content: string; messageId: string | null }> }> {
  await ensureTripSchema();
  const db = getDb();

  const tripRows = rowsOf(
    await db.execute(drizzleSql`
      SELECT * FROM trips WHERE id = ${tripId} AND username = ${username} LIMIT 1
    `),
  );
  const trip = tripRows[0];
  if (!trip) throw Object.assign(new Error("Viaje no encontrado"), { status: 404 });

  const stopRows = rowsOf(
    await db.execute(drizzleSql`
      SELECT * FROM trip_stops
      WHERE trip_id = ${tripId}
      ORDER BY day_number ASC, stop_order ASC
    `),
  );

  let conversationId = trip.conversation_id ? String(trip.conversation_id) : "";
  if (!conversationId) {
    const conversation = await storage.upsertConversation(userId);
    conversationId = conversation.id;
    await db.execute(drizzleSql`
      UPDATE trips SET conversation_id = ${conversationId}, updated_at = now()
      WHERE id = ${tripId}
    `);
  }

  const messages: Array<{ stopId: string; content: string; messageId: string | null }> = [];
  for (const row of stopRows) {
    const stop = mapStop(row);
    let content = stop.message;
    let messageId = stop.chatMessageId;
    if (!content) {
      content = stopMessage({
        dayNumber: stop.dayNumber,
        stopOrder: stop.stopOrder,
        itemType: stop.itemType,
        itemId: stop.itemId,
        category: stop.category,
        name: stop.name,
        description: stop.description,
        imageUrl: stop.imageUrl,
        price: stop.price,
        currency: stop.currency,
        providerUsername: stop.providerUsername,
        latitude: stop.latitude,
        longitude: stop.longitude,
        startTime: stop.startTime,
        duration: stop.duration,
        notes: stop.notes,
      });
      const saved = await storage.addMessage(conversationId, "assistant", content, {
        type: "trip_stop",
        tripId,
        stopId: stop.id,
        dayNumber: stop.dayNumber,
      });
      messageId = String(saved.id);
      await db.execute(drizzleSql`
        UPDATE trip_stops
        SET message = ${content}, chat_message_id = ${messageId}
        WHERE id = ${stop.id}
      `);
    }
    messages.push({ stopId: stop.id, content, messageId: messageId || null });
  }

  await db.execute(drizzleSql`
    UPDATE trips
    SET status = 'routed',
        route_established_at = COALESCE(route_established_at, now()),
        updated_at = now()
    WHERE id = ${tripId}
  `);

  const refreshed = await getTripById(tripId, username);
  return { trip: refreshed, messages };
}

export function detectTripPlanRequest(text: string): {
  intent: boolean;
  days: number;
  travelers: number;
  budget: number | null;
} {
  const normalized = String(text || "").toLowerCase();
  const tripWord =
    /\b(viaje|viajar|plan|planear|planea|planifica|itinerario|ruta|recorrido|tour|dias?|días?)\b/i.test(
      normalized,
    );
  const planningWord =
    /\b(plan|planear|planea|planifica|itinerario|arma|armar|organiza|recomienda|sugiere)\b/i.test(
      normalized,
    );
  const explicitDays = normalized.match(/(\d{1,2})\s*(d[ií]as?|days?)\b/i);
  const explicitTravelers = normalized.match(
    /(\d{1,2})\s*(personas?|viajeros?|adultos?|travelers?|pax)\b/i,
  );
  const budgetMatch = normalized.match(
    /(?:presupuesto|budget|hasta|maximo|máximo)\s*(?:de|:)?\s*\$?\s*([\d.,]{4,})/i,
  );
  const budget = budgetMatch
    ? Number(budgetMatch[1].replace(/[.,]/g, "")) || null
    : null;

  return {
    intent: tripWord && (planningWord || explicitDays !== null || /\bviaj/i.test(normalized)),
    days: explicitDays ? Math.min(Math.max(Number(explicitDays[1]), 1), 7) : 3,
    travelers: explicitTravelers
      ? Math.min(Math.max(Number(explicitTravelers[1]), 1), 10)
      : 2,
    budget,
  };
}

export function detectRouteConfirmation(text: string): boolean {
  const normalized = String(text || "").toLowerCase();
  if (/\b(no|todav[ií]a no|cancelar)\b/.test(normalized) && !/confirm/i.test(normalized)) {
    return false;
  }
  return (
    /\b(establece|establecer|confirma|confirmar|crea|crear|acepta|aceptar|aprueba|aprobar)\b/.test(
      normalized,
    ) && /\b(ruta|recorrido|itinerario|plan|viaje)\b/.test(normalized)
  ) || /\b(s[ií],?\s+confirmo|dale,?\s+establece|hazlo)\b/.test(normalized);
}

export function formatTripForChat(trip: TripPlan): string {
  const lines = trip.stops.map(
    (stop) =>
      `- Día ${stop.dayNumber} · ${stop.startTime} — [${catalogCategoryLabel(stop.category)}] ${stop.name} ($${stop.price.toLocaleString("es-CO")} ${stop.currency})`,
  );
  return `${trip.summary}\n\n${lines.join("\n")}\n\nCuando quieras, pulsa **Establecer ruta** y enviaré un mensaje por cada parada.`;
}
