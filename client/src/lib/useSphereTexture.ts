import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import { readSphereMetadata } from "./panoramaMetadata";
type State = { status: "loading"; progress: number } | { status: "ready"; texture: THREE.Texture } | { status: "error"; message: string };
function sourceUrl(url: string, width: number): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'res.cloudinary.com' && parsed.pathname.includes('/image/upload/')) return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
  } catch { /* blob and same-origin URLs are already local. */ }
  return url;
}
export function useSphereTexture(url: string, previewUrl?: string) {
  const [attempt, setAttempt] = useState(0), [state, setState] = useState<State>({ status: "loading", progress: 0 });
  const [coverage, setCoverage] = useState<number | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  useEffect(() => {
    const abort = new AbortController(), textures: THREE.Texture[] = [];
    let cancelled = false;
    let idleTimeout: ReturnType<typeof setTimeout> | undefined;
    const keepAlive = () => { clearTimeout(idleTimeout); idleTimeout = setTimeout(() => abort.abort(), 30_000); };
    setState({ status: "loading", progress: 0 }); setCoverage(null); setUpgrading(false);
    const load = async (source: string, preview: boolean) => {
      keepAlive();
      const response = await fetch(source, { signal: abort.signal });
      if (!response.ok) throw new Error("No se pudo descargar el panorama.");
      const reader = response.body?.getReader(), chunks: Uint8Array[] = [];
      let loaded = 0, lastProgress = -1; const total = Number(response.headers.get('Content-Length'));
      if (!reader) throw new Error("La descarga no está disponible.");
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        keepAlive();
        loaded += value.byteLength;
        if (loaded > 25 * 1024 * 1024) { await reader.cancel(); throw new Error("La imagen supera 25 MB. Usa una copia de hasta 4096 × 2048."); }
        chunks.push(value);
        const progress = total ? Math.min(99, Math.round(loaded / total * 100)) : 0;
        if (!preview && !cancelled && !textures.length && progress !== lastProgress) { lastProgress = progress; setState({ status: 'loading', progress }); }
      }
      clearTimeout(idleTimeout);
      // Avoid a second full-size Uint8Array for 18 MB panoramas already in the DB.
      const blob = new Blob(chunks);
      if (!preview) setCoverage(readSphereMetadata(new Uint8Array(await blob.slice(0, 128 * 1024).arrayBuffer())).coverage);
      const bitmap = await createImageBitmap(blob, { resizeWidth: preview ? 512 : 4096, resizeQuality: 'high', imageOrientation: 'none' });
      if (cancelled) { bitmap.close(); return; }
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0); bitmap.close();
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping;
      textures.push(texture); setState({ status: 'ready', texture });
    };
    const timeout = setTimeout(() => abort.abort(), 120_000);
    void (async () => {
      try {
        const preview = previewUrl ?? sourceUrl(url, 512);
        if (preview !== url) { await load(preview, true); setUpgrading(true); }
        await load(sourceUrl(url, 4096), false);
      } catch (error) {
        if (!cancelled && !textures.length) setState({ status: 'error', message: error instanceof Error && error.name !== 'AbortError' ? error.message : 'La descarga tardó demasiado. Revisa la conexión.' });
      } finally { clearTimeout(timeout); clearTimeout(idleTimeout); if (!cancelled) setUpgrading(false); }
    })();
    return () => {
      cancelled = true; abort.abort(); clearTimeout(timeout); clearTimeout(idleTimeout);
      for (const texture of textures) { texture.dispose(); const canvas = texture.image as HTMLCanvasElement; canvas.width = canvas.height = 1; }
    };
  }, [url, previewUrl, attempt]);
  return { state, coverage, upgrading, retry: useCallback(() => setAttempt(n => n + 1), []) };
}
