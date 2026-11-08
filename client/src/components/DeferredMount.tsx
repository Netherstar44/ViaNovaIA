import { useEffect, useRef, useState, type ReactNode } from "react";

interface DeferredMountProps {
  children: ReactNode;
  /** Placeholder while the real content has not been requested yet. */
  fallback?: ReactNode;
  /** How far before entering the viewport the content starts loading. */
  rootMargin?: string;
  className?: string;
}

/**
 * Defers expensive widgets (MapLibre, Three.js) until they are about to be
 * seen. The home page renders its map below the results grid, so mounting it
 * on first paint downloaded ~1.6 MB of JS, a worker and map tiles that the
 * visitor might never reach. The visual result is unchanged: the fallback
 * (usually the same skeleton) stays until the real component mounts.
 */
export default function DeferredMount({
  children,
  fallback = null,
  rootMargin = "480px",
  className = "h-full w-full",
}: DeferredMountProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    if (shouldMount) return;
    const node = containerRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setShouldMount(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldMount(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, shouldMount]);

  return (
    <div ref={containerRef} className={className}>
      {shouldMount ? children : fallback}
    </div>
  );
}
