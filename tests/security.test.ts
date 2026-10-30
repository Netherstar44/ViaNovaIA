import assert from "node:assert/strict";
import crypto from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";

// Secrets de test: nunca usar valores de producción en este archivo.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-0123456789-abcdef";
process.env.SESSION_SECRET = "test-session-secret-0123456789-abcd";
process.env.PAYMENT_ENCRYPTION_KEY = "test-payment-key-0123456789-abcdef";

const { default: rateLimit } = await import("express-rate-limit");
const { registerRoutes } = await import("../server/routes/index.js");
const { csrfProtection, requireAuth, optionalAuth, requireRole, sanitizeUser, sanitizeProduct, validatePassword, validateAvatarUrl, validateBannerUrl, validateContactWebsite, isValidContactEmail, isValidContactPhone, isValidContactVisibility, normalizeContactVisibility, sanitizeProfileText, sanitizeProfileBio, encryptSensitive, decryptSensitive, maskPaymentDetails, sanitizePaymentMethod, escapeHtml, isOwnerOrAdmin, isNativeAuthClient, signToken } = await import("../server/security.js");
const { buildPasswordResetUrl } = await import("../server/mailer.js");
const { applyHttpSecurity } = await import("../server/http-security.js");
const { validateUpload, sniffMime } = await import("../server/upload-validation.js");
const { verifyGoogleIdToken, assertVerifiedGoogleProfile } = await import("../server/google-auth.js");

let appServer: Server;
let baseUrl = "";
let corsServer: Server;
let corsBase = "";

