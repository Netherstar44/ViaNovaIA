import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const FROM = () => process.env.SMTP_FROM || `VIANova <${process.env.SMTP_USER}>`;
const F = `'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`;
const APP = () => process.env.NGROK_URL || process.env.CLIENT_URL || "http://localhost:5000";

// Read the logo and cache it as base64 for CID attachment
const LOGO_PATH = path.resolve(process.cwd(), "client", "public", "logo.jpeg");
let logoBuffer: Buffer | null = null;
try {
  logoBuffer = fs.readFileSync(LOGO_PATH);
} catch {
  console.warn("Logo file not found at", LOGO_PATH);
}

function shell(body: string): string {
  // Logo embedded via cid:logo@vianova
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="color-scheme" content="light dark"/><meta name="supported-color-schemes" content="light dark"/>
<style>
:root { color-scheme: light dark; }
@media (prefers-color-scheme: light) {
  .email-bg { background-color: #f5f5f0 !important; }
  .card-bg { background-color: #ffffff !important; border-color: rgba(0,0,0,0.06) !important; }
  .text-main { color: #1a1a1a !important; }
  .text-sub { color: #666666 !important; }
  .text-muted { color: #999999 !important; }
  .text-micro { color: #bbbbbb !important; }
  .code-bg { background: rgba(201,162,39,0.08) !important; border-color: rgba(201,162,39,0.15) !important; }
  .divider { background: rgba(0,0,0,0.06) !important; }
  .list-border { border-color: rgba(0,0,0,0.06) !important; }
}
</style></head>
<body style="margin:0;padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color:#050509;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-collapse:collapse;">
<tr><td style="height:3px;background:linear-gradient(90deg,#c9a227,#e8c547,#c9a227);border-radius:12px 12px 0 0;"></td></tr>
<tr><td class="card-bg" style="background-color:#0a0a12;padding:44px 40px 36px;border:1px solid rgba(255,255,255,0.03);border-top:none;border-radius:0 0 12px 12px;">
<!-- Logo -->
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr>
<td style="padding-right:14px;vertical-align:middle;"><img src="cid:logo@vianova" alt="VIANova" width="40" height="40" style="display:block;border-radius:8px;border:0;outline:none;" /></td>
<td style="vertical-align:middle;"><span style="font-family:${F};font-size:20px;font-weight:800;color:#c9a227;">VIA</span><span class="text-main" style="font-family:${F};font-size:20px;font-weight:800;color:#e0e0e0;">Nova</span></td>
</tr></table>
${body}
</td></tr>
<tr><td style="padding:20px 0;text-align:center;">
<p class="text-micro" style="margin:0;font-family:${F};font-size:10px;color:rgba(255,255,255,0.10);letter-spacing:1px;">VIANOVA &middot; TURISMO INTELIGENTE</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

// Logo attachment for CID embedding — always shows in Gmail
function logoAttachment(): nodemailer.SendMailOptions["attachments"] {
  if (!logoBuffer) return [];
  return [{
    filename: "logo.jpeg",
    content: logoBuffer,
    cid: "logo@vianova",
    contentDisposition: "inline",
    contentType: "image/jpeg",
  }];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. WELCOME — Sent to both Google and local accounts
// ═══════════════════════════════════════════════════════════════════════════════
export async function sendWelcomeEmail(to: string, userName: string): Promise<void> {
  const name = userName || "Viajero";
  const body = `
  <h1 class="text-main" style="margin:0 0 8px;font-family:${F};font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">Bienvenido, ${name}.</h1>
  <p class="text-sub" style="margin:0 0 28px;font-family:${F};font-size:14px;color:rgba(255,255,255,0.40);line-height:1.8;">
    Tu cuenta en VIANova ha sido creada exitosamente. Ya puedes explorar destinos, acceder a recomendaciones con inteligencia artificial y conectar con servicios locales.
  </p>

  <div class="divider" style="height:1px;background:rgba(255,255,255,0.04);margin-bottom:24px;"></div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr><td class="list-border" style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
      <p class="text-sub" style="margin:0;font-family:${F};font-size:13px;color:rgba(255,255,255,0.28);">Hoteles, restaurantes y experiencias cerca de ti</p>
    </td></tr>
    <tr><td class="list-border" style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
      <p class="text-sub" style="margin:0;font-family:${F};font-size:13px;color:rgba(255,255,255,0.28);">Asistente de viaje con IA integrada</p>
    </td></tr>
    <tr><td style="padding:10px 0;">
      <p class="text-sub" style="margin:0;font-family:${F};font-size:13px;color:rgba(255,255,255,0.28);">Mapas en tiempo real y resenas verificadas</p>
    </td></tr>
  </table>

  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td align="center" width="100%">
    <a href="${APP()}" target="_blank" style="display:inline-block;background:#c9a227;color:#000;font-family:${F};font-size:14px;font-weight:700;padding:13px 36px;border-radius:8px;text-decoration:none;">
      Ir a VIANova
    </a>
  </td></tr></table>

  <p class="text-muted" style="margin:0;font-family:${F};font-size:11px;color:rgba(255,255,255,0.14);line-height:1.6;">
    Si no creaste esta cuenta, ignora este mensaje.
  </p>`;

  await getTransporter().sendMail({
    from: FROM(), to,
    subject: "Bienvenido a VIANova",
    html: shell(body),
    attachments: logoAttachment(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PASSWORD RESET — Only local accounts (blocked for Google in routes.ts)
// ═══════════════════════════════════════════════════════════════════════════════
export async function sendPasswordResetEmail(to: string, userName: string, resetToken: string): Promise<void> {
  const resetUrl = `${APP()}/login?reset_token=${resetToken}`;
  const name = userName || "usuario";

  const body = `
  <p class="text-sub" style="margin:0 0 4px;font-family:${F};font-size:11px;font-weight:600;color:rgba(201,162,39,0.7);text-transform:uppercase;letter-spacing:2px;">Recuperacion de cuenta</p>
  <h1 class="text-main" style="margin:0 0 14px;font-family:${F};font-size:22px;font-weight:700;color:#fff;line-height:1.3;">Hola, ${name}</h1>
  <p class="text-sub" style="margin:0 0 28px;font-family:${F};font-size:14px;color:rgba(255,255,255,0.38);line-height:1.8;">
    Ingresa este codigo en la aplicacion para restablecer tu contrasena:
  </p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr><td align="center" class="code-bg" style="padding:24px 0;background:rgba(201,162,39,0.04);border:1px solid rgba(201,162,39,0.08);border-radius:10px;">
      <p class="text-muted" style="margin:0 0 4px;font-family:${F};font-size:10px;font-weight:600;color:rgba(255,255,255,0.20);text-transform:uppercase;letter-spacing:3px;">Codigo</p>
      <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:40px;font-weight:900;color:#c9a227;letter-spacing:10px;">${resetToken}</p>
    </td></tr>
  </table>

  <p class="text-muted" style="margin:0 0 18px;font-family:${F};font-size:13px;color:rgba(255,255,255,0.22);text-align:center;">o accede directamente:</p>

  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td align="center" width="100%">
    <a href="${resetUrl}" target="_blank" style="display:inline-block;background:#c9a227;color:#000;font-family:${F};font-size:14px;font-weight:700;padding:13px 36px;border-radius:8px;text-decoration:none;">
      Restablecer contrasena
    </a>
  </td></tr></table>

  <p class="text-muted" style="margin:0;font-family:${F};font-size:11px;color:rgba(255,255,255,0.16);line-height:1.7;">
    Este codigo expira en 24 horas. Si no lo solicitaste, ignora este correo.
  </p>`;

  await getTransporter().sendMail({
    from: FROM(), to,
    subject: "Codigo de recuperacion - VIANova",
    html: shell(body),
    attachments: logoAttachment(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PASSWORD CHANGED — Only local accounts (notification + emergency reset)
// ═══════════════════════════════════════════════════════════════════════════════
export async function sendPasswordChangedEmail(to: string, userName: string, emergencyResetUrl: string): Promise<void> {
  const name = userName || "usuario";

  const body = `
  <p class="text-sub" style="margin:0 0 4px;font-family:${F};font-size:11px;font-weight:600;color:rgba(34,197,94,0.7);text-transform:uppercase;letter-spacing:2px;">Notificacion de seguridad</p>
  <h1 class="text-main" style="margin:0 0 14px;font-family:${F};font-size:22px;font-weight:700;color:#fff;line-height:1.3;">Contrasena actualizada</h1>
  <p class="text-sub" style="margin:0 0 24px;font-family:${F};font-size:14px;color:rgba(255,255,255,0.38);line-height:1.8;">
    Hola ${name}, la contrasena de tu cuenta ha sido modificada exitosamente. Ya puedes iniciar sesion con tu nueva contrasena.
  </p>

  <div class="divider" style="height:1px;background:rgba(255,255,255,0.04);margin-bottom:24px;"></div>

  <p style="margin:0 0 14px;font-family:${F};font-size:13px;font-weight:600;color:rgba(239,68,68,0.75);">Si no realizaste este cambio:</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td align="center" width="100%">
    <a href="${emergencyResetUrl}" target="_blank" style="display:inline-block;background:#dc2626;color:#fff;font-family:${F};font-size:13px;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;">
      Asegurar mi cuenta
    </a>
  </td></tr></table>

  <p class="text-muted" style="margin:0;font-family:${F};font-size:11px;color:rgba(255,255,255,0.16);line-height:1.7;">
    Si fuiste tu, ignora este correo. El enlace de seguridad expira en 24 horas.
  </p>`;

  await getTransporter().sendMail({
    from: FROM(), to,
    subject: "Contrasena actualizada - VIANova",
    html: shell(body),
    attachments: logoAttachment(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. GENERIC — For order notifications and custom alerts
// ═══════════════════════════════════════════════════════════════════════════════
export async function sendCustomEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  await getTransporter().sendMail({
    from: FROM(), to, subject,
    html: shell(html),
    attachments: logoAttachment(),
  });
}
