import { test } from "node:test";
import assert from "node:assert/strict";
import { measure, wilsonUpper, type CalibrationComparison } from "../server/identity/calibration-stats.js";

function comparison(overrides: Partial<CalibrationComparison> = {}): CalibrationComparison {
  return {
    genuine: true,
    group: "normal",
    score: 0.2,
    claimedId: "persona-a",
    subjectId: "persona-a",
    enrollmentSession: "a-1",
    probeSession: "a-2",
    ...overrides,
  };
}

test("Wilson: el límite superior unilateral con cero fallos baja al aumentar la muestra", () => {
  const small = wilsonUpper(0, 30);
  const large = wilsonUpper(0, 3000);
  assert.ok(small !== null && large !== null);
  assert.ok(small > large);
  assert.ok(large < 0.001, `3000 impostores deben quedar por debajo de 0.1%, recibido ${large}`);
  assert.equal(wilsonUpper(0, 0), null);
  assert.equal(wilsonUpper(2, 1), null);
});

test("Wilson: un solo fallo en 3000 no se presenta como 0.1%", () => {
  const upper = wilsonUpper(1, 3000);
  assert.ok(upper !== null && upper > 0.001);
});

test("las comparaciones del mismo sujeto o del mismo par no inflan la evidencia independiente", () => {
  const items = [
    comparison(),
    comparison({ probeSession: "a-3" }),
    comparison({ genuine: false, claimedId: "persona-a", subjectId: "persona-b", score: 0.1 }),
    comparison({ genuine: false, claimedId: "persona-a", subjectId: "persona-b", score: 0.2, probeSession: "b-3" }),
  ];
  const metrics = measure(items, 0.4);
  assert.equal(metrics.comparisons, 4);
  assert.equal(metrics.genuine, 2);
  assert.equal(metrics.impostors, 2);
  assert.equal(metrics.independentGenuineClusters, 1);
  assert.equal(metrics.independentImpostorClusters, 1);
  assert.equal(metrics.clusterFalseAccepts, 1);
  assert.equal(metrics.clusterFalseRejects, 0);
});

test("un fallo en un cluster cuenta como fallo de cluster para el límite conservador", () => {
  const items = [
    comparison({ score: 0.1 }),
    comparison({ score: 0.9, probeSession: "a-3" }),
  ];
  const metrics = measure(items, 0.4);
  assert.equal(metrics.falseRejects, 1);
  assert.equal(metrics.clusterFalseRejects, 1);
  assert.equal(metrics.independentGenuineClusters, 1);
});
