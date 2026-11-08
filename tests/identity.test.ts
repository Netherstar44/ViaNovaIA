import assert from "node:assert/strict";
import { test } from "node:test";
import { IdentityService } from "../server/identity/service.js";
import { FACE_MODEL, isCurrent, type FaceEngine, type FaceSample } from "../server/identity/policy.js";
import type { IdentityRecord, IdentityAudit, IdentityStore } from "../server/identity/store.js";
import { seal, unseal } from "../server/identity/crypto.js";
process.env.FACE_DISTANCE_THRESHOLD = "0.4";
process.env.FACE_CALIBRATION_ID = "SYNTHETIC-UNIT-TEST-ONLY";
process.env.BIOMETRIC_ENCRYPTION_KEY = "ab".repeat(32);
function harness() {
  let now = 1_800_000_000_000;
  const records = new Map<string, IdentityRecord>(), audit: IdentityAudit[] = [];
  const store: IdentityStore = {
    async get(s) { return structuredClone(records.get(s) ?? { revision: 0 }); },
    async save(s, r, a) { assert.equal(records.get(s)?.revision ?? 0, r.revision); records.set(s, structuredClone({ ...r, revision: r.revision + 1 })); audit.push(a); },
  };
  const engine: FaceEngine = { model: FACE_MODEL, async analyze(bytes) {
    const yaw = bytes[0] === 1 ? -0.3 : bytes[0] === 2 ? 0.3 : 0;
    return { descriptor: Array(128).fill(bytes[0] === 3 ? 1 : 0), yaw, roll: 0, light: 120, facePixels: 180, sharpness: 100 } satisfies FaceSample;
  } };
  const service = new IdentityService(engine, store, () => now);
  const tick = (ms = 500) => { now += ms; };
  const complete = async (purpose: "enroll" | "verify") => {
    let step: any = await service.challenge("driver", purpose);
    while (!step.done) { tick(); step = await service.frame("driver", step.id, Buffer.from([step.action === "left" ? 1 : step.action === "right" ? 2 : 0])); }
  };
  return { records, audit, store, service, tick, complete };
}
test("flujo de política: enrolar → aprobación documental → verificar → identidad pública mínima", async () => {
  const h = harness(); await h.service.consent("driver"); await h.complete("enroll");
  assert.equal((await h.service.public("driver")).verified, false);
  await h.service.approve("driver", "admin", "Persona de prueba", "test-reference", "face");
  await h.complete("verify"); const visible = await h.service.public("driver");
  assert.equal(visible.name, "Persona de prueba"); assert.equal(visible.verified, true);
  assert.equal((await h.service.public("driver", true)).name, "Persona");
  assert.ok(!JSON.stringify(visible).includes("descriptor"));
});
test("otra persona es rechazada por distancia (motor simulado; no es un FAR real)", async () => {
  const h = harness(); await h.service.consent("driver"); await h.complete("enroll");
  await h.service.approve("driver", "admin", "Persona de prueba", "test-reference", "face");
  const c = await h.service.challenge("driver", "verify"); h.tick();
  await assert.rejects(h.service.frame("driver", c.id, Buffer.from([3])), /confirmar tu identidad/);
  assert.equal((await h.service.public("driver")).verified, false);
});
test("foto estática simple no supera el giro aleatorio", async () => {
  const h = harness(); await h.service.consent("driver"); let c: any = await h.service.challenge("driver", "enroll");
  h.tick(); c = await h.service.frame("driver", c.id, Buffer.from([0])); h.tick();
  await assert.rejects(h.service.frame("driver", c.id, Buffer.from([0])), /movimiento/);
  assert.equal(h.records.get("driver")?.template, undefined);
});
test("verificación vencida bloquea la política de disponibilidad", async () => {
  const h = harness(); await h.service.manual("driver"); await h.service.approve("driver", "admin", "Persona de prueba", "test-reference", "manual");
  assert.equal(isCurrent((await h.store.get("driver")), 1_800_000_000_000), true);
  h.tick(121 * 60_000); assert.equal((await h.service.public("driver")).verified, false);
});
test("revocar consentimiento elimina plantilla y reto e invalida el turno", async () => {
  const h = harness(); await h.service.consent("driver"); await h.complete("enroll"); await h.service.revoke("driver");
  const r = await h.store.get("driver"); assert.equal(r.template, undefined); assert.equal(r.challenge, undefined); assert.equal(r.consentAt, undefined);
  assert.equal((await h.service.public("driver")).verified, false);
  await assert.rejects(h.service.challenge("driver", "enroll"), /Autoriza/);
});
test("los retos son de un solo uso, caducan y abandonar cuenta como intento", async () => {
  const h = harness(); await h.service.consent("driver"); const first = await h.service.challenge("driver", "enroll");
  h.tick(); await h.service.frame("driver", first.id, Buffer.from([0])); h.tick();
  await assert.rejects(h.service.frame("driver", first.id, Buffer.from([0])), /utilizado/);
  for (let i = 0; i < 4; i++) await h.service.challenge("driver", "enroll");
  await assert.rejects(h.service.challenge("driver", "enroll"), /Demasiados/);
});
test("AES-GCM rechaza alteración y cambio de dueño", () => {
  const cipher = seal({ template: Array(128).fill(0.1) }, "driver");
  assert.equal(cipher.includes("template"), false); assert.equal(unseal<any>(cipher, "driver").template.length, 128);
  assert.throws(() => unseal(cipher, "other"));
  const parts = cipher.split('.'); parts[2] = Buffer.from('tampered').toString('base64');
  assert.throws(() => unseal(parts.join('.'), 'driver'));
});
test("retención de 30 días suprime plantillas al leer y el historial no contiene vectores", async () => {
  const h = harness(); await h.service.consent("driver"); await h.complete("enroll"); h.tick(31 * 86400_000);
  await h.service.read("driver"); assert.equal(h.records.get("driver")?.template, undefined);
  assert.equal(JSON.stringify(h.audit).includes("descriptor"), false);
});
test("motor real: carga modelos locales y rechaza JPEG sintético sin rostro", async () => {
  const { VladFaceEngine } = await import("../server/identity/face-engine.js");
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(640, 480); canvas.getContext("2d").fillRect(0, 0, 640, 480);
  const image = canvas.toBuffer("image/jpeg");
  await assert.rejects(new VladFaceEngine().analyze(image, false), process.versions.node.startsWith("22.") ? /un solo rostro/ : /Node 22/);
  image.fill(0); canvas.width = canvas.height = 1;
});
