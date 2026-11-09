import assert from "node:assert/strict";
import { test } from "node:test";
import { IdentityService } from "../server/identity/service.js";
import { FACE_MODEL } from "../server/identity/policy.js";
import type { IdentityRecord, IdentityStore } from "../server/identity/store.js";
import { PILOT_CONSENT_VERSION } from "../shared/identity.js";

process.env.NODE_ENV = "test";

// Dos personas sintéticas: la distancia entre ambas supera el umbral 0.55.
const SAME = Array.from({ length: 128 }, (_, index) => (index === 0 ? 0.9 : 0.01));
const OTHER = Array.from({ length: 128 }, (_, index) => (index === 0 ? -0.9 : 0.01));

function harness() {
  let now = 1_800_000_000_000;
  const records = new Map<string, IdentityRecord>();
  const store: IdentityStore = {
    async get(subject) {
      return structuredClone(records.get(subject) ?? { revision: 0 });
    },
    async save(subject, record) {
      if (record.revision !== (records.get(subject)?.revision ?? 0)) {
        throw Object.assign(new Error("conflict"), { status: 409 });
      }
      records.set(subject, structuredClone({ ...record, revision: record.revision + 1 }));
    },
  };
  const engine = {
    model: FACE_MODEL,
    available: true,
    async analyze(image: Buffer) {
      return {
        descriptor: image[0] === 2 ? OTHER : SAME,
        yaw: image[1] === 1 ? -0.4 : image[1] === 2 ? 0.4 : 0,
        roll: 0,
        pitch: 0,
        facePixels: 200,
        light: 150,
        sharpness: 90,
      };
    },
  };
  const service = new IdentityService(engine, store, () => now);
  return { service, records, advance: (ms: number) => { now += ms; } };
}

function frameFor(action: string, person: 1 | 2 = 1): Buffer {
  const yaw = action === "left" ? 1 : action === "right" ? 2 : 0;
  return Buffer.from([person, yaw]);
}

async function enroll(service: IdentityService, advance: (ms: number) => void, person: 1 | 2 = 1) {
  let step: any = await service.pilotChallenge("ana", "enroll");
  for (let index = 0; index < 5; index++) {
    advance(500);
    const result: any = await service.pilotFrame("ana", step.id, frameFor(step.action, person));
    assert.equal(result.result, "passed");
    if (result.done) return result;
    step = result;
  }
  throw new Error("El reto de enrolamiento no terminó");
}

test("el piloto enrola y compara en el servidor sin validar la identidad", async () => {
  const { service, records, advance } = harness();
  await service.pilotConsent("ana", PILOT_CONSENT_VERSION);
  const result = await enroll(service, advance);

  assert.equal((result as any).done, true);
  assert.equal((result as any).experimental, true);
  assert.equal((result as any).result, "passed");
  assert.equal(typeof (result as any).distance, "number");
  assert.equal((result as any).quality.facePixels, 200);
  assert.ok(Array.isArray(records.get("ana")?.pilotTemplate));

  // El piloto nunca concede identidad verificada ni sesión.
  assert.equal((await service.public("ana")).verified, false);
  const status = await service.pilotStatus("ana");
  assert.equal(status.consent, true);
  assert.equal(status.enrolled, true);
});

test("el piloto rechaza a otra persona y conserva la muestra original", async () => {
  const { service, advance } = harness();
  await service.pilotConsent("ana", PILOT_CONSENT_VERSION);
  await enroll(service, advance, 1);

  const challenge: any = await service.pilotChallenge("ana", "verify");
  advance(500);
  const rejected: any = await service.pilotFrame("ana", challenge.id, frameFor(challenge.action, 2));

  assert.equal(rejected.rejected, true);
  assert.equal(rejected.result, "rejected");
  assert.equal((await service.public("ana")).verified, false);
  assert.equal((await service.pilotStatus("ana")).enrolled, true);
});

test("el piloto exige consentimiento específico y la revocación elimina la muestra", async () => {
  const { service, records, advance } = harness();

  await assert.rejects(
    () => service.pilotChallenge("ana", "enroll"),
    (error: any) => error.status === 403,
  );

  await service.pilotConsent("ana", PILOT_CONSENT_VERSION);
  await enroll(service, advance);
  assert.ok(Array.isArray(records.get("ana")?.pilotTemplate));

  await service.pilotRevoke("ana");
  assert.equal(records.get("ana")?.pilotTemplate, undefined);
  const status = await service.pilotStatus("ana");
  assert.equal(status.consent, false);
  assert.equal(status.enrolled, false);
});
