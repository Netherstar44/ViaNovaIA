import "dotenv/config";
import nodemailer from "nodemailer";

const F = `'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`;
const logoUrl = "https://res.cloudinary.com/dgcefqq1y/image/upload/v1775712447/vianova/logo.jpg";

// Build a simple test email with the logo as CID attachment instead of URL
async function main() {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#050509;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050509;">
<tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="height:3px;background:linear-gradient(90deg,#c9a227,#e8c547,#c9a227);border-radius:12px 12px 0 0;"></td></tr>
<tr><td style="background:#0a0a12;padding:44px 40px 36px;border:1px solid rgba(255,255,255,0.03);border-top:none;border-radius:0 0 12px 12px;">
<table cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr>
<td style="padding-right:14px;vertical-align:middle;"><img src="${logoUrl}" alt="VIANova" width="40" height="40" style="display:block;border-radius:8px;border:0;outline:none;" /></td>
<td style="vertical-align:middle;"><span style="font-family:${F};font-size:20px;font-weight:800;color:#c9a227;">VIA</span><span style="font-family:${F};font-size:20px;font-weight:800;color:#e0e0e0;">Nova</span></td>
</tr></table>
<h1 style="font-family:${F};font-size:22px;color:#fff;">Test - Logo should appear above</h1>
<p style="font-family:${F};font-size:14px;color:rgba(255,255,255,0.4);">Direct URL: ${logoUrl}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  console.log("Sending test email...");
  console.log("Logo URL:", logoUrl);
  
  const info = await transporter.sendMail({
    from: `VIANova <${process.env.SMTP_USER}>`,
    to: process.env.SMTP_USER!, // Send to ourselves
    subject: "TEST - Logo check",
    html,
  });

  console.log("Sent!", info.messageId);
}

main().catch(e => { console.error(e); process.exit(1); });
