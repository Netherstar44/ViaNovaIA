import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import jwt from "jsonwebtoken";
import { IdentityService } from "../server/identity/service.js";
import { FACE_MODEL, type FaceEngine } from "../server/identity/policy.js";
import { registerIdentityRoutes, requireCurrentIdentity } from "../server/identity/routes.js";
import { requireAuth } from "../server/security.js";
import type { IdentityRecord, IdentityStore } from "../server/identity/store.js";
import { CONSENT_VERSION } from "../shared/identity.js";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "identity-http-test-secret-never-production-000";
process.env.SESSION_SECRET = "identity-http-test-session-never-production-000";
process.env.FACE_DISTANCE_THRESHOLD = "0.4";
process.env.FACE_CALIBRATION_ID = "synthetic-http-policy-only";
process.env.FACE_CALIBRATION_APPROVED = "false";
test("HTTP: sesión, propiedad, rechazo de descriptores, vencimiento y supresión", async () => {
  let now = 1_800_000_000_000;
  const records = new Map<string, IdentityRecord>();
  const store: IdentityStore = {
    async get(s) { return structuredClone(records.get(s) ?? { revision: 0 }); },
    async save(s, r) { if (r.revision !== (records.get(s)?.revision ?? 0)) throw Object.assign(new Error('conflict'), {status:409}); records.set(s, structuredClone({ ...r, revision: r.revision + 1 })); },
  };
  let engineCalls = 0;
  const service = new IdentityService({ model: FACE_MODEL, async analyze() { engineCalls++; throw new Error("This test never accepts client descriptors"); } }, store, () => now);
  const app = express(); app.use(express.json({ limit: '512kb' }));
  // Harness-only role lookup; no test headers or role overrides in production.
  app.use((req: any, _res, next) => { req.userRoles = ['taxi']; next(); });
  registerIdentityRoutes(app, service);
  app.get('/receive', requireAuth, requireCurrentIdentity(service), (_req, res) => res.json({ received: true }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('listen');
  const base = `http://127.0.0.1:${address.port}`;
  const token = (username: string) => jwt.sign({ id: username, username, role: 'taxi' }, process.env.JWT_SECRET!);
  const request = (url: string, method = 'GET', body?: unknown, username = 'driver') => fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(username)}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await fetch(base + '/api/identity/me')).status, 401);
    delete process.env.BIOMETRIC_ENCRYPTION_KEY;
    const unavailable = await (await request('/api/identity/me')).json();
    assert.equal(unavailable.faceReady, false); assert.equal(unavailable.manualReady, false);
    process.env.BIOMETRIC_ENCRYPTION_KEY = 'cd'.repeat(32);
    const configured = await (await request('/api/identity/me')).json();
    assert.equal(configured.faceReady, false); assert.equal(configured.manualReady, true);
    process.env.FACE_CALIBRATION_APPROVED = 'true';
    const calibrated = await (await request('/api/identity/me')).json();
    assert.equal(calibrated.faceReady, true); assert.equal(calibrated.manualReady, true);
    assert.equal((await request('/api/identity/consent', 'POST', { version: CONSENT_VERSION, accepted: true, username: 'victim' })).status, 400);
    assert.equal((await request('/api/identity/consent', 'POST', { version: CONSENT_VERSION, accepted: true })).status, 200);
    assert.equal((await request('/api/identity/frame', 'POST', { id: crypto.randomUUID(), match: true, descriptor: Array(128).fill(0) })).status, 400);
    assert.equal(engineCalls, 0); assert.equal(records.has('victim'), false);
    assert.equal((await request('/api/identity/admin/victim/approve', 'POST', {})).status, 403);
    await service.manual('driver'); await service.approve('driver', 'admin', 'Persona de prueba', 'test-ref', 'manual');
    assert.equal((await request('/receive')).status, 200);
    now += 121 * 60_000; assert.equal((await request('/receive')).status, 403);
    records.get('driver')!.template = Array(128).fill(0.2);
    assert.equal((await request('/api/identity/consent', 'DELETE')).status, 200);
    assert.equal(records.get('driver')?.template, undefined);
    assert.equal((await request('/receive')).status, 403);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});

