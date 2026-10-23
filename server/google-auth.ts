import crypto from "crypto";
import jwt from "jsonwebtoken";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS: [string, ...string[]] = ["https://accounts.google.com", "accounts.google.com"];

type Jwk = crypto.JsonWebKey & { kid?: string };

let jwksCache: { keys: Jwk[]; expiresAt: number } | null = null;

async function fetchGoogleJwks(): Promise<Jwk[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`No se pudieron obtener las claves de Google (${response.status})`);
  const data: any = await response.json();
  const keys: Jwk[] = Array.isArray(data?.keys) ? data.keys : [];
  if (keys.length === 0) throw new Error("Respuesta JWKS de Google inválida");
  jwksCache = { keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return keys;
}

export type GoogleIdTokenPayload = {
  sub: string;
  email: string;
  email_verified: boolean | string;
  aud: string;
  iss: string;
  name?: string;
  given_name?: string;
  exp: number;
};

/**
 * Verifica un ID token de Google con la librería estándar de JWT + JWKS oficial.
 * Valida firma RS256, kid, issuer, audience, expiración y email_verified.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  options: {
    allowedClientIds: string[];
    fetchJwks?: () => Promise<Jwk[]>;
  },
): Promise<GoogleIdTokenPayload> {
  if (!idToken || typeof idToken !== "string") throw new Error("ID token ausente");
  if (!options.allowedClientIds.length) throw new Error("GOOGLE_CLIENT_ID no está configurado");

  const decoded = jwt.decode(idToken, { complete: true }) as any;
  const kid = decoded?.header?.kid;
  const alg = decoded?.header?.alg;
  if (!kid || alg !== "RS256") throw new Error("Cabecera de token de Google inválida");

  const keys = options.fetchJwks ? await options.fetchJwks() : await fetchGoogleJwks();
  const jwk = keys.find((key) => key.kid === kid);
  if (!jwk) throw new Error("No se encontró la clave de firma de Google");

  const publicKey = crypto.createPublicKey({ key: jwk as any, format: "jwk" });
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ["RS256"],
    audience: options.allowedClientIds as [string, ...string[]],
    issuer: GOOGLE_ISSUERS,
  }) as unknown as GoogleIdTokenPayload;

  if (!payload?.email) throw new Error("El token de Google no contiene email");
  if (payload.email_verified !== true && payload.email_verified !== "true") {
    throw new Error("El email de Google no está verificado");
  }

  return payload;
}

export function assertVerifiedGoogleProfile(profile: any): { email: string; name?: string } {
  if (!profile?.email) throw new Error("El perfil de Google no contiene email");
  if (profile.email_verified !== true && profile.email_verified !== "true") {
    throw new Error("El email de Google no está verificado");
  }
  return { email: String(profile.email), name: profile.name ? String(profile.name) : undefined };
}
