import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

test("las reescrituras /api de Vercel omiten extensiones con cleanUrls", () => {
  assert.equal(config.cleanUrls, true, "cleanUrls debe seguir activo");
  const apiRewrites = (config.rewrites ?? []).filter(
    (rewrite: { source?: string }) =>
      typeof rewrite.source === "string" && rewrite.source.startsWith("/api"),
  );
  assert.ok(apiRewrites.length > 0, "debe existir al menos una reescritura /api");
  for (const rewrite of apiRewrites) {
    assert.equal(typeof rewrite.destination, "string");
    assert.doesNotMatch(
      rewrite.destination,
      /\.[a-z0-9]+$/i,
      `cleanUrls elimina la extensión de ${rewrite.destination}; el rewrite caería en la SPA`,
    );
  }
});

test("el despliegue facial fija Node 22 e incluye sus pesos locales", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.engines.node, "22.x");
  const included = config.functions?.["api/index.ts"]?.includeFiles;
  assert.ok(included.includes("@vladmandic/face-api"));
  assert.ok(included.includes("model/**"));
});
