import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
const source = path.resolve("node_modules/@vladmandic/face-api");
const target = path.resolve("client/public/face-models/1.7.15");
await mkdir(target, { recursive: true });
for (const file of ["tiny_face_detector_model-weights_manifest.json", "tiny_face_detector_model.bin"]) {
  await copyFile(path.join(source, "model", file), path.join(target, file));
}
await copyFile(path.join(source, "dist/face-api.esm.js"), path.join(target, "face-api.esm.js"));
await copyFile(path.join(source, "LICENSE"), path.join(target, "LICENSE"));
