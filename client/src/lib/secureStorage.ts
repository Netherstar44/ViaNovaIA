import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const TOKEN_KEY = "vianova_auth_token";
const LEGACY_KEY = "auth_token";

let cachedToken: string | null | undefined;

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * El JWT solo se persiste en el almacenamiento nativo (Android Keystore /
 * iOS Keychain a través de Capacitor Preferences). En web no se guarda en
 * JavaScript: la sesión vive en una cookie HttpOnly.
 */
export async function getAuthToken(): Promise<string | null> {
  if (cachedToken !== undefined && cachedToken !== null) return cachedToken;

  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      cachedToken = legacy;
      return legacy;
    }

    if (isNativeApp()) {
      const { value } = await Preferences.get({ key: TOKEN_KEY });
      cachedToken = value || null;
      return cachedToken;
    }
  } catch {
    cachedToken = null;
  }
  return cachedToken ?? null;
}

export async function setAuthToken(token: string | null): Promise<void> {
  cachedToken = token || null;
  // Nunca dejar el token en localStorage, ni siquiera en web.
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* storage bloqueado */ }

  if (!isNativeApp()) return;
  try {
    if (token) {
      await Preferences.set({ key: TOKEN_KEY, value: token });
    } else {
      await Preferences.remove({ key: TOKEN_KEY });
    }
  } catch {
    // Si el almacenamiento nativo falla, la sesión actual sigue funcionando
    // en memoria y el usuario puede volver a iniciar sesión.
  }
}

export async function clearAuthToken(): Promise<void> {
  await setAuthToken(null);
}

/** Cabeceras para llamadas directas que no pasan por el wrapper global. */
export async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  if (isNativeApp()) headers["X-Client-Platform"] = "capacitor";
  const token = await getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
