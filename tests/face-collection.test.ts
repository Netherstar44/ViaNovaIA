import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CALIBRATION_CONSENT_VERSION,
  addFrame,
  addParticipant,
  addSession,
  assertParticipantId,
  createCollection,
  isExpired,
  type Collection,
} from "../server/identity/collection-policy.js";
import { buildManifest, manifestWarnings } from "../server/identity/collection-manifest.js";

function collectionWithTwoSplits(): Collection {
  const collection = createCollection(1_900_000_000_000, 30);
  const people = [
    ["cal-a", "calibration"],
    ["cal-b", "calibration"],
    ["eval-a", "evaluation"],
    ["eval-b", "evaluation"],
  ] as const;
  for (const [id, split] of people) {
    addParticipant(collection, { id, split, accepted: true, version: CALIBRATION_CONSENT_VERSION }, 1_900_000_000_000);
    const first = addSession(collection, { participantId: id, condition: "normal" }, 1_900_000_000_000);
    addFrame(collection, { participantId: id, sessionId: first.id, pose: "center", bytes: 100, width: 640, height: 480, sha256: "a" }, 1_900_000_000_000);
    const second = addSession(collection, { participantId: id, condition: "normal" }, 1_900_000_001_000);
    addFrame(collection, { participantId: id, sessionId: second.id, pose: "center", bytes: 100, width: 640, height: 480, sha256: "b" }, 1_900_000_001_000);
    addFrame(collection, { participantId: id, sessionId: second.id, pose: "left", bytes: 100, width: 640, height: 480, sha256: "c" }, 1_900_000_001_001);
  }
  return collection;
}

test("seudónimos y consentimiento se validan antes de crear un participante", () => {
  assert.equal(assertParticipantId("voluntario-01"), "voluntario-01");
  assert.throws(() => assertParticipantId("Nombre Real"), /seudónimo/i);
  const collection = createCollection();
  assert.throws(
    () => addParticipant(collection, { id: "voluntario-01", split: "calibration", accepted: false, version: CALIBRATION_CONSENT_VERSION }),
    /consentimiento/i,
  );
  assert.throws(
    () => addParticipant(collection, { id: "voluntario-01", split: "calibration", accepted: true, version: "otra-version" }),
    /consentimiento/i,
  );
});

test("el manifest usa seudónimos, separa conjuntos y no reutiliza imágenes", () => {
  const collection = collectionWithTwoSplits();
  const manifest = buildManifest(collection, { now: 1_900_000_000_000 });
  assert.equal(manifest.consentConfirmed, true);
  assert.equal(Object.keys(manifest.calibration.enrollments).length, 2);
  assert.equal(Object.keys(manifest.evaluation.enrollments).length, 2);
  assert.ok(manifest.calibration.probes.some((probe) => probe.genuine));
  assert.ok(manifest.calibration.probes.some((probe) => !probe.genuine));
  assert.ok(manifest.evaluation.probes.some((probe) => probe.genuine));
  const images = [
    ...Object.values(manifest.calibration.enrollments).map((item) => item.image),
    ...manifest.calibration.probes.map((item) => item.image),
    ...Object.values(manifest.evaluation.enrollments).map((item) => item.image),
    ...manifest.evaluation.probes.map((item) => item.image),
  ];
  assert.equal(new Set(images).size, images.length);
  for (const probe of [...manifest.calibration.probes, ...manifest.evaluation.probes]) {
    assert.ok(probe.subjectId.length > 2);
    assert.ok(probe.claimedId.length > 2);
  }
});

test("el manifest se niega a inventar una comparación con una sola persona", () => {
  const collection = createCollection();
  addParticipant(collection, { id: "solo-uno", split: "calibration", accepted: true, version: CALIBRATION_CONSENT_VERSION });
  assert.throws(() => buildManifest(collection), /dos personas/i);
});

test("la retención vencida se detecta y el manifest avisa de la falta de potencia", () => {
  const collection = collectionWithTwoSplits();
  assert.equal(isExpired(new Date(1_900_000_000_000).toISOString(), 1_900_000_000_000), true);
  const manifest = buildManifest(collection, { now: 1_900_000_000_000 });
  const warnings = manifestWarnings(manifest);
  assert.ok(warnings.some((warning) => /3\.000|3000|mínimos/i.test(warning)));
  assert.throws(() => buildManifest(collection, { now: 2_000_000_000_000 }), /retención|vigente|fotograma|sesiones/i);
});
