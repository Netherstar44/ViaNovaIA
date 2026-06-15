import React, { useEffect, useRef, useState, useCallback } from "react";
import { Glasses, RefreshCw, Maximize2, Minimize2 } from "lucide-react";

interface VRViewerProps {
  mediaUrl: string;
  title?: string;
  isStereoscopicDefault?: boolean;
}

export const VRViewer: React.FC<VRViewerProps> = ({ mediaUrl, title, isStereoscopicDefault = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isVrMode, setIsVrMode] = useState(isStereoscopicDefault);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Three.js refs
  const THREE = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraLeftRef = useRef<any>(null);
  const cameraRightRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const isVrModeRef = useRef(isVrMode);

  // Control vars
  const isUserInteracting = useRef(false);
  const onPointerDownMouseX = useRef(0);
  const onPointerDownMouseY = useRef(0);
  const lon = useRef(0);
  const onPointerDownLon = useRef(0);
  const lat = useRef(0);
  const onPointerDownLat = useRef(0);
  const phi = useRef(0);
  const theta = useRef(0);
  const targetFov = useRef(75);

  // Gyroscope
  const deviceOrientation = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const hasGyro = useRef(false);

  const getSize = useCallback(() => {
    const el = containerRef.current;
    if (!el) return { w: 800, h: 450 };
    return { w: el.clientWidth || 800, h: el.clientHeight || 450 };
  }, []);

  // Keep isVrMode ref in sync
  useEffect(() => {
    isVrModeRef.current = isVrMode;
  }, [isVrMode]);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
      deviceOrientation.current = { alpha: event.alpha, beta: event.beta, gamma: event.gamma };
    }
  }, []);

  const enableGyro = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      try {
        const state = await (DeviceOrientationEvent as any).requestPermission();
        if (state === "granted") {
          window.addEventListener("deviceorientation", handleOrientation);
          hasGyro.current = true;
        }
      } catch (err) {
        console.warn("Gyroscope permission rejected:", err);
      }
    } else if ("DeviceOrientationEvent" in window) {
      window.addEventListener("deviceorientation", handleOrientation);
      hasGyro.current = true;
    }
  }, [handleOrientation]);

  useEffect(() => {
    enableGyro();
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [enableGyro, handleOrientation]);

  useEffect(() => {
    let destroyed = false;
    let geometry: any;
    let videoEl: HTMLVideoElement | null = null;

    const init = async () => {
      try {
        const three = await import("three");
        if (destroyed) return;
        THREE.current = three;

        if (!containerRef.current || !canvasRef.current) return;
        const { w, h } = getSize();

        // Scene
        const scene = new three.Scene();
        sceneRef.current = scene;

        // Dual cameras
        const ipd = 0.15;
        const cameraLeft = new three.PerspectiveCamera(75, w / h, 1, 1100);
        const cameraRight = new three.PerspectiveCamera(75, w / h, 1, 1100);
        cameraLeft.position.set(-ipd, 0, 0);
        cameraRight.position.set(ipd, 0, 0);
        cameraLeftRef.current = cameraLeft;
        cameraRightRef.current = cameraRight;

        // Renderer
        const renderer = new three.WebGLRenderer({
          canvas: canvasRef.current,
          antialias: true,
          alpha: false,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h, false);
        renderer.autoClear = false;
        rendererRef.current = renderer;

        // Sphere
        geometry = new three.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);

        setLoading(true);
        setError(null);

        const isVideo = mediaUrl.match(/\.(mp4|webm)$/i) || mediaUrl.includes("video/upload");

        if (isVideo) {
          videoEl = document.createElement("video");
          videoEl.src = mediaUrl;
          videoEl.crossOrigin = "anonymous";
          videoEl.loop = true;
          videoEl.muted = true;
          videoEl.playsInline = true;
          videoEl.autoplay = true;
          videoEl.play().catch(() => {});
          const texture = new three.VideoTexture(videoEl);
          texture.colorSpace = three.SRGBColorSpace;
          const material = new three.MeshBasicMaterial({ map: texture });
          scene.add(new three.Mesh(geometry, material));
          if (!destroyed) setLoading(false);
        } else {
          new three.TextureLoader().load(
            mediaUrl,
            (texture: any) => {
              if (destroyed) return;
              texture.colorSpace = three.SRGBColorSpace;
              const material = new three.MeshBasicMaterial({ map: texture });
              scene.add(new three.Mesh(geometry, material));
              setLoading(false);
            },
            undefined,
            () => {
              if (!destroyed) {
                setError("No se pudo cargar la escena VR.");
                setLoading(false);
              }
            }
          );
        }

        // Animation loop
        const animate = () => {
          animFrameRef.current = requestAnimationFrame(animate);
          if (!cameraLeftRef.current || !cameraRightRef.current || !rendererRef.current || !sceneRef.current) return;

          if (hasGyro.current) {
            lon.current = deviceOrientation.current.alpha;
            lat.current = deviceOrientation.current.beta - 90;
          } else {
            lat.current = Math.max(-85, Math.min(85, lat.current));
          }

          phi.current = three.MathUtils.degToRad(90 - lat.current);
          theta.current = three.MathUtils.degToRad(lon.current);

          const target = new three.Vector3(
            500 * Math.sin(phi.current) * Math.cos(theta.current),
            500 * Math.cos(phi.current),
            500 * Math.sin(phi.current) * Math.sin(theta.current)
          );

          cameraLeftRef.current.lookAt(target);
          cameraRightRef.current.lookAt(target);

          if (Math.abs(cameraLeftRef.current.fov - targetFov.current) > 0.1) {
            cameraLeftRef.current.fov += (targetFov.current - cameraLeftRef.current.fov) * 0.1;
            cameraRightRef.current.fov += (targetFov.current - cameraRightRef.current.fov) * 0.1;
            cameraLeftRef.current.updateProjectionMatrix();
            cameraRightRef.current.updateProjectionMatrix();
          }

          const el = containerRef.current;
          const w2 = el?.clientWidth || 800;
          const h2 = el?.clientHeight || 450;

          renderer.clear();
          if (isVrModeRef.current) {
            renderer.setViewport(0, 0, w2 / 2, h2);
            renderer.setScissor(0, 0, w2 / 2, h2);
            renderer.setScissorTest(true);
            renderer.render(sceneRef.current, cameraLeft);
            renderer.setViewport(w2 / 2, 0, w2 / 2, h2);
            renderer.setScissor(w2 / 2, 0, w2 / 2, h2);
            renderer.setScissorTest(true);
            renderer.render(sceneRef.current, cameraRight);
          } else {
            renderer.setViewport(0, 0, w2, h2);
            renderer.setScissorTest(false);
            renderer.render(sceneRef.current, cameraLeft);
          }
        };
        animate();

      } catch (e) {
        if (!destroyed) {
          setError("Error al inicializar el visor VR.");
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      cancelAnimationFrame(animFrameRef.current);
      if (videoEl) { videoEl.pause(); videoEl.src = ""; }
      geometry?.dispose();
      rendererRef.current?.dispose();
    };
  }, [mediaUrl, getSize]);

  // ResizeObserver for proper canvas sizing including fullscreen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (!cameraLeftRef.current || !cameraRightRef.current || !rendererRef.current) return;
      const { w, h } = getSize();
      if (w === 0 || h === 0) return;
      const vrMode = isVrModeRef.current;
      cameraLeftRef.current.aspect = vrMode ? (w / 2) / h : w / h;
      cameraRightRef.current.aspect = vrMode ? (w / 2) / h : w / h;
      cameraLeftRef.current.updateProjectionMatrix();
      cameraRightRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h, false);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [getSize]);

  // Fullscreen state sync
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      requestAnimationFrame(() => {
        if (!rendererRef.current || !cameraLeftRef.current || !cameraRightRef.current) return;
        const { w, h } = getSize();
        const vrMode = isVrModeRef.current;
        cameraLeftRef.current.aspect = vrMode ? (w / 2) / h : w / h;
        cameraRightRef.current.aspect = vrMode ? (w / 2) / h : w / h;
        cameraLeftRef.current.updateProjectionMatrix();
        cameraRightRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h, false);
      });
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, [getSize]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isUserInteracting.current = true;
    onPointerDownMouseX.current = e.clientX;
    onPointerDownMouseY.current = e.clientY;
    onPointerDownLon.current = lon.current;
    onPointerDownLat.current = lat.current;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isUserInteracting.current) return;
    const factor = isVrMode ? 0.25 : 0.15;
    lon.current = (onPointerDownMouseX.current - e.clientX) * factor + onPointerDownLon.current;
    lat.current = (e.clientY - onPointerDownMouseY.current) * factor + onPointerDownLat.current;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isUserInteracting.current = false;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-slate-950 transition-all duration-300 shadow-xl ${
        isFullscreen
          ? "fixed inset-0 z-[9999] w-screen h-screen rounded-none flex items-center justify-center"
          : "w-full h-[450px] rounded-xl border border-slate-800"
      }`}
    >
      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="mt-4 text-slate-300 font-medium text-sm">Cargando Entorno VR...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95 z-20">
          <div className="text-red-500 text-3xl mb-3">⚠️</div>
          <p className="text-slate-300 font-semibold mb-2">{error}</p>
          <span className="text-slate-500 text-xs break-all max-w-xs">{mediaUrl}</span>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing block"
        style={{ display: "block" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Controls */}
      {!loading && !error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-slate-900/85 backdrop-blur-md rounded-full border border-slate-700 shadow-2xl z-10">
          <button
            onClick={() => setIsVrMode(p => !p)}
            className={`p-2 rounded-full transition-colors flex items-center gap-1.5 text-xs font-semibold ${
              isVrMode
                ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                : "text-slate-300 hover:text-cyan-400 hover:bg-slate-800"
            }`}
            title="Toggle Cardboard VR Mode"
          >
            <Glasses className="w-5 h-5" />
            <span>VR {isVrMode ? "On" : "Off"}</span>
          </button>

          <div className="w-px h-6 bg-slate-700 mx-1" />

          <button
            onClick={enableGyro}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-full transition-colors"
            title="Activar Giroscopio"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-full transition-colors"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* Title */}
      {title && !loading && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-md border border-slate-800 text-slate-200 text-xs font-semibold z-10 uppercase tracking-wide">
          VR TOUR • {title}
        </div>
      )}
    </div>
  );
};
