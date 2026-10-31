import {
  forwardRef,
  useRef,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Solid-surface material.
 *
 * The previous liquid-glass implementation painted a real GPU refraction
 * (SVG backdrop filter + WebGL canvas per surface). It looked great but the
 * compositing cost made mid-range phones and integrated GPUs stutter. The
 * surfaces now render as opaque, theme-aware solid colours; the component API
 * is unchanged so every call site keeps its layout and motion.
 */

type LiquidGlassProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * `regular` is the control/navigation material.
   * `clear` is the lighter floating variant for media.
   * `inline` is for content inside another surface (no extra layer).
   */
  variant?: "regular" | "clear" | "inline";
  strong?: boolean;
  hover?: boolean;
  /** Kept for API compatibility; solid surfaces do not refract. */
  refract?: boolean;
  /** Smoked tint for dark editorial surfaces. */
  ink?: boolean;
  /** Tracks the pointer to move the specular highlight. */
  interactive?: boolean;
};

/**
 * Kept as a no-op so existing imports keep working. There is no SVG filter
 * host anymore.
 */
export function LiquidGlassDefs() {
  return null;
}

export const LiquidGlass = forwardRef<HTMLDivElement, LiquidGlassProps>(function LiquidGlass(
  {
    className,
    variant = "regular",
    strong,
    hover,
    refract: _refract,
    ink,
    interactive,
    children,
    onPointerMove,
    ...props
  },
  forwardedRef,
) {
  const localRef = useRef<HTMLDivElement | null>(null);

  const setRef = (node: HTMLDivElement | null) => {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) (forwardedRef as { current: HTMLDivElement | null }).current = node;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (!interactive || event.pointerType === "touch") return;
    const node = localRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    node.style.setProperty("--lg-mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    node.style.setProperty("--lg-my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  };

  return (
    <div
      ref={setRef}
      onPointerMove={handlePointerMove}
      className={cn(
        "liquid-glass",
        variant === "clear" && "liquid-glass--clear",
        variant === "inline" && "liquid-glass--inline",
        strong && "liquid-glass--strong",
        hover && "liquid-glass--hover",
        ink && "liquid-glass--ink",
        interactive && "liquid-glass--interactive",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export default LiquidGlass;
