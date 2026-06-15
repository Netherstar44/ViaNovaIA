import React, { useEffect, useState, useRef } from "react";
import { RotateCcw, Move, Maximize2, Minimize2 } from "lucide-react";

interface Model3DViewerProps {
  modelUrl: string;
  title?: string;
}

export const Model3DViewer: React.FC<Model3DViewerProps> = ({ modelUrl, title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Dynamically load model-viewer only when this component mounts
    import("@google/model-viewer")
      .then(() => setLoading(false))
      .catch(() => {
        setError("Error al inicializar el cargador 3D.");
        setLoading(false);
      });
  }, []);

  // Fullscreen state sync
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  const handleResetCamera = () => {
    const mv = containerRef.current?.querySelector("model-viewer") as any;
    if (mv) {
      mv.cameraOrbit = "0deg 75deg auto";
      mv.cameraTarget = "auto auto auto";
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative bg-slate-950 transition-all duration-300 shadow-xl overflow-hidden ${
        isFullscreen
          ? "fixed inset-0 z-[9999] w-screen h-screen rounded-none flex items-center justify-center"
          : "w-full h-[450px] rounded-xl border border-slate-800"
      }`}
    >
      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="mt-4 text-slate-300 font-medium text-sm">Inicializando Motor 3D...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95 z-20">
          <div className="text-red-500 text-3xl mb-3">⚠️</div>
          <p className="text-slate-300 font-semibold mb-2">{error}</p>
          <span className="text-slate-500 text-xs break-all max-w-xs">{modelUrl}</span>
        </div>
      )}

      {/* Model Viewer — fills the entire container */}
      {!loading && !error &&
        React.createElement(
          "model-viewer",
          {
            src: modelUrl,
            alt: title || "Modelo 3D interactivo",
            ar: true,
            "ar-modes": "webxr scene-viewer quick-look",
            "camera-controls": true,
            "auto-rotate": true,
            "shadow-intensity": "1.5",
            "shadow-softness": "0.8",
            exposure: "1.0",
            "interaction-prompt": "auto",
            loading: "eager",
            crossorigin: "anonymous",
            style: {
              width: "100%",
              height: "100%",
              outline: "none",
              display: "block",
              position: "absolute",
              inset: 0,
            },
          },
          // Progress bar slot
          React.createElement(
            "div",
            {
              slot: "progress-bar",
              className: "absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-10",
            },
            React.createElement("div", {
              className: "w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin",
            }),
            React.createElement(
              "span",
              { className: "mt-3 text-slate-300 text-xs font-medium" },
              "Cargando archivo 3D..."
            )
          )
        )
      }

      {/* Floating Controls */}
      {!loading && !error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-slate-900/85 backdrop-blur-md rounded-full border border-slate-700 shadow-2xl z-10">
          <button
            type="button"
            onClick={handleResetCamera}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-full transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Resetear Cámara"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Centrar</span>
          </button>
          <div className="w-px h-6 bg-slate-700 mx-1" />
          <div className="flex items-center gap-1 text-slate-400 text-[10px] uppercase font-semibold tracking-wider">
            <Move className="w-3.5 h-3.5 text-slate-500" />
            <span>Arrastrar para rotar</span>
          </div>
          <div className="w-px h-6 bg-slate-700 mx-1" />
          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-full transition-colors"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Title badge */}
      {title && !loading && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-md border border-slate-800 text-slate-200 text-xs font-semibold z-10 uppercase tracking-wide">
          Modelo 3D • {title}
        </div>
      )}
    </div>
  );
};
