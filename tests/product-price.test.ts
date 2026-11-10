import assert from "node:assert/strict";
import { test } from "node:test";
import { formatProductPrice } from "../client/src/lib/product-price.js";

test("el catálogo no inventa un precio para valores vacíos o inválidos", () => {
  for (const value of [null, undefined, "", " ", false, {}, NaN, Infinity, -1, "error", "0x10", "1,25"]) {
    assert.equal(formatProductPrice(value, "COP"), "Precio no disponible");
  }
});

test("sin moneda válida el precio queda identificado como incompleto", () => {
  for (const currency of [null, undefined, "", "INVALID", "ZZZ", 123]) {
    assert.equal(formatProductPrice("1250.5", currency), "1.250,5 · moneda no disponible");
  }
});

test("precios válidos conservan cero, decimales y la moneda del proveedor", () => {
  assert.equal(formatProductPrice(0, "COP"), (0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }));
  assert.equal(formatProductPrice("12.75", " usd "), (12.75).toLocaleString("es-CO", { style: "currency", currency: "USD", maximumFractionDigits: 2 }));
});
