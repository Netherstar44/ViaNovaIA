import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  AlertCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Move,
  Orbit,
  RefreshCw,
  RotateCcw,
  Smartphone,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

const textureCache = new Map<string, THREE.Texture>();
const MAX_TEXTURE_WIDTH = 4096;
const LOAD_TIMEOUT_MS = 30000;
const MIN_FOV = 32;
const MAX_FOV = 100;

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

export type PanoramaControls = {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
};

interface PanoramaSceneProps {
  texture: THREE.Texture;
  autoRotate: boolean;
  gyroEnabled: boolean;
  controlsRef: React.MutableRefObject<PanoramaControls | null>;
  onInteraction?: () => void;
}

/**
 * Imperative three.js panorama. The R3F Canvas relies on a ResizeObserver
 * measurement that can be skipped when it mounts inside a Swiper slide, which
 * left the canvas stuck at its default 300x150 size. A plain renderer lets us
 * size it directly and keeps the panorama responsive on resize/orientation.
 */
function PanoramaScene({ texture, autoRotate, gyroEnabled, controlsRef, onInteraction }: PanoramaSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const autoRotateRef = useRef(autoRotate);
  const gyroRef = useRef(gyroEnabled);
  autoRotateRef.current = autoRotate;
  gyroRef.current = gyroEnabled;

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
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'Vista panorámica 360 grados. Usa las flechas para girar y las teclas más y menos para acercar.');
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
    let fov = 75;
    let targetFov = 75;
    let targetLon = 0;
    let targetLat = 0;
    let dragging = false;
    let velocityLon = 0;
    let velocityLat = 0;
    let pointerX = 0;
    let pointerY = 0;
    let idleSince = 0;
    let lastInteraction = 0;
    let frameId = 0;
    let previousTime = performance.now();
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStartDistance = 0;
    let pinchStartFov = 75;

    const clampFov = (value: number) => Math.max(MIN_FOV, Math.min(MAX_FOV, value));

    const markInteraction = () => {
      lastInteraction = performance.now();
      idleSince = performance.now();
      onInteraction?.();
    };

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
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        dragging = true;
        pointerX = event.clientX;
        pointerY = event.clientY;
        velocityLon = 0;
        velocityLat = 0;
        renderer.domElement.focus({ preventScroll: true });
      } else if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        pinchStartDistance = Math.hypot(a.x - b.x, a.y - b.y);
        pinchStartFov = targetFov;
      }
      markInteraction();
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size >= 2) {
        const [a, b] = Array.from(pointers.values());
        const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        if (pinchStartDistance > 0) {
          targetFov = clampFov(pinchStartFov * (pinchStartDistance / distance));
        }
        markInteraction();
        return;
      }

      if (!dragging) return;
      const deltaX = event.clientX - pointerX;
      const deltaY = event.clientY - pointerY;
      pointerX = event.clientX;
      pointerY = event.clientY;

      const sensitivity = 0.16 * (fov / 75);
      lon -= deltaX * sensitivity;
      lat = Math.max(-85, Math.min(85, lat + deltaY * sensitivity));
      targetLon = lon;
      targetLat = lat;
      velocityLon = -deltaX * sensitivity * 0.55;
      velocityLat = deltaY * sensitivity * 0.55;
      markInteraction();
    };

    const endPointer = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchStartDistance = 0;
      if (pointers.size === 0) {
        dragging = false;
        idleSince = performance.now();
      }
      if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      targetFov = clampFov(targetFov + Math.sign(event.deltaY) * 6);
      markInteraction();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const step = fov / 18;
      if (event.key === 'ArrowLeft') { lon += step; targetLon = lon; }
      else if (event.key === 'ArrowRight') { lon -= step; targetLon = lon; }
      else if (event.key === 'ArrowUp') { lat = Math.max(-85, lat - step); targetLat = lat; }
      else if (event.key === 'ArrowDown') { lat = Math.min(85, lat + step); targetLat = lat; }
      else if (event.key === '+' || event.key === '=') targetFov = clampFov(targetFov - 8);
      else if (event.key === '-' || event.key === '_') targetFov = clampFov(targetFov + 8);
      else if (event.key === '0') { lon = 0; lat = 0; targetLon = 0; targetLat = 0; targetFov = 75; }
      else return;
      event.preventDefault();
      markInteraction();
    };

    const onDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (!gyroRef.current) return;
      if (event.alpha === null || event.beta === null) return;
      const orientation = (screen.orientation?.angle ?? 0) as number;
      targetLon = -event.alpha - orientation;
      targetLat = Math.max(-80, Math.min(80, (event.beta || 0) - 90));
      lon = targetLon;
      lat = targetLat;
      markInteraction();
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', endPointer);
    renderer.domElement.addEventListener('pointercancel', endPointer);
    renderer.domElement.addEventListener('pointerleave', endPointer);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('keydown', onKeyDown);
    window.addEventListener('deviceorientation', onDeviceOrientation);

    const animate = () => {
      const now = performance.now();
      const delta = Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now;

      if (!dragging) {
        if (Math.abs(velocityLon) > 0.01 || Math.abs(velocityLat) > 0.01) {
          lon += velocityLon;
          lat = Math.max(-85, Math.min(85, lat + velocityLat));
          velocityLon *= 0.93;
          velocityLat *= 0.93;
          targetLon = lon;
          targetLat = lat;
        } else if (autoRotateRef.current && !gyroRef.current && now - idleSince > 2200) {
          lon += delta * 2.2;
          targetLon = lon;
        } else if (gyroRef.current) {
          lon += (targetLon - lon) * 0.18;
          lat += (targetLat - lat) * 0.18;
        }
      }

      fov += (targetFov - fov) * 0.18;
      if (Math.abs(targetFov - fov) < 0.05) fov = targetFov;

      if (width > 0 && height > 0) {
        const phi = THREE.MathUtils.degToRad(90 - lat);
        const theta = THREE.MathUtils.degToRad(lon);
        camera.lookAt(
          500 * Math.sin(phi) * Math.cos(theta),
          500 * Math.cos(phi),
          500 * Math.sin(phi) * Math.sin(theta),
        );
        if (Math.abs(camera.fov - fov) > 0.01) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
        renderer.render(scene, camera);
      }

      frameId = requestAnimationFrame(animate);
    };

    controlsRef.current = {
      zoomIn: () => { targetFov = clampFov(targetFov - 10); markInteraction(); },
      zoomOut: () => { targetFov = clampFov(targetFov + 10); markInteraction(); },
      reset: () => {
        lon = 0; lat = 0; targetLon = 0; targetLat = 0; targetFov = 75;
        velocityLon = 0; velocityLat = 0;
        markInteraction();
      },
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    window.addEventListener('orientationchange', resize);

    idleSince = performance.now();
    lastInteraction = performance.now();
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', resize);
      window.removeEventListener('deviceorientation', onDeviceOrientation);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', endPointer);
      renderer.domElement.removeEventListener('pointercancel', endPointer);
      renderer.domElement.removeEventListener('pointerleave', endPointer);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('keydown', onKeyDown);
      controlsRef.current = null;
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // onInteraction is intentionally read through a ref-like closure: it only
    // hides the first-use hint, so it does not need to rebuild the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture]);

  return <div ref={hostRef} className="absolute inset-0" />;
}