before(async () => {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  app.use(csrfProtection);
  // Inyección exclusiva del harness de tests: nunca existe en la app real.
  app.use((req: any, _res, next) => {
    const roles = req.get("x-test-roles");
    if (roles) req.userRoles = roles.split(",").map((role: string) => role.trim()).filter(Boolean);
    next();
  });
  await registerRoutes(app);
  app.use("/api", (_req, res) => res.status(404).json({ message: "Endpoint no encontrado" }));
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err?.status || 500;
    res.status(status).json({ message: status >= 500 ? `Error de test: ${err?.message || err}` : err.message });
  });

  appServer = app.listen(0, "127.0.0.1");
  await once(appServer, "listening");
  const address = appServer.address();
  if (!address || typeof address === "string") throw new Error("No se pudo iniciar el servidor de test");
  baseUrl = `http://127.0.0.1:${address.port}`;

  const corsApp = express();
  applyHttpSecurity(corsApp);
  corsApp.get("/ping", (_req, res) => res.json({ ok: true }));
  corsServer = corsApp.listen(0, "127.0.0.1");
  await once(corsServer, "listening");
  const corsAddress = corsServer.address();
  if (!corsAddress || typeof corsAddress === "string") throw new Error("No se pudo iniciar CORS test");
  corsBase = `http://127.0.0.1:${corsAddress.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => appServer.close(() => resolve()));
  await new Promise<void>((resolve) => corsServer.close(() => resolve()));
});

function authHeader(username = "alice", role = "traveler") {
  const token = signToken({ id: `id-${username}`, username, role });
  return { Authorization: `Bearer ${token}` };
}

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, init);
}

test("sanitizeUser excluye secretos y campos internos", () => {
  const result = sanitizeUser({
    id: "u1",
    username: "alice",
    name: "Alice",
    email: "alice@example.com",
    role: "traveler",
    password: "hash",
    verificationToken: "123456",
    failedLoginAttempts: 9,
    lockUntil: new Date(),
    twoFactorEnabled: "true",
    deletedAt: new Date(),
    preferences: { secret: true },
    bannerUrl: "https://res.cloudinary.com/demo/banner.png",
    contactEmail: "contacto@example.com",
    contactVisibility: "followers",
  }) as any;
  assert.equal(result.username, "alice");
  assert.equal(result.email, "alice@example.com");
  assert.equal(result.bannerUrl, "https://res.cloudinary.com/demo/banner.png");
  assert.equal(result.contactEmail, "contacto@example.com");
  assert.equal(result.contactVisibility, "followers");
  for (const forbidden of ["password", "verificationToken", "failedLoginAttempts", "lockUntil", "twoFactorEnabled", "deletedAt", "preferences"]) {
    assert.equal(forbidden in result, false, `no debe filtrar ${forbidden}`);
  }
});

test("sanitizeProduct no expone cost ni provider_id a terceros", () => {
  const product = { id: "p1", name: "Hotel", price: 100, cost: 40, provider_id: "internal-id" };
  assert.equal((sanitizeProduct(product) as any).cost, undefined);
  assert.equal((sanitizeProduct(product) as any).provider_id, undefined);
  assert.equal((sanitizeProduct(product, true) as any).cost, 40);
});

test("contraseñas débiles y comunes son rechazadas", () => {
  assert.equal(validatePassword("short1").ok, false);
  assert.equal(validatePassword("password").ok, false);
  assert.equal(validatePassword("alice1234", "alice").ok, false);
  assert.equal(validatePassword("SOLO-LETRAS").ok, false);
  assert.equal(validatePassword("ViaNova-Segura-2026").ok, true);
});

test("avatar y banner solo aceptan HTTPS de proveedores aprobados", () => {
  assert.throws(() => validateAvatarUrl("javascript:alert(1)"));
  assert.throws(() => validateAvatarUrl("data:text/html,<script>alert(1)</script>"));
  assert.throws(() => validateAvatarUrl("http://res.cloudinary.com/a.png"));
  assert.throws(() => validateAvatarUrl("https://cdn.example.com/a.png"));
  assert.throws(() => validateAvatarUrl("https://user:pass@res.cloudinary.com/a.png"));
  assert.throws(() => validateAvatarUrl("https://res.cloudinary.com:8443/a.png"));
  assert.throws(() => validateAvatarUrl("https://127.0.0.1/a.png"));
  assert.equal(validateAvatarUrl("https://res.cloudinary.com/demo/image/upload/a.png"), "https://res.cloudinary.com/demo/image/upload/a.png");
  assert.equal(validateBannerUrl("https://lh3.googleusercontent.com/a/banner.png"), "https://lh3.googleusercontent.com/a/banner.png");
});

test("contacto: URL, email, teléfono y visibilidad se validan en servidor", () => {
  assert.equal(validateContactWebsite("https://example.com/contacto#equipo"), "https://example.com/contacto");
  assert.throws(() => validateContactWebsite("http://example.com"));
  assert.throws(() => validateContactWebsite("ftp://example.com"));
  assert.throws(() => validateContactWebsite("https://user:pass@example.com"));
  assert.throws(() => validateContactWebsite("https://localhost:443/"));
  assert.throws(() => validateContactWebsite("https://10.0.0.5/"));
  assert.throws(() => validateContactWebsite("https://169.254.169.254/latest/meta-data"));

  assert.equal(isValidContactEmail("contacto@ejemplo.com"), true);
  assert.equal(isValidContactEmail("sin-arroba.example.com"), false);
  assert.equal(isValidContactEmail("a@b"), false);

  assert.equal(isValidContactPhone("+57 300 123 4567"), true);
  assert.equal(isValidContactPhone("3001234567"), true);
  assert.equal(isValidContactPhone("123"), false);
  assert.equal(isValidContactPhone("+57 300 123 4567 8901 2345"), false);
  assert.equal(isValidContactPhone("abc1234567"), false);

  assert.equal(isValidContactVisibility("public"), true);
  assert.equal(isValidContactVisibility("PUBLIC"), true);
  assert.equal(isValidContactVisibility("amigos"), false);
  assert.equal(normalizeContactVisibility("amigos"), "private");
  assert.equal(normalizeContactVisibility(undefined), "private");
  assert.equal(normalizeContactVisibility("followers"), "followers");
});

test("texto de perfil elimina HTML y caracteres de control", () => {
  assert.equal(sanitizeProfileText("<b>Ana</b>\u0000  <script>alert(1)</script>", 40), "Ana alert(1)");
  assert.equal(sanitizeProfileBio("Hola\r\n<script>alert(1)</script>\nMundo", 100), "Hola\nalert(1)\nMundo");
  assert.equal(sanitizeProfileBio("x".repeat(600)).length, 500);
});

test("cifrado de pagos: roundtrip, no determinista y detección de manipulación", () => {
  const first = encryptSensitive("4111 1111 1111 1234");
  const second = encryptSensitive("4111 1111 1111 1234");
  assert.ok(first?.startsWith("enc:v1:"));
  assert.notEqual(first, second);
  assert.equal(decryptSensitive(first), "4111 1111 1111 1234");
  assert.equal(maskPaymentDetails(first), "****1234");
  const parts = first!.split(":");
  const flippedTag = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
  const tampered = [parts[0], parts[1], parts[2], flippedTag, parts[4]].join(":");
  assert.notEqual(tampered, first);
  assert.equal(decryptSensitive(tampered), null);
});

test("métodos de pago nunca devuelven details completos", () => {
  const encrypted = encryptSensitive("Nequi 3001234567");
  const result = sanitizePaymentMethod({ id: "m1", label: "Nequi", details: encrypted });
  assert.equal(result.details, "****4567");
  assert.equal(result.hasDetails, true);
  assert.equal(JSON.stringify(result).includes("3001234567"), false);
});

test("upload rechaza archivo disfrazado, extensión/MIME incorrectos y exceso de tamaño", () => {
  const htmlRenamedPng = Buffer.from("<html><script>alert(1)</script></html>");
  assert.equal(sniffMime(htmlRenamedPng), null);
  assert.equal(validateUpload({ buffer: htmlRenamedPng, mimetype: "image/png", originalname: "x.png" }).ok, false);

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal(validateUpload({ buffer: png, mimetype: "image/png", originalname: "x.jpg" }).ok, false);
  assert.equal(validateUpload({ buffer: png, mimetype: "application/octet-stream", originalname: "x.png" }).ok, false);
  assert.equal(validateUpload({ buffer: png, mimetype: "image/png", originalname: "x.png", maxImageBytes: 5 }).ok, false);
  assert.equal(validateUpload({ buffer: png, mimetype: "image/png", originalname: "x.png" }).ok, true);
});

test("ownership: otro usuario no puede operar; dueño y admin sí", () => {
  assert.equal(isOwnerOrAdmin({ id: "1", username: "alice", role: "traveler" }, "bob"), false);
  assert.equal(isOwnerOrAdmin({ id: "1", username: "alice", role: "traveler" }, "alice"), true);
  assert.equal(isOwnerOrAdmin({ id: "1", username: "alice", role: "admin" }, "bob"), true);
  assert.equal(isOwnerOrAdmin(undefined, "alice"), false);
});

test("respuestas de reset usan fragmento y no query string", () => {
  const previous = process.env.PUBLIC_URL;
  process.env.PUBLIC_URL = "https://vianova.example";
  try {
    const url = buildPasswordResetUrl("abc123");
    assert.equal(url.startsWith("https://vianova.example/login#reset_token="), true);
    assert.equal(new URL(url).search, "");
    assert.equal(new URL(url).hash.includes("abc123"), true);
    assert.equal(escapeHtml("<img onerror=alert(1)>&"), "&lt;img onerror=alert(1)&gt;&amp;");
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_URL;
    else process.env.PUBLIC_URL = previous;
  }
});

test("solo clientes nativos reciben el token en JSON", () => {
  assert.equal(isNativeAuthClient({ headers: {} } as any), false);
  assert.equal(isNativeAuthClient({ headers: { "x-client-platform": "capacitor" } } as any), true);
  assert.equal(isNativeAuthClient({ headers: { origin: "https://localhost" } } as any), true);
  assert.equal(isNativeAuthClient({ headers: { origin: "https://evil.example" } } as any), false);
});

test("CSRF: origen malicioso, cookie sin origen y bearer con origen ajeno fallan", async () => {
  const evil = await request("/api/auth/logout", {
    method: "POST",
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(evil.status, 403);

  const cookieNoOrigin = await request("/api/auth/logout", {
    method: "POST",
    headers: { Cookie: `token=${signToken({ id: "id-alice", username: "alice" })}` },
  });
  assert.equal(cookieNoOrigin.status, 403);

  const bearerEvil = await request("/api/auth/logout", {
    method: "POST",
    headers: { ...authHeader(), Origin: "https://evil.example" },
  });
  assert.equal(bearerEvil.status, 403);

  const allowed = await request("/api/auth/logout", {
    method: "POST",
    headers: { Origin: "http://localhost:5000" },
  });
  assert.equal(allowed.status, 200);
});

test("CORS: evil no recibe ACAO; origen permitido sí; headers de seguridad presentes", async () => {
  const evil = await fetch(`${corsBase}/ping`, { headers: { Origin: "https://evil.example" } });
  assert.equal(evil.status, 200);
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
  assert.equal(evil.headers.get("x-frame-options"), "DENY");
  assert.match(evil.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);

  const allowed = await fetch(`${corsBase}/ping`, { headers: { Origin: "http://localhost:5000" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5000");
  assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
});

test("requireAuth rechaza sin token, token manipulado y token firmado con otro secreto", async () => {
  const anonymous = await request("/api/admin/stats");
  assert.equal(anonymous.status, 401);

  const wrongSecret = jwt.sign({ id: "x", username: "alice", role: "admin" }, "wrong-secret");
  const malformed = await request("/api/admin/stats", { headers: { Authorization: `Bearer ${wrongSecret}` } });
  assert.equal(malformed.status, 401);

  const invalid = await request("/api/admin/stats", { headers: { Authorization: "Bearer not-a-jwt" } });
  assert.equal(invalid.status, 401);
});

test("matriz RBAC: viajero 403 y admin no recibe 401/403", async () => {
  const traveler = await request("/api/admin/stats", {
    headers: { ...authHeader("alice", "traveler"), "x-test-roles": "traveler" },
  });
  assert.equal(traveler.status, 403);

  const admin = await request("/api/admin/stats", {
    headers: { ...authHeader("root", "admin"), "x-test-roles": "admin" },
  });
  // El endpoint puede fallar por falta de DB en tests, pero nunca por permisos.
  assert.notEqual(admin.status, 401);
  assert.notEqual(admin.status, 403);
});

test("optionalAuth ignora tokens inválidos y acepta tokens válidos", async () => {
  const invalidReq: any = { headers: { authorization: "Bearer invalid" }, cookies: {} };
  let called = 0;
  await optionalAuth(invalidReq, {} as any, () => { called += 1; });
  assert.equal(called, 1);
  assert.equal(invalidReq.user, undefined);

  const validReq: any = { headers: { authorization: `Bearer ${signToken({ id: "id-alice", username: "alice" })}` }, cookies: {} };
  let nextCalled = false;
  await optionalAuth(validReq, {} as any, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(validReq.user.username, "alice");
});

test("requireRole no concede permisos a roles ajenos", async () => {
  const req: any = { user: { id: "1", username: "alice", role: "traveler" }, userRoles: ["traveler"] };
  let status = 0;
  const res: any = { status(code: number) { status = code; return this; }, json() { return this; } };
  await requireRole("admin")(req, res, () => { throw new Error("no debe entrar"); });
  assert.equal(status, 403);
});

test("endpoints legacy destructivos responden 404 JSON", async () => {
  for (const path of ["/api/nuke-local232", "/api/seed-60", "/api/migrate"]) {
    const response = await request(path, { method: "POST" });
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") || "", /application\/json/);
  }
  const createUser = await request("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "x" }) });
  assert.equal(createUser.status, 404);
});

test("registro y login validan antes de tocar la base de datos", async () => {
  const weak = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "nuevo", email: "nuevo@example.com", password: "password", name: "Nuevo", acceptTerms: true }),
  });
  const weakBody = await weak.text();
  assert.equal(weak.status, 400, weakBody);

  const arrays = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ["alice"], password: ["x"] }),
  });
  assert.equal(arrays.status, 400);
});

test("rate limit de login bloquea fuerza bruta por cuenta/IP", async () => {
  const username = `brute_${crypto.randomUUID()}`;
  let saw429 = false;
  for (let i = 0; i < 12; i += 1) {
    const response = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (response.status === 429) saw429 = true;
  }
  assert.equal(saw429, true);
});

test("Google: firma RS256/JWKS válida, audiencia/email no confiables fallan", async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk: any = publicKey.export({ format: "jwk" });
  jwk.kid = "test-kid";
  jwk.alg = "RS256";
  jwk.use = "sig";
  const signGoogle = (payload: Record<string, unknown>, options: jwt.SignOptions = {}) =>
    jwt.sign(payload, privateKey, {
      algorithm: "RS256",
      keyid: "test-kid",
      expiresIn: "5m",
      ...options,
    });

  const valid = signGoogle({
    sub: "google-1",
    email: "alice@example.com",
    email_verified: true,
    aud: "client-1",
    iss: "https://accounts.google.com",
    name: "Alice",
  });
  const payload = await verifyGoogleIdToken(valid, {
    allowedClientIds: ["client-1"],
    fetchJwks: async () => [jwk],
  });
  assert.equal(payload.email, "alice@example.com");

  const wrongAudience = signGoogle({ sub: "1", email: "a@example.com", email_verified: true, aud: "other-client", iss: "https://accounts.google.com" });
  await assert.rejects(
    verifyGoogleIdToken(wrongAudience, { allowedClientIds: ["client-1"], fetchJwks: async () => [jwk] }),
    /audience|jwt/i,
  );

  const unverified = signGoogle({ sub: "1", email: "a@example.com", email_verified: false, aud: "client-1", iss: "https://accounts.google.com" });
  await assert.rejects(
    verifyGoogleIdToken(unverified, { allowedClientIds: ["client-1"], fetchJwks: async () => [jwk] }),
    /verificado/i,
  );

  const hs256 = jwt.sign({ email: "a@example.com" }, "secret", { algorithm: "HS256", keyid: "test-kid" });
  await assert.rejects(
    verifyGoogleIdToken(hs256, { allowedClientIds: ["client-1"], fetchJwks: async () => [jwk] }),
    /Cabecera|token/i,
  );

  assert.throws(() => assertVerifiedGoogleProfile({ email: "a@example.com", email_verified: false }), /verificado/i);
});

test("el rate limiter de TTS no existe en Node (se prueba en Python)", () => {
  // Marcador explícito: api/tts.py tiene su propia suite en tests/test_tts.py.
  assert.equal(typeof rateLimit, "function");
});
