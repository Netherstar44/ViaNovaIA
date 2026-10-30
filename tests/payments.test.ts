import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-0123456789-abcdef";
process.env.SESSION_SECRET = "test-session-secret-0123456789-abcd";
process.env.PAYMENT_ENCRYPTION_KEY = "test-payment-key-0123456789-abcdef";

const { validatePaymentMethodDetails, sanitizePaymentMethod } = await import(
  "../server/security.js"
);
const {
  computeWompiEventChecksum,
  verifyWompiEventChecksum,
  isAllowedWompiCheckoutUrl,
} = await import("../server/payments.js");

test("QR: solo acepta URL HTTPS sin credenciales", () => {
  assert.equal(validatePaymentMethodDetails("qr", "http://x.test/qr").ok, false);
  assert.equal(validatePaymentMethodDetails("qr", "javascript:alert(1)").ok, false);
  assert.equal(validatePaymentMethodDetails("qr", "https://user:pass@x.test/qr").ok, false);
  assert.equal(validatePaymentMethodDetails("qr", "000201010212").ok, false);
  assert.deepEqual(validatePaymentMethodDetails("qr", "https://checkout.wompi.co/l/test"), {
    ok: true,
    details: "https://checkout.wompi.co/l/test",
  });
});

test("tarjeta: nunca acepta PAN completo ni CVV", () => {
  assert.equal(validatePaymentMethodDetails("card", "4242424242424242").ok, false);
  assert.equal(validatePaymentMethodDetails("card", "123").ok, false);
  assert.equal(validatePaymentMethodDetails("card", "4242").ok, true);
  assert.deepEqual(validatePaymentMethodDetails("card", "**** 4242"), {
    ok: true,
    details: "4242",
  });
});

test("Nequi y Daviplata: normaliza celular colombiano y rechaza cuentas", () => {
  assert.deepEqual(validatePaymentMethodDetails("nequi", "+57 300 123 4567"), {
    ok: true,
    details: "3001234567",
  });
  assert.equal(validatePaymentMethodDetails("daviplata", "12345").ok, false);
  assert.equal(validatePaymentMethodDetails("nequi", "1234567890123456").ok, false);
});

test("Bre-B: celular, correo o llave alfanumérica; nunca cuentas largas", () => {
  assert.deepEqual(validatePaymentMethodDetails("breb", "3001234567"), {
    ok: true,
    details: "3001234567",
  });
  assert.deepEqual(validatePaymentMethodDetails("breb", "Pago@Ejemplo.com"), {
    ok: true,
    details: "pago@ejemplo.com",
  });
  assert.equal(validatePaymentMethodDetails("breb", "llaveviajera2026").ok, true);
  assert.equal(validatePaymentMethodDetails("breb", "12345678901234567890").ok, false);
});

test("PSE: solo nombre de banco, sin números de cuenta", () => {
  assert.deepEqual(validatePaymentMethodDetails("pse", "Bancolombia"), {
    ok: true,
    details: "Bancolombia",
  });
  assert.equal(validatePaymentMethodDetails("pse", "1234567890").ok, false);
  assert.equal(validatePaymentMethodDetails("pse", "A".repeat(61)).ok, false);
});

test("efectivo y Wompi no guardan detalles", () => {
  assert.deepEqual(validatePaymentMethodDetails("cash", "cualquier cosa"), {
    ok: true,
    details: null,
  });
  assert.deepEqual(validatePaymentMethodDetails("wompi", "4111111111111111"), {
    ok: true,
    details: null,
  });
});

test("sanitizePaymentMethod enmascara referencias y no expone el detalle", () => {
  const masked = sanitizePaymentMethod({
    id: "pm_1",
    type: "breb",
    label: "Mi Bre-B",
    details: "3001234567",
  });
  assert.notEqual(masked.details, "3001234567");
  assert.equal(masked.hasDetails, true);
  const qr = sanitizePaymentMethod({ id: "pm_2", type: "qr", details: "https://x.test" });
  assert.equal(qr.details, "QR vinculado");
});

test("checksum de Wompi: firma correcta, alterada y ausente fallan", () => {
  const secret = "test-events-secret";
  const payload = {
    event: "transaction.updated",
    data: {
      transaction: {
        id: "tx_123",
        status: "APPROVED",
        amount_in_cents: 150000,
        reference: "VN-TEST",
      },
    },
    signature: {
      properties: [
        "transaction.id",
        "transaction.status",
        "transaction.amount_in_cents",
        "transaction.reference",
      ],
    },
    timestamp: 1700000000,
  };

  const expected = crypto
    .createHash("sha256")
    .update(`tx_123APPROVED150000VN-TEST1700000000${secret}`)
    .digest("hex");

  assert.equal(computeWompiEventChecksum(payload, secret), expected);
  assert.equal(verifyWompiEventChecksum(payload, expected, secret), true);
  assert.equal(verifyWompiEventChecksum(payload, expected.replace(/.$/, "0"), secret), false);
  assert.equal(verifyWompiEventChecksum(payload, "", secret), false);
  assert.equal(verifyWompiEventChecksum({ ...payload, signature: {} }, expected, secret), false);
});

test("checkout: solo se permiten URLs HTTPS del dominio Wompi", () => {
  assert.equal(isAllowedWompiCheckoutUrl("https://checkout.wompi.co/l/test_VPOS"), true);
  assert.equal(isAllowedWompiCheckoutUrl("https://evil.test/checkout"), false);
  assert.equal(isAllowedWompiCheckoutUrl("http://checkout.wompi.co/l/test"), false);
  assert.equal(isAllowedWompiCheckoutUrl("https://checkout.wompi.co.evil.test/"), false);
  assert.equal(isAllowedWompiCheckoutUrl("https://user:pass@checkout.wompi.co/l/test"), false);
});
