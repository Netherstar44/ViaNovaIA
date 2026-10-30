import crypto from "crypto";
import { sql as drizzleSql } from "drizzle-orm";
import { getAppBaseUrl, isProduction } from "./config.js";
import { logSecurityEvent } from "./observability.js";
import { isPaymentMethodType, type PaymentMethodType } from "./security.js";
import { getDb } from "./storage.js";
import { ensureTripSchema, getTripById, type TripPlan } from "./trips.js";

/**
 * Pagos de rutas con pasarela hospedada.
 *
 * Principios de privacidad:
 * - VIANova nunca recibe ni guarda números de tarjeta, CVV, claves bancarias,
 *   números de cuenta ni el contenido de un QR. Solo crea una intención de pago
 *   y redirige al checkout de Wompi.
 * - El monto y la referencia se calculan en el servidor a partir del viaje.
 * - El webhook es la única fuente de verdad para marcar un pago como aprobado.
 * - En sandbox se permite una confirmación explícita y auditada, nunca silenciosa.
 */

export const WOMPI_SANDBOX_CHECKOUT = "https://checkout.wompi.co/l/test_VPOS_tGKfH8";

export type PaymentIntentStatus =
  | "pending"
  | "checkout_opened"
  | "sandbox_paid"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled";

export type PaymentIntentDto = {
  id: string;
  reference: string;
  amount: number;
  amountInCents: number;
  currency: string;
  status: PaymentIntentStatus;
  method: PaymentMethodType;
  provider: "wompi" | "cash";
  description: string;
  checkoutUrl: string | null;
  sandbox: boolean;
  instructions: string | null;
  tripId: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string | null;
};

export type CreatePaymentIntentInput = {
  userId: string;
  username: string;
  tripId: string;
  method: PaymentMethodType;
  idempotencyKey?: string | null;
};

let schemaPromise: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase(), "utf8");
  const right = Buffer.from(b.toLowerCase(), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function asDate(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isPaymentSandbox(): boolean {
  const flag = String(process.env.PAYMENT_SANDBOX_MODE ?? "").trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !isProduction();
}

/** Solo se aceptan URLs de checkout del dominio de Wompi. */
export function isAllowedWompiCheckoutUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    return url.hostname === "checkout.wompi.co" || url.hostname.endsWith(".wompi.co");
  } catch {
    return false;
  }
}

export type WompiCheckout = {
  url: string | null;
  mode: "signed" | "sandbox_link" | "unavailable";
  sandbox: boolean;
};

/**
 * Construye el checkout hospedado. Si existen llaves de integración se firma
 * la referencia y el monto; si no, en sandbox se usa el enlace de prueba.
 */
export function buildWompiCheckoutUrl(input: {
  reference: string;
  amountInCents: number;
  currency?: string;
  redirectUrl: string;
  expirationTime: string;
}): WompiCheckout {
  const publicKey = String(process.env.WOMPI_PUBLIC_KEY ?? "").trim();
  const integritySecret = String(process.env.WOMPI_INTEGRITY_SECRET ?? "").trim();
  const currency = input.currency || "COP";
  const sandbox = isPaymentSandbox() || publicKey.startsWith("pub_test_");

  if (publicKey && integritySecret) {
    const signature = sha256(
      `${input.reference}${input.amountInCents}${currency}${input.expirationTime}${integritySecret}`,
    );
    const url = new URL("https://checkout.wompi.co/p/");
    url.searchParams.set("public-key", publicKey);
    url.searchParams.set("currency", currency);
    url.searchParams.set("amount-in-cents", String(input.amountInCents));
    url.searchParams.set("reference", input.reference);
    url.searchParams.set("signature:integrity", signature);
    url.searchParams.set("redirect-url", input.redirectUrl);
    url.searchParams.set("expiration-time", input.expirationTime);
    return { url: url.toString(), mode: "signed", sandbox };
  }

  if (isPaymentSandbox()) {
    const configured = String(process.env.WOMPI_CHECKOUT_URL ?? "").trim();
    const fallback = configured && isAllowedWompiCheckoutUrl(configured)
      ? configured
      : WOMPI_SANDBOX_CHECKOUT;
    return { url: fallback, mode: "sandbox_link", sandbox: true };
  }

  return { url: null, mode: "unavailable", sandbox: false };
}

