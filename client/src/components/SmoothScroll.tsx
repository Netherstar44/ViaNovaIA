import { useEffect } from "react";
import { useLocation } from "wouter";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

/**
 * Lenis smooth scrolling for the public shell.
 *
 * - Wheel/touch scrolling is interpolated on desktop and touch devices.
 * - Route changes reset the scroll position immediately so a new page never
 *   opens halfway down.
 * - In-page anchors keep the sticky navbar offset.
 * - `prefers-reduced-motion` opts out completely and leaves native scrolling.
 */
export default function SmoothScroll() {
  const [location] = useLocation();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.15,
      syncTouch: false,
    });

    window.__lenis = lenis;

    // The splash locks the document while Lenis is created, so its first
    // measurement can be 0. Re-measure once the overlay is gone and again when
    // every image/font has settled, otherwise the first wheel gesture is dead.
    const refresh = () => lenis.resize();
    const refreshTimer = window.setTimeout(refresh, 400);
    window.addEventListener("load", refresh);

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = window.requestAnimationFrame(raf);
    };
    frame = window.requestAnimationFrame(raf);

    const onAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!target) return;
      const hash = target.getAttribute("href");
      if (!hash || hash === "#") return;
      const node = document.querySelector(hash);
      if (!node) return;
      event.preventDefault();
      lenis.scrollTo(node as HTMLElement, { offset: -96, duration: 1.2 });
      window.history.replaceState(null, "", hash);
    };

    document.addEventListener("click", onAnchorClick);

    return () => {
      document.removeEventListener("click", onAnchorClick);
      window.removeEventListener("load", refresh);
      window.clearTimeout(refreshTimer);
      window.cancelAnimationFrame(frame);
      lenis.destroy();
      delete window.__lenis;
    };
  }, []);

  useEffect(() => {
    window.__lenis?.resize();
    window.__lenis?.scrollTo(0, { immediate: true });
  }, [location]);

  return null;
}
