import assert from "node:assert/strict";
import { test } from "node:test";
import {
  columnProfile,
  coverageDeg,
  estimateShift,
  horizontalFovForFrame,
  panoramaBand,
  verticalFov,
  yawToX,
} from "../client/src/lib/panoramaStitcher.js";

function rgbaImage(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => [number, number, number],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colorAt(x, y);
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return data;
}

function smoothProfile(length: number, seed = 1): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = Math.sin((i + seed) / 5) * 24 + Math.cos((i + seed) / 2.3) * 9 + ((i * 13 + seed) % 11);
  }
  return out;
}

function shiftProfile(profile: Float32Array, shift: number): Float32Array {
  const out = new Float32Array(profile.length);
  for (let i = 0; i < profile.length; i += 1) {
    const source = Math.min(profile.length - 1, Math.max(0, i + shift));
    out[i] = profile[source];
  }
  return out;
}

function noiseProfile(length: number, seed: number): Float32Array {
  let state = seed >>> 0;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    out[i] = (state / 0xffffffff) * 100;
  }
  return out;
}

test("columnProfile promedia la luminancia de la banda central", () => {
  const width = 8;
  const height = 10;
  const data = rgbaImage(width, height, (x) => [x * 10, 0, 0]);
  const profile = columnProfile(data, width, height);

  assert.equal(profile.length, width);
  for (let x = 0; x < width; x += 1) {
    assert.ok(Math.abs(profile[x] - x * 10 * 0.299) < 1e-4, `columna ${x}: ${profile[x]}`);
  }
});

test("columnProfile ignora las filas de los polos", () => {
  const width = 4;
  const height = 10;
  const data = rgbaImage(width, height, (_x, y) =>
    y === 0 || y === height - 1 ? [255, 255, 255] : [0, 0, 0],
  );
  const profile = columnProfile(data, width, height);

  for (const value of profile) assert.equal(value, 0);
});

test("estimateShift detecta un giro a la derecha", () => {
  const previous = smoothProfile(320);
  const next = shiftProfile(previous, 14);
  const result = estimateShift(previous, next, 40);

  assert.ok(Math.abs(result.shift - 14) <= 0.75, `shift=${result.shift}`);
  assert.ok(result.score > 0.9, `score=${result.score}`);
});

test("estimateShift detecta un giro a la izquierda", () => {
  const previous = smoothProfile(320);
  const next = shiftProfile(previous, -17);
  const result = estimateShift(previous, next, 40);

  assert.ok(Math.abs(result.shift + 17) <= 0.75, `shift=${result.shift}`);
  assert.ok(result.score > 0.9, `score=${result.score}`);
});

test("estimateShift devuelve cero cuando no hay movimiento", () => {
  const profile = smoothProfile(240);
  const result = estimateShift(profile, profile, 40);

  assert.equal(result.shift, 0);
  assert.ok(result.score > 0.99, `score=${result.score}`);
});

test("estimateShift puntúa bajo escenas sin relación", () => {
  const previous = smoothProfile(320);
  const next = noiseProfile(320, 7);
  const result = estimateShift(previous, next, 40);

  assert.ok(result.score < 0.6, `score=${result.score}`);
});

test("estimateShift tolera perfiles demasiado cortos", () => {
  assert.deepEqual(estimateShift(new Float32Array(4), new Float32Array(4)), { shift: 0, score: 0 });
});

test("coverageDeg mide el arco barrido", () => {
  assert.equal(coverageDeg(10, 250), 240);
  assert.equal(coverageDeg(250, 10), 0);
  assert.equal(coverageDeg(-20, 20), 40);
});

test("yawToX envuelve el giro en el ancho del panorama", () => {
  assert.equal(yawToX(0, 4000), 0);
  assert.equal(yawToX(90, 4000), 1000);
  assert.equal(yawToX(180, 4000), 2000);
  assert.equal(yawToX(270, 4000), 3000);
  assert.equal(yawToX(360, 4000), 0);
  assert.equal(yawToX(-90, 4000), 3000);
  assert.equal(yawToX(450, 4000), 1000);
});

test("panoramaBand centra la banda vertical", () => {
  const band = panoramaBand(40, 2048);

  assert.equal(band.size, 455);
  assert.equal(band.top, 797);
  assert.equal(band.bottom, 1252);
  assert.ok(band.top >= 0 && band.bottom <= 2048);
});

test("panoramaBand no desborda el lienzo con FOV extremos", () => {
  const band = panoramaBand(400, 1000);

  assert.equal(band.size, 1000);
  assert.equal(band.top, 0);
  assert.equal(band.bottom, 1000);
});

test("verticalFov conserva la proporción del encuadre", () => {
  const vFov = verticalFov(65, 1920, 1080);

  assert.ok(Math.abs(vFov - 39.4) < 0.2, `vFov=${vFov}`);
});

test("horizontalFovForFrame reduce el FOV cuando el teléfono va en vertical", () => {
  assert.equal(horizontalFovForFrame(1920, 1080), 65);

  const portrait = horizontalFovForFrame(1080, 1920);
  assert.ok(Math.abs(portrait - 39.4) < 0.2, `portrait=${portrait}`);
});

test("un barrido completo cubre 360° con el ancho del primer fotograma", () => {
  const hFov = 65;
  const startYaw = hFov / 2;
  const endYaw = startYaw + (360 - hFov);

  assert.equal(coverageDeg(startYaw, endYaw) + hFov, 360);
});
