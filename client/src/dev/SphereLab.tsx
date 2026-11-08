// Development-only entry, excluded from the production app's route tree.
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Viewer360 } from "@/components/media/Viewer360";
import { PanoramaCamera } from "@/components/media/PanoramaCamera";
import { IdentityVerification } from "@/components/identity/IdentityVerification";
import { readSphereMetadata } from "@/lib/panoramaMetadata";
import { cameraBasis, captureTargets, direction } from "@shared/sphere";
import "../index.css";
import "../styles/glass.css";
const params = new URLSearchParams(location.search);
document.documentElement.className = params.get("theme") ?? "light";
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: async () => ({ identity: { verified: false, name: null, verifiedAt: null, validUntil: null, method: null }, consent: false, enrolled: false, pendingApproval: false, manualRequested: false }) } } });
function grid(): string {
  const canvas = document.createElement("canvas"); canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < canvas.height; y++) { const pitch = 90 - y / canvas.height * 180; ctx.fillStyle = pitch > 70 ? '#f23a32' : pitch < -70 ? '#2448ee' : `hsl(${120 + pitch},55%,35%)`; ctx.fillRect(0, y, canvas.width, 1); }
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.fillStyle = '#ffffff'; ctx.font = '24px sans-serif';
  for (let lon = 0; lon < 360; lon += 30) { const x = lon / 360 * canvas.width; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); ctx.fillText(`${lon}°`, x + 6, 530); }
  for (let lat = -60; lat <= 60; lat += 30) { const y = (90 - lat) / 180 * canvas.height; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); ctx.fillText(`${lat}°`, 200, y - 6); }
  const url = canvas.toDataURL("image/jpeg", 0.9); canvas.width = canvas.height = 1; return url;
}
async function workerProof() {
  const started = performance.now();
  const worker = new Worker(new URL("../lib/sphere.worker.ts", import.meta.url), { type: "module" });
  const targets = captureTargets(65, 40);
  let index = 0;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { worker.terminate(); reject(new Error("Worker timeout")); }, 90_000);
    const frame = () => {
      const pose = targets[index++], basis = cameraBasis(pose), width = 160, height = 100;
      const pixels = new Uint8ClampedArray(width * height * 4), tanH = Math.tan(65 * Math.PI / 360), tanV = Math.tan(40 * Math.PI / 360);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const dx = ((x + 0.5) / width * 2 - 1) * tanH, dy = (1 - (y + 0.5) / height * 2) * tanV;
        const ray = basis.forward.map((v, i) => v + basis.right[i] * dx + basis.up[i] * dy);
        const pitch = Math.asin(ray[1] / Math.hypot(...ray)) * 180 / Math.PI;
        pixels.set(pitch > 70 ? [242,58,50,255] : pitch < -70 ? [36,72,238,255] : [35,145,65,255], (y * width + x) * 4);
      }
      worker.postMessage({ type: 'frame', frame: new ImageData(pixels, width, height), pose, hFov: 65, vFov: 40 }, [pixels.buffer]);
    };
    worker.onmessage = e => {
      if (e.data.type === 'error') { clearTimeout(timer); worker.terminate(); reject(new Error(e.data.message)); }
      else if (e.data.type === 'ready' || e.data.type === 'progress') { if (index < targets.length) frame(); else worker.postMessage({ type: 'finish' }); }
      else if (e.data.type === 'result') {
        clearTimeout(timer); worker.terminate(); const data = e.data;
        resolve({ frames: targets.length, coverage: data.coverage, width: data.width, height: data.height, milliseconds: performance.now() - started,
          zenith: Array.from(data.pixels.slice((256 * 4), (256 * 4) + 3)), nadir: Array.from(data.pixels.slice(((255 * 512 + 256) * 4), ((255 * 512 + 256) * 4) + 3)) });
      }
    };
    worker.postMessage({ type: 'init', width: 512 });
  });
}
(window as any).sphereWorkerProof = workerProof;
function Lab() {
  const [url] = useState(grid), [result, setResult] = useState("");
  useEffect(() => {
    const tick = setInterval(() => {
      const canvas = document.querySelector('canvas[aria-label]');
      if (canvas) { canvas.dispatchEvent(new KeyboardEvent('keydown', { key: params.get('pitch') === '90' ? 'Home' : params.get('pitch') === '-90' ? 'End' : '0', bubbles: true })); clearInterval(tick); }
    }, 100);
    return () => clearInterval(tick);
  }, []);
  return <QueryClientProvider client={queryClient}><main className="min-h-screen bg-background text-foreground p-4 space-y-4">
    <h1 className="text-xl font-semibold">Laboratorio local · textura sintética</h1>
    <p>Rojo: cenit +90°. Azul: nadir −90°. Verde: horizonte. Inicio/Fin miran los polos.</p>
    {params.get('surface') === 'identity' ? <IdentityVerification /> : params.get('surface') === 'capture' ? <PanoramaCamera onCapture={async file => {
      const bitmap = await createImageBitmap(file); setResult(JSON.stringify({ width: bitmap.width, height: bitmap.height, ...readSphereMetadata(new Uint8Array(await file.arrayBuffer())) })); bitmap.close();
    }} /> : <div style={{ height: 'min(65vh, 520px)' }}><Viewer360 url={url} /></div>}
    <output id="capture-result">{result}</output>
  </main></QueryClientProvider>;
}
createRoot(document.getElementById("root")!).render(<Lab />);