test("HTTP: acceso facial público emite sesión o reto 2FA y no enumera cuentas", async () => {
  process.env.NODE_ENV = "test";
  process.env.FACE_DEV_MODE = "true";
  process.env.FACE_CALIBRATION_APPROVED = "false";
  process.env.FACE_DISTANCE_THRESHOLD = "0.4";
  process.env.FACE_CALIBRATION_ID = "local-dev-unapproved";
  process.env.BIOMETRIC_ENCRYPTION_KEY = "ef".repeat(32);
  let now = 1_800_000_000_000;
  const records = new Map<string, IdentityRecord>();
  const store: IdentityStore = {
    async get(s) { return structuredClone(records.get(s) ?? { revision: 0 }); },
    async save(s, r) { if (r.revision !== (records.get(s)?.revision ?? 0)) throw Object.assign(new Error("conflict"), { status: 409 }); records.set(s, structuredClone({ ...r, revision: r.revision + 1 })); },
  };
  const engine: FaceEngine = {
    model: FACE_MODEL,
    async analyze(bytes) {
      const yaw = bytes[0] === 1 ? -0.3 : bytes[0] === 2 ? 0.3 : 0;
      return { descriptor: Array(128).fill(bytes[0] === 3 ? 1 : 0), yaw, roll: 0, light: 120, facePixels: 180, sharpness: 100 };
    },
  };
  const service = new IdentityService(engine, store, () => now);
  await service.consent("driver");
  let enroll: any = await service.challenge("driver", "enroll");
  while (!enroll.done) {
    now += 500;
    enroll = await service.frame("driver", enroll.id, Buffer.from([enroll.action === "left" ? 1 : enroll.action === "right" ? 2 : 0]));
  }

  const users: Record<string, any> = {
    driver: { id: "u1", username: "driver", email: "driver@example.test", deletedAt: null, lockUntil: null, twoFactorEnabled: null },
  };
  let twoFactorStarted = false;
  const app = express();
  app.use(express.json({ limit: "512kb" }));
  registerIdentityRoutes(app, service, undefined, {
    async findUser(identifier) { return users[identifier] ?? null; },
    async resetLock() {},
    async beginTwoFactor(user) { twoFactorStarted = true; return { requires2FA: true, username: user.username, message: "Código enviado." }; },
    issueSession(_req, res, user) { res.json({ done: true, user: { username: user.username, role: "traveler" }, token: "native-token" }); },
  });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); if (!address || typeof address === "string") throw new Error("listen");
  const base = `http://127.0.0.1:${address.port}`;
  const post = (url: string, body: unknown) => fetch(base + url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  // El esquema exige base64 de al menos 16 caracteres. Un búfer de 20 bytes
  // produce 28; el motor simulado solo mira el primer byte.
  const jpeg = (marker: number) => Buffer.alloc(20, marker).toString("base64");
  const frameBody = (step: any, marker = step.action === "left" ? 1 : step.action === "right" ? 2 : 0) => ({
    identifier: "driver",
    id: step.id,
    jpeg: jpeg(marker),
  });
  /** Falla rápido si el servidor responde 4xx/5xx en vez de girar sin fin. */
  const stepJson = async (response: Response) => {
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    return body;
  };
  const runChallenge = async (): Promise<any> => {
    let step: any = await stepJson(await post("/api/identity/login/challenge", { identifier: "driver" }));
    while (step && !step.done && !step.user && !step.requires2FA) {
      now += 500;
      step = await stepJson(await post("/api/identity/login/frame", frameBody(step)));
    }
    return step;
  };
  try {
    const unknown = await post("/api/identity/login/challenge", { identifier: "nadie" });
    assert.equal(unknown.status, 401);
    assert.deepEqual(await unknown.json(), { message: "No pudimos iniciar sesión con tu rostro." });

    const step = await runChallenge();
    assert.equal(step.user.username, "driver");
    assert.equal(step.token, "native-token");
    assert.equal(twoFactorStarted, false);

    users.driver.twoFactorEnabled = "true";
    const second = await runChallenge();
    assert.equal(second.requires2FA, true);
    assert.equal(second.username, "driver");
    assert.equal(twoFactorStarted, true);

    users.driver.twoFactorEnabled = null;
    const reto = await stepJson(await post("/api/identity/login/challenge", { identifier: "driver" }));
    now += 500;
    const rejected = await post("/api/identity/login/frame", frameBody(reto, 3));
    assert.equal(rejected.status, 401);
    assert.deepEqual(await rejected.json(), { message: "No pudimos iniciar sesión con tu rostro." });
    assert.equal(records.get("driver")?.loginChallenge, undefined);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
});
