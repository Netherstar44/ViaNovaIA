import assert from "node:assert/strict";
import { test } from "node:test";
import { angularDistance, cameraBasis, captureTargets, clampPitch, direction, partialVerticalFov, projectRay, sphereCoverage } from "../shared/sphere.js";
import { devicePose } from "../client/src/lib/devicePose.js";
import { readSphereMetadata, withGpano } from "../client/src/lib/panoramaMetadata.js";
test("proyección: horizonte, cenit y nadir llegan al centro sin invertir orientación", () => {
  for (const pitch of [-90, 0, 90]) {
    const projected = projectRay(direction(0, pitch), { yaw: 0, pitch, roll: 0 }, 65, 40)!;
    assert.ok(Math.abs(projected[0] - 0.5) < 1e-10); assert.ok(Math.abs(projected[1] - 0.5) < 1e-10);
  }
  assert.ok(projectRay(direction(10, 0), { yaw: 0, pitch: 0, roll: 0 }, 65, 40)![0] > 0.5);
  assert.ok(projectRay(direction(0, 10), { yaw: 0, pitch: 0, roll: 0 }, 65, 40)![1] < 0.5);
  assert.equal(projectRay(direction(180, 0), { yaw: 0, pitch: 0, roll: 0 }, 65, 40), null);
});
test("no hay discontinuidad en la costura 0°/360° ni degeneración de base en polos", () => {
  assert.ok(angularDistance({ yaw: 359, pitch: 0 }, { yaw: 1, pitch: 0 }) < 2.001);
  assert.ok(angularDistance({ yaw: 0, pitch: 90 }, { yaw: 240, pitch: 90 }) < 1e-5);
  for (const pitch of [-90, 0, 90]) {
    const { forward, right, up } = cameraBasis({ yaw: 15, pitch, roll: 35 });
    for (const axis of [forward, right, up]) assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-10);
    assert.ok(Math.abs(forward.reduce((s, v, i) => s + v * up[i], 0)) < 1e-10);
    assert.ok(Math.abs(right.reduce((s, v, i) => s + v * up[i], 0)) < 1e-10);
  }
});
test("cobertura ponderada por área: banda ±30° ocupa 50% de la esfera", () => {
  const w = 360, h = 180, mask = new Uint8Array(w * h);
  for (let y = 60; y < 120; y++) mask.fill(1, y * w, (y + 1) * w);
  assert.ok(Math.abs(sphereCoverage(mask, w, h) - 50) < 1e-9);
  assert.equal(sphereCoverage(new Uint8Array(w * h), w, h), 0);
  assert.ok(Math.abs(sphereCoverage(mask.fill(1), w, h) - 100) < 1e-9);
});
test("anillos más cenit/nadir cubren toda una cuadrícula esférica de 2°", () => {
  for (const [hFov, vFov] of [[65, 40], [40, 65]]) {
    const targets = captureTargets(hFov, vFov); const w = 180, h = 90, mask = new Uint8Array(w * h);
    assert.ok(targets.some(t => t.pitch === 90)); assert.ok(targets.some(t => t.pitch === -90));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ray = direction((x + 0.5) / w * 360, 90 - (y + 0.5) / h * 180);
      mask[y * w + x] = targets.some(t => projectRay(ray, t, hFov, vFov)) ? 1 : 0;
    }
    const coverage = sphereCoverage(mask, w, h); assert.ok(coverage > 99.9, `${hFov}x${vFov}: ${coverage}%`);
  }
});
test("panoramas horizontales recortados conservan su ángulo vertical", () => {
  assert.equal(partialVerticalFov(4096, 2048), 180);
  assert.equal(partialVerticalFov(4096, 512), 45);
  assert.equal(clampPitch(-120), -90); assert.equal(clampPitch(120), 90);
});
test("orientación de sensores incluye inclinación vertical y rotación de pantalla", () => {
  const upright = devicePose(0, 90, 0, 0), sky = devicePose(0, 0, 0, 0), floor = devicePose(0, 180, 0, 0);
  assert.ok(Math.abs(upright.pitch) < 1e-8); assert.ok(Math.abs(sky.pitch + 90) < 1e-8); assert.ok(Math.abs(floor.pitch - 90) < 1e-8);
  const rotated = devicePose(0, 90, 0, 90); assert.ok(Math.abs(rotated.pitch) < 1e-8); assert.ok(Math.abs(Math.abs(rotated.roll) - 90) < 1e-8);
});
test("JPEG/XMP guarda GPano y cobertura; originales sin metadatos quedan desconocidos", () => {
  const jpg = new Uint8Array([255, 216, 255, 217]); const tagged = withGpano(jpg, 4096, 2048, 73.25);
  assert.equal(tagged[0], 255); assert.equal(tagged[1], 216); assert.equal(tagged[3], 225);
  assert.equal(readSphereMetadata(tagged).coverage, 73.25); assert.equal(readSphereMetadata(jpg).coverage, null);
  assert.equal(tagged.at(-1), 217); assert.throws(() => withGpano(new Uint8Array(4), 4096, 2048, 100));
});
