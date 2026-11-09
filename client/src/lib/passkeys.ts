import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { apiRequest } from "./queryClient";

export type ReauthPurpose =
  | "passkey-register"
  | "passkey-remove"
  | "password-change"
  | "recovery-email"
  | "two-factor";

/**
 * Registra una passkey en el dispositivo actual. El servidor exige un token de
 * reautenticación recién emitido y ligado a "passkey-register".
 */
export async function startPasskeyRegistration(label: string, reauthToken: string): Promise<void> {
  const optionsResponse = await apiRequest("POST", "/api/auth/passkeys/options");
  const { options, challengeId } = await optionsResponse.json();
  const response = await startRegistration({ optionsJSON: options });
  await apiRequest("POST", "/api/auth/passkeys", { response, challengeId, label, reauthToken });
}

/** Confirmación con passkey para una operación concreta. Devuelve un token de un solo uso. */
export async function confirmWithPasskey(purpose: ReauthPurpose): Promise<string> {
  const optionsResponse = await apiRequest("POST", "/api/auth/reauth/options", { purpose });
  const { options, challengeId } = await optionsResponse.json();
  const response = await startAuthentication({ optionsJSON: options });
  const verified = await (await apiRequest("POST", "/api/auth/reauth/verify", { purpose, challengeId, response })).json();
  if (!verified?.reauthToken) throw new Error("No se pudo confirmar tu identidad.");
  return String(verified.reauthToken);
}

/** Alternativa segura cuando la persona aún no tiene una passkey registrada. */
export async function confirmWithPassword(purpose: ReauthPurpose, password: string): Promise<string> {
  const verified = await (await apiRequest("POST", "/api/auth/reauth/password", { purpose, password })).json();
  if (!verified?.reauthToken) throw new Error("No se pudo confirmar tu identidad.");
  return String(verified.reauthToken);
}
