import React, { useEffect, useRef, useState, useCallback } from "react";
import { Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";

interface Media360ViewerProps {
  imageUrl: string;
  title?: string;
}

export const Media360Viewer: React.FC<Media360ViewerProps> = ({ imageUrl, title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Three.js refs (loaded dynamically)
  const THREE = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);

  // Control variables
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

  const getSize = useCallback(() => {
    const el = containerRef.current;
    if (!el) return { w: 800, h: 450 };
    return { w: el.clientWidth || 800, h: el.clientHeight || 450 };
  }, []);

  useEffect(() => {
    let destroyed = false;
    let geometry: any;

    const init = async () => {
      try {
        // Dynamic import — Three.js only loads when this viewer is opened
        const three = await import("three");
        if (destroyed) return;
        THREE.current = three;

        if (!containerRef.current || !canvasRef.current) return;

        const { w, h } = getSize();

        // Scene
        const scene = new three.Scene();
        sceneRef.current = scene;

        // Camera — start looking forward (lon=0, lat=0)
        const camera = new three.PerspectiveCamera(75, w / h, 1, 1100);
        camera.position.set(0, 0, 0.1);
        cameraRef.current = camera;

        // Renderer
        const renderer = new three.WebGLRenderer({
          canvas: canvasRef.current,
          antialias: true,
          alpha: false,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h, false);
        rendererRef.current = renderer;

        // Sphere geometry (inverted so inside is visible)
        geometry = new three.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);

        const textureLoader = new three.TextureLoader();
        setLoading(true);
        setError(null);

        textureLoader.load(
          imageUrl,
          (texture: any) => {
            if (destroyed) return;
            texture.colorSpace = three.SRGBColorSpace;
            const material = new three.MeshBasicMaterial({ map: texture });
            const sphere = new three.Mesh(geometry, material);
            scene.add(sphere);
            setLoading(false);
          },
          undefined,
          (_err: any) => {
            if (!destroyed) {
              setError("No se pudo cargar la imagen 360°. Verifique el formato e intente de nuevo.");
              setLoading(false);
            }
          }
        );

        // Animation loop
        const animate = () => {
          animFrameRef.current = requestAnimationFrame(animate);
          if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;

          lat.current = Math.max(-85, Math.min(85, lat.current));
          phi.current = three.MathUtils.degToRad(90 - lat.current);
          theta.current = three.MathUtils.degToRad(lon.current);

          const target = new three.Vector3(
            500 * Math.sin(phi.current) * Math.cos(theta.current),
            500 * Math.cos(phi.current),
            500 * Math.sin(phi.current) * Math.sin(theta.current)
          );
          cameraRef.current.lookAt(target);

          // Smooth zoom FOV
          if (Math.abs(cameraRef.current.fov - targetFov.current) > 0.1) {
            cameraRef.current.fov += (targetFov.current - cameraRef.current.fov) * 0.1;
            cameraRef.current.updateProjectionMatrix();
          }

          rendererRef.current.render(sceneRef.current, cameraRef.current);
        };
        animate();

      } catch (e) {
        if (!destroyed) {
          setError("Error al inicializar el visor 360°.");
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      cancelAnimationFrame(animFrameRef.current);
      geometry?.dispose();
      rendererRef.current?.dispose();
    };
  }, [imageUrl]);

  // ResizeObserver — handles container resize including fullscreen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (!cameraRef.current || !rendererRef.current) return;
      const { w, h } = getSize();
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h, false);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [getSize]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      // Force resize after browser repaints
      requestAnimationFrame(() => {
        if (!cameraRef.current || !rendererRef.current || !containerRef.current) return;
        const { w, h } = getSize();
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
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
    lon.current = (onPointerDownMouseX.current - e.clientX) * 0.15 + onPointerDownLon.current;
    lat.current = (e.clientY - onPointerDownMouseY.current) * 0.15 + onPointerDownLat.current;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isUserInteracting.current = false;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    targetFov.current = Math.max(30, Math.min(100, targetFov.current + e.deltaY * 0.05));
  };

  const zoom = (direction: "in" | "out") => {
    const step = 10;
    targetFov.current = Math.max(30, Math.min(100, targetFov.current + (direction === "in" ? -step : step)));
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
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="mt-4 text-slate-300 font-medium text-sm">Cargando Escena 360°...</span>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95 z-20">
          <div className="text-red-500 text-3xl mb-3">⚠️</div>
          <p className="text-slate-300 font-semibold mb-2">{error}</p>
          <span className="text-slate-500 text-xs break-all max-w-xs">{imageUrl}</span>
        </div>
      )}

      {/* Canvas — fills entire container */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing block"
        style={{ display: "block" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Floating Controls */}
      {!loading && !error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-slate-900/85 backdrop-blur-md rounded-full border border-slate-700 shadow-2xl z-10">
          <button
            onClick={() => zoom("in")}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-full transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={() => zoom("out")}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-full transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-slate-700 mx-1" />
          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-full transition-colors"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* Title badge */}
      {title && !loading && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-md border border-slate-800 text-slate-200 text-xs font-semibold z-10 uppercase tracking-wide">
          360° • {title}
        </div>
      )}
    </div>
  );
};
