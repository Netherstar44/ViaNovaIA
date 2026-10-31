import type {
  GlassSurfaceHandle,
  GlassSurfaceOptions,
} from "@/lib/liquid-glass-webgl";

type GlassCanvasProps = GlassSurfaceOptions & {
  className?: string;
  onReady?: (handle: GlassSurfaceHandle | null) => void;
};

/**
 * The WebGL glass canvas was removed for performance. The parent surface now
 * paints a solid theme colour, so this component renders nothing and keeps the
 * same props for backwards compatibility.
 */
export default function GlassCanvas(_props: GlassCanvasProps) {
  return null;
}
