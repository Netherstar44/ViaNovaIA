import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import {
  buildReport,
  collectMetrics,
  countLines,
  isCountedFile,
} from "../scripts/code-metrics.mjs";

const roots: string[] = [];

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "vianova-code-metrics-"));
  roots.push(root);
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test("countLines cuenta CRLF igual que LF y descarta el salto final", () => {
  assert.deepEqual(countLines("uno\r\n\r\ndos\r\n"), { lines: 3, nonblank: 2 });
  assert.deepEqual(countLines("uno\n\ndos\n"), { lines: 3, nonblank: 2 });
});

test("countLines devuelve cero para un archivo vacío", () => {
  assert.deepEqual(countLines(""), { lines: 0, nonblank: 0 });
  const root = fixture({ "client/vacio.ts": "" });
  const report = collectMetrics({ root, files: ["client/vacio.ts"] });
  assert.deepEqual(report.total, { files: 1, lines: 0, nonblank: 0 });
});

test("isCountedFile excluye extensiones, .d.ts y carpetas generadas", () => {
  assert.equal(isCountedFile("client/src/App.tsx"), true);
  assert.equal(isCountedFile("scripts/code-metrics.mjs"), true);
  assert.equal(isCountedFile("README.md"), false);
  assert.equal(isCountedFile("package.json"), false);
  assert.equal(isCountedFile("client/src/types.d.ts"), false);
  assert.equal(isCountedFile("client/dist/out.js"), false);
  assert.equal(isCountedFile("server/vendor/lib.ts"), false);
  assert.equal(isCountedFile("client/node_modules/dep/index.js"), false);
  assert.equal(isCountedFile("build-tools/generate.ts"), false);
});

test("collectMetrics solo suma archivos incluidos y presentes", () => {
  const root = fixture({
    "client/App.tsx": "a\n\nb\n",
    "server/index.ts": "x\r\ny\r\n",
    "client/types.d.ts": "declare const x: number;\n",
    "client/dist/generated.js": "no\n",
    "docs/guia.ts": "no\n",
    "README.md": "no\n",
  });
  const report = collectMetrics({
    root,
    files: [
      "client/App.tsx",
      "server/index.ts",
      "client/types.d.ts",
      "client/dist/generated.js",
      "docs/guia.ts",
      "README.md",
    ],
  });
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.areas, [
    { area: "client", files: 1, lines: 3, nonblank: 2 },
    { area: "server", files: 1, lines: 2, nonblank: 2 },
  ]);
  assert.deepEqual(report.total, { files: 2, lines: 5, nonblank: 4 });
});

test("collectMetrics registra archivos rastreados ausentes sin contarlos", () => {
  const root = fixture({ "server/presente.ts": "a\n" });
  const report = collectMetrics({
    root,
    files: ["server/presente.ts", "client/fantasma.ts", "shared/tipos.d.ts"],
  });
  assert.deepEqual(report.missing, ["client/fantasma.ts"]);
  assert.deepEqual(report.total, { files: 1, lines: 1, nonblank: 1 });
});

test("buildReport conserva definición y formato del reporte", () => {
  const root = fixture({ "tests/ejemplo.test.ts": "test\n" });
  const report = buildReport({ root, files: ["tests/ejemplo.test.ts"] });
  assert.match(report.definition, /physical lines/);
  assert.deepEqual(report.areas, [{ area: "tests", files: 1, lines: 1, nonblank: 1 }]);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(Object.keys(report), ["definition", "areas", "total", "missing"]);
});

test("importar el módulo no ejecuta el CLI ni imprime métricas", () => {
  const scriptUrl = new URL("../scripts/code-metrics.mjs", import.meta.url).href;
  const stdout = execFileSync(
    process.execPath,
    ["-e", `import(${JSON.stringify(scriptUrl)})`],
    { encoding: "utf8", timeout: 20_000 },
  );
  assert.equal(stdout, "");
});