export function getPaymentConfig() {
  const publicKey = String(process.env.WOMPI_PUBLIC_KEY ?? "").trim();
  const signed = Boolean(publicKey && process.env.WOMPI_INTEGRITY_SECRET);
  const sandbox = isPaymentSandbox() || publicKey.startsWith("pub_test_");
  const mode = signed ? (sandbox ? "sandbox" : "live") : sandbox ? "sandbox_link" : "unavailable";
  return {
    provider: "wompi" as const,
    mode,
    hostedCheckout: true,
    sandbox,
    supports: ["card", "pse", "nequi", "qr", "breb", "cash", "wompi"] as PaymentMethodType[],
    note:
      "Los datos bancarios se capturan únicamente en el checkout de Wompi. VIANova nunca los recibe ni los almacena.",
  };
}

export function ensurePaymentSchema(): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await ensureTripSchema();
    const db = getDb();

    // Tipos nuevos para métodos locales y de pasarela. `ADD VALUE` es
    // idempotente y no afecta filas existentes.
    await db.execute(drizzleSql`
      DO $$ BEGIN
        CREATE TYPE payment_method_type AS ENUM (
          'cash', 'nequi', 'daviplata', 'card', 'pse', 'qr', 'breb', 'wompi'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    for (const value of ["pse", "qr", "breb", "wompi"]) {
      await db.execute(
        drizzleSql.raw(`ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS '${value}'`),
      );
    }

    await db.execute(drizzleSql`
      CREATE TABLE IF NOT EXISTS payment_intents (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username text NOT NULL,
        trip_id varchar REFERENCES trips(id) ON DELETE SET NULL,
        reference text NOT NULL,
        provider text NOT NULL DEFAULT 'wompi',
        method text NOT NULL,
        amount_cents integer NOT NULL,
        currency text NOT NULL DEFAULT 'COP',
        status text NOT NULL DEFAULT 'pending',
        description text,
        checkout_url text,
        sandbox boolean NOT NULL DEFAULT false,
        instructions text,
        idempotency_key text,
        metadata jsonb,
        expires_at timestamp,
        paid_at timestamp,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await db.execute(drizzleSql`
      CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_reference_idx
      ON payment_intents (reference)
    `);
    await db.execute(drizzleSql`
      CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_idempotency_idx
      ON payment_intents (username, idempotency_key)
      WHERE idempotency_key IS NOT NULL
    `);
    await db.execute(drizzleSql`
      CREATE INDEX IF NOT EXISTS payment_intents_username_created_idx
      ON payment_intents (username, created_at DESC)
    `);
    await db.execute(drizzleSql`
      CREATE INDEX IF NOT EXISTS payment_intents_trip_idx
      ON payment_intents (trip_id, created_at DESC)
    `);
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

function mapIntent(row: any): PaymentIntentDto {
  const amountInCents = Number(row.amount_cents) || 0;
  return {
    id: String(row.id),
    reference: String(row.reference || ""),
    amount: amountInCents / 100,
    amountInCents,
    currency: String(row.currency || "COP"),
    status: String(row.status || "pending") as PaymentIntentStatus,
    method: String(row.method || "wompi") as PaymentMethodType,
    provider: String(row.provider || "wompi") === "cash" ? "cash" : "wompi",
    description: String(row.description || ""),
    checkoutUrl: row.checkout_url ? String(row.checkout_url) : null,
    sandbox: Boolean(row.sandbox),
    instructions: row.instructions ? String(row.instructions) : null,
    tripId: row.trip_id ? String(row.trip_id) : null,
    expiresAt: asDate(row.expires_at),
    paidAt: asDate(row.paid_at),
    createdAt: asDate(row.created_at),
  };
}

async function expireStaleIntents(username?: string): Promise<void> {
  const db = getDb();
  if (username) {
    await db.execute(drizzleSql`
      UPDATE payment_intents
      SET status = 'expired', updated_at = now()
      WHERE username = ${username}
        AND status IN ('pending', 'checkout_opened')
        AND expires_at IS NOT NULL
        AND expires_at < now()
    `);
    return;
  }
  await db.execute(drizzleSql`
    UPDATE payment_intents
    SET status = 'expired', updated_at = now()
    WHERE status IN ('pending', 'checkout_opened')
      AND expires_at IS NOT NULL
      AND expires_at < now()
  `);
}

function tripDescription(trip: TripPlan): string {
  const days = `${trip.days} ${trip.days === 1 ? "día" : "días"}`;
  return `Ruta ${trip.destinationCity} · ${days} · ${trip.stops.length} paradas`;
}

function paymentInstructions(method: PaymentMethodType): string | null {
  if (method === "cash") {
    return "Paga en efectivo al proveedor al iniciar el servicio. VIANova no procesa dinero en efectivo.";
  }
  if (method === "breb") {
    return "La pasarela mostrará las instrucciones de Bre-B. No compartas tu llave ni datos bancarios por chat.";
  }
  if (method === "qr") {
    return "Abre el checkout y escanea el QR dentro de la pasarela. No envíes imágenes de tu QR por chat.";
  }
  return "Completa el pago en la pasarela hospedada. No compartas datos bancarios por chat.";
}

export async function createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentDto> {
  await ensurePaymentSchema();
  const db = getDb();

  if (!isPaymentMethodType(input.method)) {
    throw Object.assign(new Error("Método de pago inválido"), { status: 400 });
  }

  const trip = await getTripById(input.tripId, input.username);
  if (trip.status !== "routed") {
    throw Object.assign(new Error("Primero revisa y establece la ruta antes de pagar"), { status: 409 });
  }
  if (trip.paymentStatus === "paid" || trip.paymentStatus === "sandbox_paid") {
    throw Object.assign(new Error("Esta ruta ya tiene un pago registrado"), { status: 409 });
  }

  const amountInCents = Math.round(Number(trip.totalEstimate) * 100);
  if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
    throw Object.assign(new Error("La ruta no tiene un monto válido para pagar"), { status: 400 });
  }

  const idempotencyKey = input.idempotencyKey
    ? String(input.idempotencyKey).replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 100) || null
    : null;

  // Idempotencia explícita y reutilización de un intent vigente para el viaje.
  if (idempotencyKey) {
    const prior = rowsOf(
      await db.execute(drizzleSql`
        SELECT * FROM payment_intents
        WHERE username = ${input.username} AND idempotency_key = ${idempotencyKey}
        LIMIT 1
      `),
    )[0];
    if (prior) return mapIntent(prior);
  }

  const existing = rowsOf(
    await db.execute(drizzleSql`
      SELECT * FROM payment_intents
      WHERE username = ${input.username}
        AND trip_id = ${input.tripId}
        AND status IN ('pending', 'checkout_opened')
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC
      LIMIT 1
    `),
  )[0];
  if (existing) return mapIntent(existing);

  const reference = `VN-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const provider = input.method === "cash" ? "cash" : "wompi";
  const checkout = provider === "cash"
    ? { url: null, mode: "unavailable" as const, sandbox: isPaymentSandbox() }
    : buildWompiCheckoutUrl({
        reference,
        amountInCents,
        currency: trip.currency || "COP",
        redirectUrl: `${getAppBaseUrl()}/payments?reference=${encodeURIComponent(reference)}`,
        expirationTime: expiresAt.toISOString(),
      });

  if (provider === "wompi" && !checkout.url) {
    throw Object.assign(
      new Error("La pasarela de pagos no está configurada. Contacta al administrador."),
      { status: 503 },
    );
  }

  const status: PaymentIntentStatus = "pending";
  const instructions = paymentInstructions(input.method);
  const metadata = {
    tripId: trip.id,
    destinationCity: trip.destinationCity,
    days: trip.days,
    travelers: trip.travelers,
    stops: trip.stops.length,
  };

  const inserted = rowsOf(
    await db.execute(drizzleSql`
      INSERT INTO payment_intents (
        user_id, username, trip_id, reference, provider, method, amount_cents,
        currency, status, description, checkout_url, sandbox, instructions,
        idempotency_key, metadata, expires_at
      ) VALUES (
        ${input.userId}, ${input.username}, ${trip.id}, ${reference}, ${provider},
        ${input.method}, ${amountInCents}, ${trip.currency || "COP"}, ${status},
        ${tripDescription(trip)}, ${checkout.url}, ${checkout.sandbox},
        ${instructions}, ${idempotencyKey},
        CAST(${JSON.stringify(metadata)} AS jsonb), ${expiresAt}
      )
      RETURNING *
    `),
  )[0];

  if (!inserted) throw new Error("No se pudo crear la intención de pago");

  await db.execute(drizzleSql`
    UPDATE trips
    SET payment_status = 'pending', payment_intent_id = ${inserted.id}, updated_at = now()
    WHERE id = ${trip.id} AND username = ${input.username}
  `);

  logSecurityEvent("payment.intent_created", {
    intentId: inserted.id,
    reference,
    username: input.username,
    method: input.method,
    amountInCents,
    sandbox: checkout.sandbox,
  });

  return mapIntent(inserted);
}

export async function getPaymentIntent(id: string, username: string, isAdmin = false): Promise<PaymentIntentDto> {
  await ensurePaymentSchema();
  await expireStaleIntents(isAdmin ? undefined : username);
  const db = getDb();
  const rows = rowsOf(
    await db.execute(drizzleSql`
      SELECT * FROM payment_intents WHERE id = ${id} LIMIT 1
    `),
  );
  const intent = rows[0];
  if (!intent) throw Object.assign(new Error("Pago no encontrado"), { status: 404 });
  if (!isAdmin && String(intent.username) !== username) {
    throw Object.assign(new Error("Pago no encontrado"), { status: 404 });
  }
  return mapIntent(intent);
}

export async function listPaymentIntents(
  username: string,
  options: { tripId?: string | null; limit?: number } = {},
): Promise<PaymentIntentDto[]> {
  await ensurePaymentSchema();
  await expireStaleIntents(username);
  const db = getDb();
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 20), 1), 50);
  const rows = options.tripId
    ? rowsOf(
        await db.execute(drizzleSql`
          SELECT * FROM payment_intents
          WHERE username = ${username} AND trip_id = ${options.tripId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `),
      )
    : rowsOf(
        await db.execute(drizzleSql`
          SELECT * FROM payment_intents
          WHERE username = ${username}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `),
      );
  return rows.map(mapIntent);
}

/**
 * Confirmación de sandbox. No es una aprobación real: se marca explícitamente
 * como `sandbox_paid` y solo se permite si el servidor está en modo sandbox.
 */
export async function confirmSandboxPayment(
  id: string,
  username: string,
): Promise<PaymentIntentDto> {
  await ensurePaymentSchema();
  if (!isPaymentSandbox()) {
    throw Object.assign(new Error("La confirmación sandbox está deshabilitada"), { status: 403 });
  }
  const db = getDb();
  const rows = rowsOf(
    await db.execute(drizzleSql`
      SELECT * FROM payment_intents WHERE id = ${id} AND username = ${username} LIMIT 1
    `),
  );
  const intent = rows[0];
  if (!intent) throw Object.assign(new Error("Pago no encontrado"), { status: 404 });
  if (!["pending", "checkout_opened"].includes(String(intent.status))) {
    return mapIntent(intent);
  }

  const updated = rowsOf(
    await db.execute(drizzleSql`
      UPDATE payment_intents
      SET status = 'sandbox_paid', paid_at = now(), updated_at = now()
      WHERE id = ${id} AND username = ${username}
      RETURNING *
    `),
  )[0];

  if (intent.trip_id) {
    await db.execute(drizzleSql`
      UPDATE trips
      SET payment_status = 'sandbox_paid', paid_at = now(), updated_at = now()
      WHERE id = ${intent.trip_id}
        AND username = ${username}
        AND payment_intent_id = ${id}
    `);
  }

  logSecurityEvent("payment.sandbox_confirmed", {
    intentId: id,
    username,
    reference: String(intent.reference || ""),
  });

  return mapIntent(updated || intent);
}

function getPath(source: any, path: string): unknown {
  return String(path)
    .split(".")
    .filter(Boolean)
    .reduce((current: any, key: string) => (current == null ? undefined : current[key]), source);
}

/**
 * Firma de eventos de Wompi: SHA256(propiedades concatenadas + timestamp +
 * secreto de eventos). Se usa comparación en tiempo constante.
 */
export function computeWompiEventChecksum(payload: any, secret: string): string | null {
  const properties = payload?.signature?.properties;
  if (!Array.isArray(properties) || properties.length === 0) return null;
  if (payload?.timestamp === undefined || payload?.timestamp === null) return null;

  const values: string[] = [];
  for (const property of properties) {
    const value = getPath(payload?.data, String(property));
    if (value === undefined || value === null) return null;
    values.push(String(value));
  }
  return sha256(`${values.join("")}${String(payload.timestamp)}${secret}`);
}

export function verifyWompiEventChecksum(
  payload: any,
  receivedChecksum: unknown,
  secret: string,
): boolean {
  const expected = computeWompiEventChecksum(payload, secret);
  const received = String(receivedChecksum ?? "").trim();
  return Boolean(expected && received && safeEqualHex(expected, received));
}

/**
 * Procesa un evento ya verificado. La referencia y el monto se comparan con la
 * intención local antes de cambiar cualquier estado.
 */
export async function processWompiEvent(payload: any): Promise<{ received: true; ignored?: string }> {
  await ensurePaymentSchema();
  const transaction = payload?.data?.transaction;
  if (!transaction) return { received: true, ignored: "missing_transaction" };

  const reference = String(transaction.reference || "").trim();
  if (!reference) return { received: true, ignored: "missing_reference" };

  const db = getDb();
  const rows = rowsOf(
    await db.execute(drizzleSql`
      SELECT * FROM payment_intents WHERE reference = ${reference} LIMIT 1
    `),
  );
  const intent = rows[0];
  if (!intent) {
    logSecurityEvent("payment.webhook_unknown_reference", { reference });
    return { received: true, ignored: "unknown_reference" };
  }

  const amountInCents = Number(transaction.amount_in_cents);
  const currency = String(transaction.currency || "COP").toUpperCase();
  if (
    !Number.isFinite(amountInCents) ||
    amountInCents !== Number(intent.amount_cents) ||
    currency !== String(intent.currency || "COP").toUpperCase()
  ) {
    logSecurityEvent("payment.webhook_amount_mismatch", {
      reference,
      expectedAmount: Number(intent.amount_cents),
      receivedAmount: amountInCents,
      expectedCurrency: String(intent.currency || "COP"),
      receivedCurrency: currency,
    });
    return { received: true, ignored: "amount_mismatch" };
  }

  const wompiStatus = String(transaction.status || "").toUpperCase();
  const nextStatus: PaymentIntentStatus | null =
    wompiStatus === "APPROVED"
      ? "paid"
      : ["DECLINED", "VOIDED", "ERROR"].includes(wompiStatus)
        ? "failed"
        : null;

  if (!nextStatus) return { received: true, ignored: "status_not_final" };

  const updated = rowsOf(
    await db.execute(drizzleSql`
      UPDATE payment_intents
      SET status = ${nextStatus},
          paid_at = CASE WHEN ${nextStatus} = 'paid' THEN now() ELSE paid_at END,
          updated_at = now()
      WHERE id = ${intent.id} AND status <> 'paid'
      RETURNING *
    `),
  )[0];

  if (!updated) return { received: true, ignored: "already_processed" };

  if (intent.trip_id) {
    await db.execute(drizzleSql`
      UPDATE trips
      SET payment_status = ${nextStatus},
          paid_at = CASE WHEN ${nextStatus} = 'paid' THEN now() ELSE paid_at END,
          updated_at = now()
      WHERE id = ${intent.trip_id} AND payment_intent_id = ${intent.id}
    `);
  }

  logSecurityEvent("payment.webhook_processed", {
    intentId: String(intent.id),
    reference,
    status: nextStatus,
  });

  return { received: true };
}
