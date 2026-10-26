/**
 * Configuración de seguridad centralizada.
 *
 * Reglas:
 * - Nunca usar secretos por defecto conocidos.
 * - El servidor falla al arrancar si falta JWT_SECRET o SESSION_SECRET.
 * - Las URLs públicas se fijan por entorno; nunca se confía en Host/X-Forwarded-Host.
 */

export const isProduction = () => process.env.NODE_ENV === "production";

function readSecret(name: string, minLength = 32): string {
  const value = process.env[name];
  if (!value || value.trim().length < minLength) {
    throw new Error(
      `[security] Falta ${name} o es demasiado corto (mínimo ${minLength} caracteres). ` +
        `Configúralo en el gestor de secretos antes de arrancar.`,
    );
  }
  return value;
}

/** Valida todos los secretos obligatorios. Llamar al arrancar el servidor. */
export function assertSecurityConfig(): void {
  readSecret("JWT_SECRET", 32);
  readSecret("SESSION_SECRET", 32);
}

export function getJwtSecret(): string {
  return readSecret("JWT_SECRET", 32);
}

export function getSessionSecret(): string {
  return readSecret("SESSION_SECRET", 32);
}

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "capacitor:") {
      return null;
    }
    // `URL.origin` devuelve "null" para esquemas no especiales como
    // `capacitor://localhost` (WebView de iOS). Reconstruirlo explícitamente
    // permite validar el origen del APK/IPA sin abrir la allowlist.
    if (url.protocol === "capacitor:") {
      return `capacitor://${url.host}`;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Orígenes permitidos para CORS y para validar Origin/Referer en mutaciones.
 * En producción solo se aceptan los orígenes configurados explícitamente.
 */
export function getAllowedOrigins(): string[] {
  const configured = [
    process.env.CLIENT_URL,
    process.env.APP_URL,
    process.env.PUBLIC_URL,
    process.env.CORS_ALLOWED_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));

  // El WebView nativo usa estos orígenes en producción y en desarrollo.
  const native = ["capacitor://localhost", "https://localhost"];
  const local = isProduction()
    ? []
    : [
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5055",
        "http://127.0.0.1:5055",
      ];

  const defaults = isProduction() ? ["https://via-nova-ia.vercel.app"] : [];
  return Array.from(new Set([...configured, ...defaults, ...native, ...local]));
}

export function isOriginAllowed(origin: string | undefined | null): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  return Boolean(normalized && getAllowedOrigins().includes(normalized));
}

/**
 * URL base pública fija. No se deriva de cabeceras controladas por el cliente.
 */
export function getAppBaseUrl(): string {
  const configured = process.env.PUBLIC_URL || process.env.APP_URL || process.env.CLIENT_URL;
  if (configured) {
    const normalized = normalizeOrigin(configured);
    if (normalized) return normalized;
  }
  return isProduction() ? "https://via-nova-ia.vercel.app" : "http://localhost:5055";
}

/** URI de callback de Google OAuth fijada por entorno. */
export function getGoogleRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  return `${getAppBaseUrl()}/api/auth/google`;
}

/** IDs de cliente Google aceptados al verificar ID tokens móviles. */
export function getGoogleAllowedClientIds(): string[] {
  const values = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_MOBILE_CLIENT_ID,
    process.env.GOOGLE_ALLOWED_CLIENT_IDS,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}