type Viewer360Props = {
  url: string;
  className?: string;
  caption?: string | null;
  /** Show the full control HUD. Disable for small thumbnails. */
  controls?: boolean;
};

export function Viewer360({ url, className = '', caption, controls = true }: Viewer360Props) {
  const { state, retry } = usePanoramaTexture(url);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<PanoramaControls | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroSupported, setGyroSupported] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setGyroSupported('DeviceOrientationEvent' in window);
  }, []);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const timer = window.setTimeout(() => setHintVisible(false), 4500);
    return () => window.clearTimeout(timer);
  }, [state.status]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    const host = wrapperRef.current;
    if (!host) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await host.requestFullscreen?.();
      }
    } catch {
      // iOS Safari may block elements without a video element; ignore.
    }
  };

  const toggleGyro = async () => {
    if (!gyroSupported) return;
    if (!gyroEnabled) {
      const orientation = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof orientation.requestPermission === 'function') {
        try {
          const permission = await orientation.requestPermission();
          if (permission !== 'granted') return;
        } catch {
          return;
        }
      }
    }
    setGyroEnabled((value) => !value);
    setAutoRotate(false);
    setHintVisible(false);
  };

  const showControls = controls && state.status === 'ready';

  return (
    <div
      ref={wrapperRef}
      className={`swiper-no-swiping relative h-full w-full touch-none select-none overflow-hidden bg-black ${className}`}
    >
      {state.status === 'ready' && (
        <PanoramaScene
          texture={state.texture}
          autoRotate={autoRotate}
          gyroEnabled={gyroEnabled}
          controlsRef={controlsRef}
          onInteraction={() => setHintVisible(false)}
        />
      )}

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
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      )}

      {showControls && (
        <>
          <div className="liquid-glass-chip pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1f1f1f]/85">
            <Orbit className="h-3.5 w-3.5 text-[#a87c00]" />
            360°
            {caption && <span className="max-w-[14rem] truncate normal-case tracking-normal text-[#1f1f1f]/60">{caption}</span>}
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="liquid-glass-chip absolute right-3 top-3 z-20 rounded-full p-2 text-[#1f1f1f]/80 transition hover:text-[#1f1f1f]"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5">
            {[
              { key: 'zoom-in', label: 'Acercar', icon: ZoomIn, onClick: () => controlsRef.current?.zoomIn(), active: false },
              { key: 'zoom-out', label: 'Alejar', icon: ZoomOut, onClick: () => controlsRef.current?.zoomOut(), active: false },
              {
                key: 'autorotate',
                label: autoRotate ? 'Pausar giro automático' : 'Girar automáticamente',
                icon: RotateCcw,
                onClick: () => { setAutoRotate((value) => !value); setGyroEnabled(false); },
                active: autoRotate,
              },
              ...(gyroSupported
                ? [{
                    key: 'gyro',
                    label: gyroEnabled ? 'Desactivar giroscopio' : 'Usar giroscopio',
                    icon: Smartphone,
                    onClick: () => void toggleGyro(),
                    active: gyroEnabled,
                  }]
                : []),
              { key: 'reset', label: 'Centrar vista', icon: Orbit, onClick: () => controlsRef.current?.reset(), active: false },
            ].map(({ key, label, icon: Icon, onClick, active }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                aria-label={label}
                aria-pressed={key === 'gyro' || key === 'autorotate' ? active : undefined}
                title={label}
                className={`liquid-glass-chip rounded-full p-2 transition ${
                  active
                    ? 'liquid-glass-chip--tint'
                    : 'text-[#1f1f1f]/75 hover:text-[#1f1f1f]'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <div
            className={`pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center transition-opacity duration-700 ${
              hintVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="liquid-glass-chip flex items-center gap-2 rounded-md px-3.5 py-1.5 text-[11px] text-[#1f1f1f]/75">
              <Move className="h-3.5 w-3.5 text-[#a87c00]" />
              Arrastra para mirar · pellizca para acercar
            </div>
          </div>
        </>
      )}
    </div>
  );
}
