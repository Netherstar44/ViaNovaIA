/**
 * Servicio 2FA TOTP — Google Authenticator compatible.
 *
 * Los secretos TOTP se cifran con AES-256-GCM antes de almacenarse.
 */
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { encrypt, decrypt } from "./encryption.js";

const ISSUER = "VIANova";

/**
 * Genera un nuevo secreto TOTP y retorna el secreto cifrado + QR data URL.
 */
export async function generateTotpSetup(username: string): Promise<{
  encryptedSecret: string;
  qrDataUrl: string;
  manualEntry: string;
}> {
  const secret = speakeasy.generateSecret({
    name: `${ISSUER} (${username})`
  });
  
  if (!secret.otpauth_url || !secret.base32) {
      throw new Error("Failed to generate TOTP secret");
  }

  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    encryptedSecret: encrypt(secret.base32),
    qrDataUrl,
    manualEntry: secret.base32, // shown once to user, then discarded
  };
}

/**
 * Verifica un código TOTP de 6 dígitos contra un secreto cifrado.
 */
export function verifyTotp(encryptedSecret: string, token: string): boolean {
  try {
    const secret = decrypt(encryptedSecret);
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1 // allows 1 step before/after
    });
  } catch {
    return false;
  }
}
