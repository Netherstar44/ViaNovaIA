import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "./storage.js";
import { escapeHtml, hashResetToken } from "./security.js";
import { sendCustomEmail } from "./mailer.js";

/**
 * Genera un código 2FA de un solo uso, lo guarda hasheado con caducidad y lo
 * envía al correo de la cuenta. La respuesta nunca revela el código.
 */
export async function beginTwoFactorChallenge(user: any) {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await getDb().execute(sql`
    UPDATE users
    SET verification_token = ${`2fa:${hashResetToken(code)}:${expiresAt}`}, two_factor_attempts = 0
    WHERE id = ${user.id}
  `);
  if (user.email) {
    sendCustomEmail({
      to: user.email,
      subject: "Tu código de verificación VIANova",
      html: `<p>Hola ${escapeHtml(user.name || user.username)},</p><p>Tu código de verificación en dos pasos es: <strong>${code}</strong></p><p>Expira en 10 minutos.</p>`,
    }).catch((err) => console.error("Error enviando código 2FA:", err?.message || err));
  }
  return {
    requires2FA: true,
    username: user.username,
    message: "Ingresa el código enviado a tu correo.",
  };
}
