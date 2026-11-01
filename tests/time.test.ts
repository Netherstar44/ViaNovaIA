import assert from "node:assert/strict";
import { test } from "node:test";
import { databaseTimestampToIso } from "../server/time.js";

test("databaseTimestampToIso interpreta timestamps sin zona como UTC", () => {
  assert.equal(
    databaseTimestampToIso("2026-10-31 01:58:02.196971"),
    "2026-10-31T01:58:02.196Z",
  );
});

test("databaseTimestampToIso respeta una zona explícita", () => {
  assert.equal(
    databaseTimestampToIso("2026-10-31 01:58:02.196971-05:00"),
    "2026-10-31T06:58:02.196Z",
  );
  assert.equal(
    databaseTimestampToIso("2026-10-31 01:58:02.196971+00"),
    "2026-10-31T01:58:02.196Z",
  );
});

test("databaseTimestampToIso acepta fechas sin hora y rechaza valores inválidos", () => {
  assert.equal(databaseTimestampToIso("2026-10-31"), "2026-10-31T00:00:00.000Z");
  assert.equal(databaseTimestampToIso(""), null);
  assert.equal(databaseTimestampToIso(null), null);
  assert.equal(databaseTimestampToIso("no-es-fecha"), null);
});
