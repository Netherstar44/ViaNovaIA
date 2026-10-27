import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

const textureCache = new Map<string, THREE.Texture>();
const MAX_TEXTURE_WIDTH = 4096;
const LOAD_TIMEOUT_MS = 30000;

/**
 * Cloudinary serves the original file by default. A 360 photo is usually
 * several megabytes, so request an auto-format, auto-quality, width-limited
 * version. Non-Cloudinary URLs are returned untouched.
 */
function optimizedPanoramaUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if ((parsed.hostname !== 'cloudinary.com' && !parsed.hostname.endsWith('.cloudinary.com')) || !parsed.pathname.includes('/image/upload/')) {
      return url;
    }
    const viewportWidth = typeof window === 'undefined' ? 2048 : window.innerWidth;
    const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.min(MAX_TEXTURE_WIDTH, Math.max(2048, Math.round(viewportWidth * dpr * 1.5)));
    const transform = `f_auto,q_auto,c_limit,w_${targetWidth}`;
    return url.replace('/image/upload/', `/image/upload/${transform}/`);
  } catch {
    return url;
  }
}

/** Cap the texture size and disable mipmaps to keep mobile GPUs responsive. */
function prepareTexture(texture: THREE.Texture): THREE.Texture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const image = texture.image as { width?: number; height?: number } | undefined;
  if (!image?.width || !image.height || image.width <= MAX_TEXTURE_WIDTH) {
    return texture;
  }

  const scale = MAX_TEXTURE_WIDTH / image.width;
  const canvas = document.createElement('canvas');
  canvas.width = MAX_TEXTURE_WIDTH;
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return texture;

  try {
    ctx.drawImage(image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  } catch {
    return texture;
  }

  const optimized = new THREE.CanvasTexture(canvas);
  optimized.colorSpace = THREE.SRGBColorSpace;
  optimized.generateMipmaps = false;
  optimized.minFilter = THREE.LinearFilter;
  optimized.needsUpdate = true;
  texture.dispose();
  return optimized;
}

type TextureState =
  | { status: 'loading'; progress: number }
  | { status: 'ready'; texture: THREE.Texture }
  | { status: 'error'; message: string };

function usePanoramaTexture(url: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<TextureState>(() => {
    const cached = textureCache.get(optimizedPanoramaUrl(url));
    return cached ? { status: 'ready', texture: cached } : { status: 'loading', progress: 0 };
  });

  useEffect(() => {
    const source = optimizedPanoramaUrl(url);
    const cached = textureCache.get(source);
    if (cached) {
      setState({ status: 'ready', texture: cached });
      return;
    }

    let cancelled = false;
    let settled = false;
    setState({ status: 'loading', progress: 0 });

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    const timeout = window.setTimeout(() => {
      if (!cancelled && !settled) {
        settled = true;
        setState({
          status: 'error',
          message: 'La imagen 360° tardó demasiado en cargar. Revisa tu conexión e inténtalo de nuevo.',
        });
      }
    }, LOAD_TIMEOUT_MS);

    loader.load(
      source,
      (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        const ready = prepareTexture(texture);
        textureCache.set(source, ready);
        setState({ status: 'ready', texture: ready });
      },
      (event) => {
        if (cancelled || settled) return;
        if (event.lengthComputable && event.total > 0) {
          setState({
            status: 'loading',
            progress: Math.min(99, Math.round((event.loaded / event.total) * 100)),
          });
        }
      },
      () => {
        if (cancelled) return;
        settled = true;
        window.clearTimeout(timeout);
        setState({
          status: 'error',
          message: 'No se pudo cargar la imagen 360°. Revisa tu conexión e inténtalo de nuevo.',
        });
      },
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [url, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, retry };
}

/**
 * Imperative three.js panorama. The R3F Canvas relies on a ResizeObserver
 * measurement that can be skipped when it mounts inside a Swiper slide, which
 * left the canvas stuck at its default 300x150 size. A plain renderer lets us
 * size it directly and keeps the panorama responsive on resize/orientation.
 */
function PanoramaScene({ texture }: { texture: THREE.Texture }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1100);
    camera.position.set(0, 0, 0.1);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(500, 64, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    let width = 0;
    let height = 0;
    let lon = 0;
    let lat = 0;
    let dragging = false;
    let pointerX = 0;
    let pointerY = 0;
    let idleSince = 0;
    let frameId = 0;
    let previousTime = performance.now();

    const resize = () => {
      const nextWidth = host.clientWidth;
      const nextHeight = host.clientHeight;
      if (!nextWidth || !nextHeight) return;
      width = nextWidth;
      height = nextHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      pointerX = event.clientX;
      pointerY = event.clientY;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const deltaX = event.clientX - pointerX;
      const deltaY = event.clientY - pointerY;
      pointerX = event.clientX;
      pointerY = event.clientY;
      lon -= deltaX * 0.15;
      lat = Math.max(-85, Math.min(85, lat + deltaY * 0.15));
    };

    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      idleSince = performance.now();
      if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerUp);

    const animate = () => {
      const now = performance.now();
      const delta = Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now;

      if (!dragging && now - idleSince > 2500) {
        lon += delta * 1.5;
      }

      if (width > 0 && height > 0) {
        const phi = THREE.MathUtils.degToRad(90 - lat);
        const theta = THREE.MathUtils.degToRad(lon);
        camera.lookAt(
          500 * Math.sin(phi) * Math.cos(theta),
          500 * Math.cos(phi),
          500 * Math.sin(phi) * Math.sin(theta),
        );
        renderer.render(scene, camera);
      }

      frameId = requestAnimationFrame(animate);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    window.addEventListener('orientationchange', resize);

    idleSince = performance.now();
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', resize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerUp);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [texture]);

  return <div ref={hostRef} className="absolute inset-0" />;
}

export function Viewer360({ url, className = "" }: { url: string; className?: string }) {
  const { state, retry } = usePanoramaTexture(url);

  return (
    <div className={`swiper-no-swiping relative h-full w-full touch-none select-none overflow-hidden bg-black ${className}`}>
      {state.status === 'ready' && <PanoramaScene texture={state.texture} />}

      {state.status === 'loading' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">
            {state.progress > 0 ? `Cargando panorama… ${state.progress}%` : 'Cargando panorama 360°…'}
          </p>
          {state.progress > 0 && (
            <div className="h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {state.status === 'error' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center text-white">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="max-w-xs text-sm text-white/80">{state.message}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-20">
          <div className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 0 1 9-9"/></svg>
            360°
          </div>
        </div>
      )}
    </div>
  );
}
