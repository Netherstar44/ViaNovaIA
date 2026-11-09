// Local preflight only. Does not run Vercel CLI, deploy, or modify an account.
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { FaceInputError, VladFaceEngine } from "../server/identity/face-engine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures: string[] = [];
const checks: string[] = [];
function check(label: string, condition: boolean, detail: string): void {
  if (condition) checks.push(`OK  ${label}: ${detail}`);
  else failures.push(`FALLA ${label}: ${detail}`);
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
check("Node 22", nodeMajor === 22, process.versions.node);
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
check("engines", pkg.engines?.node === "22.x", String(pkg.engines?.node));
const vercel = JSON.parse(await readFile(path.join(root, "vercel.json"), "utf8"));
const include = vercel.functions?.["api/index.ts"]?.includeFiles ?? "";
check("Vercel includeFiles", typeof include === "string" && include.includes("@vladmandic/face-api") && include.includes("model/**"), include || "ausente");

const modelDir = path.join(root, "node_modules/@vladmandic/face-api/model");
const requiredModels = [
  "tiny_face_detector_model-weights_manifest.json",
  "ssd_mobilenetv1_model-weights_manifest.json",
  "face_landmark_68_model-weights_manifest.json",
  "face_recognition_model-weights_manifest.json",
];
for (const model of requiredModels) {
  try { await access(path.join(modelDir, model)); check(`modelo ${model}`, true, "presente"); }
  catch { check(`modelo ${model}`, false, "ausente"); }
}

try {
  const canvas = createCanvas(640, 480);
  const image = canvas.toBuffer("image/jpeg");
  try {
    await new VladFaceEngine().analyze(image, false);
    check("motor local", false, "un JPEG sintético sin rostro no fue rechazado");
  } catch (error) {
    check("motor local", error instanceof FaceInputError, error instanceof Error ? error.message : "error desconocido");
  } finally {
    image.fill(0); canvas.width = canvas.height = 1;
  }
} catch (error) {
  check("motor local", false, error instanceof Error ? error.message : "no se pudo cargar canvas");
}

try {
  const bundle = await readFile(path.join(root, "dist/index.cjs"), "utf8");
  check("build local", true, "dist/index.cjs presente");
  check("bundle face-api", bundle.includes("@vladmandic/face-api"), "referencia presente");
  check("bundle canvas nativo", bundle.includes("@napi-rs/canvas"), "referencia presente");
} catch { check("build local", false, "ejecuta npm run build antes del preflight"); }

for (const line of checks) console.info(line);
for (const line of failures) console.error(line);
console.info("No se ejecutó Vercel CLI ni se modificó la cuenta. Un preflight local no demuestra que la función remota arranque.");
if (failures.length) process.exitCode = 1;
