/// <reference lib="webworker" />
import { cameraBasis, direction, projectBasis, sphereCoverage, type Pose } from "@shared/sphere";
let width = 4096, height = 2048, pixels: Uint8ClampedArray, weights: Uint16Array;
self.onmessage = async (event: MessageEvent) => {
  try {
    const data = event.data;
    if (data.type === "init") {
      width = data.width; height = width / 2;
      pixels = new Uint8ClampedArray(width * height * 4); weights = new Uint16Array(width * height);
      self.postMessage({ type: "ready" }); return;
    }
    if (data.type === "frame") {
      const { frame, pose, hFov, vFov } = data as { frame: ImageData; pose: Pose; hFov: number; vFov: number };
      const basis = cameraBasis(pose), tanH = Math.tan(hFov * Math.PI / 360), tanV = Math.tan(vFov * Math.PI / 360);
      const cosYaw = new Float64Array(width), sinYaw = new Float64Array(width);
      for (let x = 0; x < width; x++) { const yaw = (x + 0.5) / width * 2 * Math.PI; cosYaw[x] = Math.cos(yaw); sinYaw[x] = Math.sin(yaw); }
      for (let y = 0; y < height; y++) {
        const pitch = 90 - (y + 0.5) / height * 180, row = direction(0, pitch);
        for (let x = 0; x < width; x++) {
          const uv = projectBasis([row[0] * cosYaw[x], row[1], row[0] * sinYaw[x]], basis, tanH, tanV);
          if (!uv) continue;
          const edge = Math.min(uv[0], 1 - uv[0], uv[1], 1 - uv[1]);
          const weight = Math.max(1, Math.round(Math.min(1, edge * 8) * 100));
          const index = y * width + x, target = index * 4;
          const sx = Math.max(0, Math.min(frame.width - 1, uv[0] * frame.width - 0.5));
          const sy = Math.max(0, Math.min(frame.height - 1, uv[1] * frame.height - 0.5));
          const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
          const a = (iy * frame.width + ix) * 4, b = (iy * frame.width + Math.min(ix + 1, frame.width - 1)) * 4;
          const c = (Math.min(iy + 1, frame.height - 1) * frame.width + ix) * 4, d = (Math.min(iy + 1, frame.height - 1) * frame.width + Math.min(ix + 1, frame.width - 1)) * 4;
          const old = weights[index], sum = old + weight;
          for (let channel = 0; channel < 3; channel++) {
            const sample = (frame.data[a + channel] * (1 - fx) + frame.data[b + channel] * fx) * (1 - fy) + (frame.data[c + channel] * (1 - fx) + frame.data[d + channel] * fx) * fy;
            pixels[target + channel] = (pixels[target + channel] * old + sample * weight) / sum;
          }
          pixels[target + 3] = 255; weights[index] = Math.min(65000, sum);
        }
      }
      self.postMessage({ type: "progress", coverage: sphereCoverage(weights, width, height) }); return;
    }
    if (data.type === "finish") {
      const coverage = sphereCoverage(weights, width, height);
      self.postMessage({ type: "result", width, height, coverage, pixels }, [pixels.buffer]);
      // Caller terminates the worker; drop both large buffers immediately.
      pixels = new Uint8ClampedArray(0); weights = new Uint16Array(0);
    }
  } catch { self.postMessage({ type: "error", message: "No se pudo ensamblar la esfera. Importa una foto de cámara 360 o usa 2048 px." }); }
};
