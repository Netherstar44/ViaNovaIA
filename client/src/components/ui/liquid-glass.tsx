import {
  forwardRef,
  useEffect,
  useRef,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Every surface that paints the glass material. The engine upgrades these to a
 * real GPU backdrop refraction in Chromium; the CSS material remains the
 * frosted fallback everywhere else.
 */
const GLASS_SELECTOR = [
  ".liquid-glass",
  ".glass-panel",
  ".glass-card",
  ".glass-popover",
  ".glass-pill",
  ".glass-nav",
  ".glass-search",
  ".chat-glass",
  ".liquid-glass-chip",
].join(",");

/** Glass-on-glass, scrims and opt-outs never get a second backdrop sample. */
const SKIP_SELECTOR = [
  ".liquid-glass--inline",
  ".glass-inline",
  ".glass-none",
  ".glass-scrim",
  "[data-glass-refract='off']",
].join(",");

const MAP_MAX_SIDE = 480;
const MAP_CACHE_LIMIT = 96;

type RefractionMap = { url: string; maxDisplacement: number };

let refractionSupport: boolean | null = null;

/**
 * Chromium is the only engine that applies an SVG filter to a backdrop today.
 * Safari and Firefox silently ignore the url() pass, so they keep the frosted
 * blur material instead of showing a flat pane.
 */
function supportsBackdropRefraction(): boolean {
  if (refractionSupport !== null) return refractionSupport;
  if (typeof window === "undefined" || typeof CSS === "undefined") return false;

  const ua = navigator.userAgent;
  const isIOSWebKit = /CriOS|FxiOS|EdgiOS/i.test(ua);
  const isFirefox = /Firefox|FxiOS/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/i.test(ua);
  const chromiumFamily = !isIOSWebKit && !isFirefox && !isSafari;

  const canUseUrl = CSS.supports("backdrop-filter", "url(#vianova-probe)");
  const canBlur = CSS.supports("backdrop-filter", "blur(1px)");

  refractionSupport = chromiumFamily && canUseUrl && canBlur;
  return refractionSupport;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseRadius(element: HTMLElement, width: number, height: number): number {
  const raw = getComputedStyle(element).borderTopLeftRadius || "0px";
  const first = raw.split(" ")[0] ?? raw;
  const value = Number.parseFloat(first) || 0;
  const radius = first.includes("%") ? (value / 100) * Math.min(width, height) : value;
  return clamp(radius, 0, Math.min(width, height) / 2);
}

/**
 * Surface height profile of a convex squircle. 0 at the rim, 1 at the inner
 * edge of the bezel. This is the shape that gives the glass its thick,
 * jewel-like rim instead of a flat frosted rectangle.
 */
function squircleHeight(t: number): number {
  return Math.pow(1 - Math.pow(1 - clamp(t, 0, 1), 4), 0.25);
}

/**
 * Traces a ray through the bezel and returns the lateral displacement at each
 * sample. Positive values pull the backdrop inward; the sign is the lens.
 */
function refractionProfile(
  thickness: number,
  bezel: number,
  ior: number,
  samples = 128,
): Float64Array {
  const eta = 1 / ior;
  const profile = new Float64Array(samples);
  const safeBezel = Math.max(bezel, 1);

  for (let index = 0; index < samples; index += 1) {
    const t = index / samples;
    const height = squircleHeight(t);
    const delta = 0.0001;
    const next = squircleHeight(t + delta);
    const slope = (next - height) / delta;
    const magnitude = Math.hypot(slope, 1);
    const nx = -slope / magnitude;
    const ny = -1 / magnitude;
    const dot = ny;
    const k = 1 - eta * eta * (1 - dot * dot);

    if (k < 0) {
      profile[index] = 0;
      continue;
    }

    const sq = Math.sqrt(k);
    const refractedX = -(eta * dot + sq) * nx;
    const refractedY = eta - (eta * dot + sq) * ny;
    if (Math.abs(refractedY) < 1e-5) {
      profile[index] = 0;
      continue;
    }

    profile[index] = (refractedX * (height * safeBezel + thickness)) / refractedY;
  }

  return profile;
}

/**
 * Draws the displacement map. Red is X, green is Y, 128 is neutral.
 *
 * The canvas is intentionally smaller than the element: the map is stretched
 * with preserveAspectRatio=none, and a low-resolution map is indistinguishable
 * because the interior is flat and the lens band is smooth.
 */
function drawDisplacementMap(
  elementWidth: number,
  elementHeight: number,
  radius: number,
  bezel: number,
  profile: Float64Array,
  maxDisplacement: number,
): string {
  const downscale = Math.min(1, MAP_MAX_SIDE / Math.max(elementWidth, elementHeight));
  const width = Math.max(8, Math.round(elementWidth * downscale));
  const height = Math.max(8, Math.round(elementHeight * downscale));
  const scaledRadius = Math.max(0, radius * downscale);
  const scaledBezel = Math.max(1, bezel * downscale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: false });
  if (!context) return "";

  const image = context.createImageData(width, height);
  const data = image.data;
  data.fill(0);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 128;
    data[index + 1] = 128;
    data[index + 2] = 0;
    data[index + 3] = 255;
  }

  const r = Math.min(scaledRadius, Math.min(width, height) / 2);
  const rSq = r * r;
  const rOuterSq = (r + 1) * (r + 1);
  const innerSq = Math.max(r - scaledBezel, 0) ** 2;
  const innerWidth = width - r * 2;
  const innerHeight = height - r * 2;
  const samples = profile.length;
  const normalizer = maxDisplacement || 1;

  for (let y = 0; y < height; y += 1) {
    const localY = y < r ? y - r : y >= height - r ? y - r - innerHeight : 0;

    for (let x = 0; x < width; x += 1) {
      const localX = x < r ? x - r : x >= width - r ? x - r - innerWidth : 0;
      const distanceSq = localX * localX + localY * localY;

      if (distanceSq > rOuterSq || distanceSq < innerSq) continue;

      const distance = Math.sqrt(distanceSq);
      if (distance === 0) continue;

      const fromRim = r - distance;
      const sampleIndex = Math.min(
        Math.max(Math.floor((fromRim / scaledBezel) * samples), 0),
        samples - 1,
      );
      const displacement = profile[sampleIndex] ?? 0;
      if (!displacement) continue;

      // Soften the outermost pixel so the lens does not alias against the rim.
      const opacity =
        distanceSq < rSq
          ? 1
          : 1 - (distance - Math.sqrt(rSq)) / (Math.sqrt(rOuterSq) - Math.sqrt(rSq));
      if (opacity <= 0) continue;

      const cos = localX / distance;
      const sin = localY / distance;
      const dx = (-cos * displacement) / normalizer;
      const dy = (-sin * displacement) / normalizer;
      const offset = (y * width + x) * 4;

      data[offset] = Math.round(128 + dx * 127 * opacity);
      data[offset + 1] = Math.round(128 + dy * 127 * opacity);
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

type GlassRecord = {
  element: HTMLElement;
  id: string;
  filter: SVGFilterElement | null;
  feImage: SVGFEImageElement | null;
  feBlur: SVGFEGaussianBlurElement | null;
  feDisplace: SVGFEDisplacementMapElement | null;
  mapKey: string;
  timer: number | null;
  previousBackdrop: string;
  previousWebkitBackdrop: string;
};

type GlassEngine = {
  start: () => void;
  stop: () => void;
};

function createGlassEngine(definitions: SVGDefsElement): GlassEngine {
  const records = new Map<HTMLElement, GlassRecord>();
  const mapCache = new Map<string, RefractionMap>();
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const record = records.get(entry.target as HTMLElement);
      if (!record) continue;
      scheduleRefresh(record);
    }
  });
  let mutationObserver: MutationObserver | null = null;
  let scanTimer: number | null = null;
  let filterSequence = 0;
  let started = false;
  let active = false;
  let disposed = false;

  const reducedTransparency = window.matchMedia("(prefers-reduced-transparency: reduce)");

  function cacheMap(key: string, map: RefractionMap): RefractionMap {
    mapCache.set(key, map);
    if (mapCache.size > MAP_CACHE_LIMIT) {
      const oldest = mapCache.keys().next().value;
      if (typeof oldest === "string") mapCache.delete(oldest);
    }
    return map;
  }

  function buildMap(
    elementWidth: number,
    elementHeight: number,
    radius: number,
    bezel: number,
    thickness: number,
    ior: number,
  ): RefractionMap {
    const key = [
      elementWidth,
      elementHeight,
      radius.toFixed(2),
      bezel.toFixed(2),
      thickness.toFixed(2),
      ior.toFixed(2),
    ].join("|");

    const cached = mapCache.get(key);
    if (cached) return cached;

    const profile = refractionProfile(thickness, bezel, ior);
    let maxDisplacement = 0;
    for (let index = 0; index < profile.length; index += 1) {
      maxDisplacement = Math.max(maxDisplacement, Math.abs(profile[index]));
    }
    maxDisplacement = maxDisplacement || 1;

    const url = drawDisplacementMap(
      elementWidth,
      elementHeight,
      radius,
      bezel,
      profile,
      maxDisplacement,
    );
    if (!url) return { url: "", maxDisplacement };
    return cacheMap(key, { url, maxDisplacement });
  }

  function makeFilter(record: GlassRecord): void {
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.setAttribute("id", record.id);
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", "100%");
    filter.setAttribute("height", "100%");
    // A linearRGB filter remaps the neutral 128 of the map and injects a
    // constant displacement. sRGB keeps the center perfectly still.
    filter.setAttribute("color-interpolation-filters", "sRGB");

    const blur = document.createElementNS(SVG_NS, "feGaussianBlur");
    blur.setAttribute("in", "SourceGraphic");
    blur.setAttribute("result", "blurred");

    const image = document.createElementNS(SVG_NS, "feImage");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("result", "map");

    const displacement = document.createElementNS(SVG_NS, "feDisplacementMap");
    displacement.setAttribute("in", "blurred");
    displacement.setAttribute("in2", "map");
    displacement.setAttribute("xChannelSelector", "R");
    displacement.setAttribute("yChannelSelector", "G");
    displacement.setAttribute("result", "refracted");

    filter.append(blur, image, displacement);
    definitions.appendChild(filter);

    record.filter = filter;
    record.feImage = image;
    record.feBlur = blur;
    record.feDisplace = displacement;
  }

  function writeInlineFilter(record: GlassRecord, cssFilter: string): void {
    const { element } = record;
    if (element.style.getPropertyValue("backdrop-filter") === cssFilter) return;
    if (!record.previousBackdrop) {
      record.previousBackdrop = element.style.getPropertyValue("backdrop-filter");
      record.previousWebkitBackdrop = element.style.getPropertyValue("-webkit-backdrop-filter");
    }
    element.style.setProperty("-webkit-backdrop-filter", cssFilter);
    element.style.setProperty("backdrop-filter", cssFilter);
    element.dataset.glassRefract = "on";
  }

  function refresh(record: GlassRecord): void {
    if (disposed || !record.element.isConnected) return;

    const { element } = record;
    const width = Math.round(element.offsetWidth);
    const height = Math.round(element.offsetHeight);
    if (width < 4 || height < 4) return;

    const style = getComputedStyle(element);
    const minSide = Math.min(width, height);
    const declaredRadius = parseRadius(element, width, height);
    // Edge-to-edge bars have no radius of their own, but the lens still needs a
    // curved profile or the map comes out completely neutral and the bar looks
    // like flat frosted plastic. A shallow synthetic curve at the short ends
    // reads as a real bevel without visibly rounding the bar itself.
    const radius =
      declaredRadius > 0 ? declaredRadius : clamp(minSide * 0.4, 10, minSide / 2);

    const cssScale = Number.parseFloat(style.getPropertyValue("--lg-refract-scale"));
    const boost = Number.isFinite(cssScale) && cssScale > 0 ? cssScale : 1;
    const cssBlur = Number.parseFloat(style.getPropertyValue("--lg-refract-blur"));
    const materialBlur = Number.parseFloat(style.getPropertyValue("--lg-blur"));
    const cssBezel = Number.parseFloat(style.getPropertyValue("--lg-refract-bezel"));

    const bezel = clamp(
      Number.isFinite(cssBezel) && cssBezel > 0 ? cssBezel : minSide * 0.16,
      6,
      Math.max(6, Math.min(46, minSide / 2 - 1)),
    );
    const thickness = clamp(bezel * 1.9, 10, 84);
    // The inner blur must match the material's own frost. Deriving it from the
    // short side turned the nav and the chips into a 7px blur, which read as a
    // tinted plastic sheet instead of glass.
    const blur = clamp(
      Number.isFinite(cssBlur) && cssBlur > 0
        ? cssBlur
        : Number.isFinite(materialBlur) && materialBlur > 0
          ? materialBlur
          : minSide * 0.14,
      7,
      30,
    );
    const ior = 2.1;

    const map = buildMap(width, height, radius, bezel, thickness, ior);
    if (!map.url) return;

    const mapKey = map.url;
    // The raw ray-traced profile can ask for more than a hundred pixels at the
    // rim of a large pane, which reads as a funhouse mirror. Calibrated glass
    // shifts roughly half the bezel width at the outer edge, so cap the
    // feDisplacementMap scale instead of letting the geometry run away.
    const scale = Math.min(map.maxDisplacement, Math.max(8, bezel * 1.1)) * boost;

    if (!record.filter || !record.feImage || !record.feBlur || !record.feDisplace) {
      makeFilter(record);
    }

    if (!record.feImage || !record.feBlur || !record.feDisplace) return;

    if (record.mapKey !== mapKey) {
      record.feImage.setAttribute("href", map.url);
      record.feImage.setAttribute("width", String(width));
      record.feImage.setAttribute("height", String(height));
      record.mapKey = mapKey;
    }

    record.feBlur.setAttribute("stdDeviation", blur.toFixed(2));
    record.feDisplace.setAttribute("scale", scale.toFixed(2));

    const cssFilter = `url("#${record.id}") saturate(1.55) brightness(1.05)`;
    writeInlineFilter(record, cssFilter);
  }

  function scheduleRefresh(record: GlassRecord): void {
    if (record.timer !== null) window.clearTimeout(record.timer);
    record.timer = window.setTimeout(() => {
      record.timer = null;
      refresh(record);
    }, 90);
  }

  function unregister(element: HTMLElement): void {
    const record = records.get(element);
    if (!record) return;
    resizeObserver.unobserve(element);
    if (record.timer !== null) window.clearTimeout(record.timer);
    record.filter?.remove();
    element.style.removeProperty("-webkit-backdrop-filter");
    element.style.removeProperty("backdrop-filter");
    if (record.previousBackdrop) {
      element.style.setProperty("backdrop-filter", record.previousBackdrop);
    }
    if (record.previousWebkitBackdrop) {
      element.style.setProperty("-webkit-backdrop-filter", record.previousWebkitBackdrop);
    }
    delete element.dataset.glassRefract;
    records.delete(element);
  }

  function shouldSkip(element: HTMLElement): boolean {
    if (element.closest(SKIP_SELECTOR)) return true;
    if (element.getAttribute("aria-hidden") === "true") return true;
    return false;
  }

  function register(element: HTMLElement): void {
    if (disposed || records.has(element) || shouldSkip(element)) return;
    const record: GlassRecord = {
      element,
      id: `vianova-glass-${++filterSequence}`,
      filter: null,
      feImage: null,
      feBlur: null,
      feDisplace: null,
      mapKey: "",
      timer: null,
      previousBackdrop: "",
      previousWebkitBackdrop: "",
    };
    records.set(element, record);
    resizeObserver.observe(element);
    refresh(record);
  }

  function scan(): void {
    if (disposed || !active) return;
    const elements = document.querySelectorAll<HTMLElement>(GLASS_SELECTOR);
    for (const element of elements) register(element);
    for (const element of records.keys()) {
      if (!element.isConnected) unregister(element);
    }
  }

  function scheduleScan(): void {
    if (disposed || !active) return;
    if (scanTimer !== null) window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      scanTimer = null;
      scan();
    }, 120);
  }

  function applyMode(): void {
    active = supportsBackdropRefraction() && !reducedTransparency.matches;
    document.documentElement.dataset.liquidGlass = active ? "on" : "fallback";

    if (!active) {
      for (const element of records.keys()) unregister(element);
      return;
    }

    scan();
  }

  function start(): void {
    if (started || disposed) return;
    started = true;

    // Accessibility and viewport listeners outlive the supported/unsupported
    // decision: a browser can keep the same CSS support while the user flips
    // reduced transparency, and we must react in both directions.
    reducedTransparency.addEventListener("change", applyMode);
    window.addEventListener("resize", scheduleScan, { passive: true });
    window.addEventListener("orientationchange", scheduleScan, { passive: true });

    mutationObserver = new MutationObserver(scheduleScan);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      // Never watch `style`: the engine writes the inline backdrop-filter and
      // interactive glass moves its sheen through CSS variables, so watching it
      // would re-scan on every pointer move and every refresh.
      attributeFilter: ["class"],
    });

    applyMode();
    if (!active) return;

    // Images, fonts and late React trees change the geometry; re-measure once
    // those settle without watching every frame.
    window.setTimeout(scan, 220);
    window.setTimeout(scan, 900);
    document.fonts?.ready.then(scheduleScan).catch(() => undefined);
  }

  function stop(): void {
    disposed = true;
    started = false;
    mutationObserver?.disconnect();
    mutationObserver = null;
    if (scanTimer !== null) window.clearTimeout(scanTimer);
    scanTimer = null;
    window.removeEventListener("resize", scheduleScan);
    window.removeEventListener("orientationchange", scheduleScan);
    reducedTransparency.removeEventListener("change", applyMode);

    for (const element of [...records.keys()]) unregister(element);
    mapCache.clear();
    delete document.documentElement.dataset.liquidGlass;
  }

  return { start, stop };
}

/**
 * Renders the SVG filter host and installs the refraction engine.
 * Mount once, near the root of the app.
 */
export function LiquidGlassDefs() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const defsRef = useRef<SVGDefsElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !defsRef.current) return undefined;
    const engine = createGlassEngine(defsRef.current);
    engine.start();
    return () => engine.stop();
  }, []);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      focusable="false"
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <defs ref={defsRef} />
    </svg>
  );
}

type LiquidGlassProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * `regular` is the control/navigation material.
   * `clear` is the lighter floating variant for media.
   * `inline` is for content inside another glass surface (no second blur).
   */
  variant?: "regular" | "clear" | "inline";
  strong?: boolean;
  hover?: boolean;
  /** Boosts the lens displacement on large photographic surfaces. */
  refract?: boolean;
  /** Smoked tint for dark editorial surfaces. */
  ink?: boolean;
  /** Tracks the pointer to move the specular highlight. */
  interactive?: boolean;
};

export const LiquidGlass = forwardRef<HTMLDivElement, LiquidGlassProps>(function LiquidGlass(
  {
    className,
    variant = "regular",
    strong,
    hover,
    refract,
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
        refract && "liquid-glass--refract",
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
