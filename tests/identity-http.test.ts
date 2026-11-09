import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import jwt from "jsonwebtoken";
import { IdentityService } from "../server/identity/service.js";
import { FACE_MODEL } from "../server/identity/policy.js";
import { registerIdentityRoutes, requireCurrentIdentity } from "../server/identity/routes.js";
import { requireAuth } from "../server/security.js";
import type { IdentityRecord, IdentityStore } from "../server/identity/store.js";
import { CONSENT_VERSION } from "../shared/identity.js";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "identity-http-test-secret-never-production-000";
process.env.SESSION_SECRET = "identity-http-test-session-never-production-000";
process.env.FACE_DISTANCE_THRESHOLD = "0.4";
process.env.FACE_CALIBRATION_ID = "synthetic-http-policy-only";
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
    assert.equal(configured.faceReady, true); assert.equal(configured.manualReady, true);
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
