import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import { Link, useLocation } from "wouter";
import { Compass, Globe2, Home, UserRound } from "lucide-react";
import {
  motion,
  animate,
  useMotionValue,
  useReducedMotion,
  useTransform,
  useVelocity,
} from "framer-motion";
import { useAuth } from "@/lib/auth";
import { seoPages } from "@shared/seo-content";
import GlassCanvas from "@/components/ui/GlassCanvas";
import AiSparkIcon from "@/components/ui/AiSparkIcon";
import type { GlassSurfaceHandle } from "@/lib/liquid-glass-webgl";

const PAD = 4;
const GAP = 6;

type DockTab = {
  id: string;
  label: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  ai?: boolean;
};

/**
 * Mobile app dock. It is the primary navigation below 768px, so every tab is a
 * real link or button, the current page is announced with `aria-current`, and
 * the selection indicator is duplicated by the WebGL glass when available.
 */
export default function MobileDock() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();
  const pillRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [metrics, setMetrics] = useState({ width: 0, height: 0 });
  const [glass, setGlass] = useState<GlassSurfaceHandle | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const pointerRef = useRef({ id: -1, startX: 0, startY: 0, x: 0 });

  const profileHref = user?.username ? "/profile" : "/login";

  const tabs = useMemo<DockTab[]>(
    () => [
      { id: "home", label: "Inicio", href: "/", icon: Home },
      { id: "explore", label: "Explorar", href: "/explore", icon: Compass },
      { id: "ai", label: "IA", icon: AiSparkIcon, ai: true },
      { id: "social", label: "Social", href: "/social", icon: Globe2 },
      { id: "profile", label: "Perfil", href: profileHref, icon: UserRound },
    ],
    [profileHref],
  );

  const activeIndex = useMemo(() => {
    const index = tabs.findIndex((tab) => {
      if (!tab.href) return false;
      if (tab.id === "home") return location === "/";
      if (tab.id === "profile") {
        return (
          location === tab.href ||
          location === "/profile" ||
          location.startsWith("/u/") ||
          location === "/dashboard" ||
          location === "/settings"
        );
      }
      return location === tab.href || location.startsWith(`${tab.href}/`);
    });
    return index >= 0 ? index : 0;
  }, [location, tabs]);

  const tabWidth = metrics.width > 0 ? (metrics.width - PAD * 2) / tabs.length : 0;
  const indicatorWidth = Math.max(0, tabWidth - GAP);
  const indicatorHeight = Math.max(0, metrics.height - PAD * 2 - 2);
  const activeX = PAD + activeIndex * tabWidth + GAP / 2;

  const targetX = useMotionValue(activeX);
  const velocity = useVelocity(targetX);
  const stretch = useTransform(velocity, (value) =>
    reducedMotion ? 1 : 1 + Math.min(Math.abs(value) / 1600, 0.16),
  );
  const spring = useMemo(
    () => ({
      type: "spring" as const,
      stiffness: reducedMotion ? 2000 : 280,
      damping: reducedMotion ? 200 : 24,
      mass: 0.9,
    }),
    [reducedMotion],
  );

  // `animate` re-targets even when the value already matches the destination,
  // which matters after a cancelled drag: `set()` alone would be a no-op.
  const settleTo = useCallback(
    (value: number) => {
      animate(targetX, value, spring);
    },
    [spring, targetX],
  );

  useEffect(() => {
    if (tabWidth <= 0) return;
    settleTo(activeX);
  }, [activeX, settleTo, tabWidth]);

  // Callback ref: the dock unmounts while the assistant is open, so the
  // observer has to follow the live node instead of a stale one.
  const attachPill = useCallback((el: HTMLDivElement | null) => {
    pillRef.current = el;
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) {
      setMetrics({ width: 0, height: 0 });
      return;
    }
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setMetrics({ width: rect.width, height: rect.height });
    };
    measure();
    if (!("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  useEffect(() => {
    if (!glass || metrics.width <= 0 || indicatorWidth <= 0) return;
    const update = () => {
      glass.setIndicator(
        targetX.get() + indicatorWidth / 2,
        metrics.height / 2,
        indicatorWidth / 2,
        indicatorHeight / 2,
        indicatorHeight / 2,
      );
    };
    update();
    return targetX.on("change", update);
  }, [glass, indicatorWidth, indicatorHeight, metrics.height, metrics.width, targetX]);

  useEffect(() => {
    const onChatState = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      setChatOpen(Boolean(detail?.open));
    };
    window.addEventListener("vianova:chat-state", onChatState);
    return () => window.removeEventListener("vianova:chat-state", onChatState);
  }, []);

  const openChat = useCallback(() => {
    // The dock hides when the assistant reports `chat-state`, not here: if the
    // lazy chunk ever fails, the navigation must survive.
    window.__vianovaChatRequested = true;
    window.dispatchEvent(new CustomEvent("vianova:open-chat"));
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setLocation(href);
    },
    [setLocation],
  );

  const handleTabClick = useCallback(
    (event: React.MouseEvent, tab: DockTab) => {
      if (suppressClickRef.current) {
        event.preventDefault();
        suppressClickRef.current = false;
        return;
      }
      if (tab.ai) {
        event.preventDefault();
        openChat();
      }
    },
    [openChat],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
    };
    draggingRef.current = false;
    suppressClickRef.current = false;
    // No capturar el puntero: la captura reasigna el `click` al pill y
    // rompería los enlaces del dock. El arrastre horizontal sigue funcionando
    // porque los eventos se emiten sobre los hijos del propio pill.
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current.id !== event.pointerId) return;
    pointerRef.current.x = event.clientX;
    const dx = event.clientX - pointerRef.current.startX;
    const dy = event.clientY - pointerRef.current.startY;
    if (!draggingRef.current) {
      if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
      draggingRef.current = true;
    }
    const el = pillRef.current;
    if (!el || tabWidth <= 0) return;
    const rect = el.getBoundingClientRect();
    const min = PAD + GAP / 2;
    const max = PAD + (tabs.length - 1) * tabWidth + GAP / 2;
    targetX.jump(Math.max(min, Math.min(max, event.clientX - rect.left - tabWidth / 2)));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current.id !== event.pointerId) return;
    pointerRef.current.id = -1;
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const el = pillRef.current;
    if (!el || tabWidth <= 0) return;
    suppressClickRef.current = true;
    const rect = el.getBoundingClientRect();
    const index = Math.max(
      0,
      Math.min(
        tabs.length - 1,
        Math.round((event.clientX - rect.left - PAD - tabWidth / 2) / tabWidth),
      ),
    );
    const tab = tabs[index];
    settleTo(PAD + index * tabWidth + GAP / 2);
    if (tab.ai) openChat();
    else if (tab.href) navigate(tab.href);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current.id !== event.pointerId) return;
    pointerRef.current.id = -1;
    draggingRef.current = false;
    settleTo(activeX);
  };

  const seoSlugs = useMemo(
    () => new Set(seoPages.map((page) => `/${page.slug}`)),
    [],
  );
  const hidden = location === "/login" || seoSlugs.has(location) || chatOpen;
  if (hidden) return null;

  return (
    <>
      <div className="mobile-dock-spacer" aria-hidden="true" />
      <nav className="mobile-dock" aria-label="Menú principal">
        <div
          ref={attachPill}
          className="lg-surface lg-surface--dock mobile-dock__pill"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={handlePointerCancel}
          onLostPointerCapture={handlePointerCancel}
        >
          <GlassCanvas variant="dock" onReady={setGlass} />
          <motion.span
            aria-hidden="true"
            className="lg-dock-indicator"
            style={{
              width: indicatorWidth,
              height: indicatorHeight,
              x: targetX,
              scaleX: stretch,
            }}
          />
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const active = index === activeIndex;
            const content = (
              <>
                <span className="mobile-dock__icon" aria-hidden="true">
                  <Icon className={tab.ai ? "h-6 w-6" : "h-5 w-5"} />
                </span>
                <span className="mobile-dock__label">{tab.label}</span>
              </>
            );
            if (tab.ai) {
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  whileTap={reducedMotion ? undefined : { scale: 1.06 }}
                  className="mobile-dock__tab mobile-dock__tab--ai"
                  data-active={active ? "true" : undefined}
                  aria-label="Abrir el asistente VIANova"
                  onClick={(event) => handleTabClick(event, tab)}
                >
                  {content}
                </motion.button>
              );
            }
            return (
              <motion.div key={tab.id} className="mobile-dock__cell" whileTap={reducedMotion ? undefined : { scale: 1.06 }}>
                <Link
                  href={tab.href ?? "/"}
                  className="mobile-dock__tab"
                  draggable={false}
                  data-active={active ? "true" : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={(event) => handleTabClick(event, tab)}
                >
                  {content}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </nav>
    </>
  );
}
