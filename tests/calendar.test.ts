import assert from "node:assert/strict";
import { test } from "node:test";
import { sameLocalCalendarDay } from "../shared/calendar.js";

test("un horario de otro año no pertenece al día elegido", () => {
  assert.equal(sameLocalCalendarDay(new Date(2025, 10, 9, 10), new Date(2026, 10, 9)), false);
});

test("la disponibilidad agrupa el día local completo y separa medianoche", () => {
  assert.equal(sameLocalCalendarDay(new Date(2026, 10, 9, 23, 59), new Date(2026, 10, 9)), true);
  assert.equal(sameLocalCalendarDay(new Date(2026, 10, 10), new Date(2026, 10, 9, 23, 59)), false);
  assert.equal(sameLocalCalendarDay(new Date(2026, 11, 9), new Date(2026, 10, 9)), false);
});

test("fechas inválidas no generan disponibilidad", () => {
  assert.equal(sameLocalCalendarDay(new Date('invalid'), new Date()), false);
  assert.equal(sameLocalCalendarDay(new Date(), new Date('invalid')), false);
});
