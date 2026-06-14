/**
 * Módulo de cifrado AES-256-GCM para datos sensibles.
 *
 * Uso:
 *   import { encrypt, decrypt } from "./lib/encryption.js";
 *   const encrypted = encrypt("dato secreto");
 *   const original  = decrypt(encrypted);
 *
 * La clave se toma de la variable de entorno ENCRYPTION_KEY (hex de 64 chars = 32 bytes).
 * Si no existe, se genera una efímera (NO persiste entre reinicios).
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // Auth tag

function getKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length === 64) {
    return Buffer.from(envKey, "hex");
  }
  // Fallback efímero — log warning una sola vez
  if (!(globalThis as any).__encWarnShown) {
    console.warn(
      "[WARN] ENCRYPTION_KEY no configurada — usando clave efímera. Los datos cifrados NO sobrevivirán un reinicio."
    );
    (globalThis as any).__encWarnShown = true;
  }
  if (!(globalThis as any).__ephemeralKey) {
    (globalThis as any).__ephemeralKey = crypto.randomBytes(32);
  }
  return (globalThis as any).__ephemeralKey;
}

/**
 * Cifra un texto plano con AES-256-GCM.
 * Retorna un string en formato: `iv:authTag:ciphertext` (todo en hex).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Descifra un string previamente cifrado con `encrypt()`.
 */
export function decrypt(encryptedStr: string): string {
  const [ivHex, authTagHex, ciphertext] = encryptedStr.split(":");
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Formato de cifrado inválido");
  }

  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Genera una ENCRYPTION_KEY aleatoria segura (para usar en .env).
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
