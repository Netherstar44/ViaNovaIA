import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  glassEngine,
  type GlassSurfaceHandle,
  type GlassSurfaceOptions,
} from "@/lib/liquid-glass-webgl";

type GlassCanvasProps = GlassSurfaceOptions & {
  className?: string;
  onReady?: (handle: GlassSurfaceHandle | null) => void;
};

/**
 * Paints the WebGL liquid-glass material behind its parent surface.
 *
 * The host stays behind the surface content (`z-index:-2`) and is clipped by
 * the surface radius, so no layout or stacking context is changed. When WebGL2
 * is unavailable the host is hidden by CSS and the existing backdrop-filter
 * fallback takes over.
 */
export default function GlassCanvas({
  className,
  onReady,
  ...options
}: GlassCanvasProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const surface = host?.parentElement;
    if (!host || !canvas || !surface) return;

    const handle = glassEngine.register(surface, canvas, options);
    onReadyRef.current?.(handle);
    return () => {
      onReadyRef.current?.(null);
      handle.destroy();
    };
    // The variant is fixed for the lifetime of a surface. Theme and geometry
    // changes are handled by the engine, not by re-registering the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span
      ref={hostRef}
      className={cn("lg-canvas-host", className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="lg-canvas" />
      <span className="lg-tint" />
    </span>
  );
}
