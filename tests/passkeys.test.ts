import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getWebAuthnConfig,
  hashReauthToken,
  isReauthPurpose,
  toPublicPasskey,
  type StoredPasskey,
} from "../server/passkeys/service.js";

process.env.NODE_ENV = "test";
process.env.PUBLIC_URL = "https://via-nova-ia.vercel.app";

test("WebAuthn deriva RP ID y origen de la configuración, nunca del Host de la petición", () => {
  const previous = process.env.WEBAUTHN_RP_ID;
  delete process.env.WEBAUTHN_RP_ID;
  const config = getWebAuthnConfig();
  assert.equal(config.rpID, "via-nova-ia.vercel.app");
  assert.ok(config.expectedOrigin.includes("https://via-nova-ia.vercel.app"));
  assert.ok(config.expectedOrigin.every((origin) => origin.startsWith("http")));

  process.env.WEBAUTHN_RP_ID = "vianova.example";
  assert.equal(getWebAuthnConfig().rpID, "vianova.example");

  if (previous === undefined) delete process.env.WEBAUTHN_RP_ID;
  else process.env.WEBAUTHN_RP_ID = previous;
});

test("solo se aceptan propósitos de reautenticación conocidos", () => {
  assert.equal(isReauthPurpose("passkey-register"), true);
  assert.equal(isReauthPurpose("passkey-remove"), true);
  assert.equal(isReauthPurpose("password-change"), true);
  assert.equal(isReauthPurpose("recovery-email"), true);
  assert.equal(isReauthPurpose("two-factor"), true);
  assert.equal(isReauthPurpose("admin"), false);
  assert.equal(isReauthPurpose("password-change "), false);
  assert.equal(isReauthPurpose(undefined), false);
});

test("el token de reautenticación se guarda hasheado y el hash es estable", () => {
  const token = "x".repeat(43);
  const hash = hashReauthToken(token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, hashReauthToken(token));
  assert.notEqual(hash, token);
});

test("la passkey pública no expone clave, id de credencial ni contador", () => {
  const stored: StoredPasskey = {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "user-1",
    credentialId: "credential-id",
    publicKey: "cHVibGljLWtleQ",
    counter: 3,
    transports: ["internal"],
    deviceType: "multiDevice",
    backedUp: true,
    label: "Mi teléfono",
    createdAt: "2026-11-09T00:00:00.000Z",
    lastUsedAt: null,
  };
  const safe = toPublicPasskey(stored) as unknown as Record<string, unknown>;
  assert.equal("publicKey" in safe, false);
  assert.equal("credentialId" in safe, false);
  assert.equal("counter" in safe, false);
  assert.equal(safe.label, "Mi teléfono");
  assert.equal(safe.deviceType, "multiDevice");
});
