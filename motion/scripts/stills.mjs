/**
 * Renderiza varios stills reutilizando un solo bundle y un solo navegador.
 * Uso: node scripts/stills.mjs 1200 1680 2640 ...
 */
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const frames = process.argv.slice(2).map(Number);
if (!frames.length) {
  console.error("Pasa al menos un número de frame.");
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(root, "..", "out", "showreel-60", "stills");
fs.mkdirSync(outDir, { recursive: true });

console.log("Bundling…");
const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "index.ts"),
  onProgress: () => undefined,
});

const browser = await openBrowser("chrome");
const composition = await selectComposition({
  serveUrl,
  id: "ViaNovaFilm",
  puppeteerInstance: browser,
});

for (const frame of frames) {
  const output = path.join(outDir, `f${String(frame).padStart(4, "0")}.png`);
  const started = Date.now();
  await renderStill({
    composition,
    serveUrl,
    output,
    frame,
    imageFormat: "png",
    puppeteerInstance: browser,
    logLevel: "error",
  });
  console.log(`frame ${frame} -> ${path.basename(output)} (${Date.now() - started} ms)`);
}

await browser.close({ silent: true });
console.log("Listo.");
