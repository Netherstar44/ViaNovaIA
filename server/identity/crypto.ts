import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function key(): Buffer {
  const value = process.env.BIOMETRIC_ENCRYPTION_KEY;
  if (!value || !/^[a-f\d]{64}$/i.test(value)) throw new Error("Configura una clave biométrica independiente de 32 bytes.");
  return Buffer.from(value, "hex");
}
export function seal(value: unknown, subject: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`identity-v1:${subject}`));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes].map(b => b.toString("base64")).join(".");
}
export function unseal<T>(value: string, subject: string): T {
  const [iv, tag, bytes] = value.split(".").map(b => Buffer.from(b, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAAD(Buffer.from(`identity-v1:${subject}`));
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(bytes), decipher.final()]).toString());
}
