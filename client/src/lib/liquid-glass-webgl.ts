/*
  ViaNova Liquid Glass — WebGL2 engine
  ------------------------------------
  One shared WebGL2 context paints every registered glass surface. Each
  surface owns a 2D canvas, a scene texture and a framebuffer; the engine
  renders the scene + glass passes at the surface's own size and copies the
  result into the visible 2D canvas.

  Why a live reconstruction instead of a DOM snapshot: `html-to-image` needs
  more than eight seconds for the navbar alone, so a real backdrop snapshot
  cannot run on scroll. The painter samples the real same-origin photographs,
  videos and background colours that intersect the surface, plus the theme's
  ambient lights and a vignette. It is refreshed by a dirty-flag pipeline
  (mutations, transitions, animations, video frames, scroll and viewport
  changes) and only while something is moving; at rest the render loop stops.
  The shader (refraction, dispersion, mipmap blur, squircle bevel, specular
  rim) is the one from the reference implementation.
*/

export type GlassVariant =
  | "nav"
  | "search"
  | "panel"
  | "popover"
  | "chat"
  | "orb"
  | "dock";

export type GlassSurfaceOptions = {
  variant?: GlassVariant;
  /** Dark wash over sampled photographs, 0..1. */
  scrim?: number;
  /** Explicit opaque base colour; skips element colour sampling. */
  base?: string;
  /** Strength of the slow ambient glow added by the scene shader. */
  ambient?: number;
  bezel?: number;
  refraction?: number;
  blur?: number;
  dispersion?: number;
  specular?: number;
};

export type GlassSurfaceHandle = {
  readonly canvas: HTMLCanvasElement;
  invalidate: () => void;
  setIndicator: (
    centerX: number,
    centerY: number,
    halfWidth: number,
    halfHeight: number,
    radius: number,
  ) => void;
  clearIndicator: () => void;
  destroy: () => void;
};

type ResolvedOptions = Required<
  Pick<
    GlassSurfaceOptions,
    | "variant"
    | "scrim"
    | "ambient"
    | "bezel"
    | "refraction"
    | "blur"
    | "dispersion"
    | "specular"
  >
> & { base?: string };

type RGBA = { r: number; g: number; b: number; a: number };

type Surface = {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  sceneCanvas: HTMLCanvasElement;
  sceneCtx: CanvasRenderingContext2D;
  opts: ResolvedOptions;
  w: number;
  h: number;
  cssW: number;
  cssH: number;
  dpr: number;
  radius: number;
  tex: WebGLTexture | null;
  sceneTex: WebGLTexture | null;
  fbo: WebGLFramebuffer | null;
  padRect: { left: number; top: number; width: number; height: number };
  ambientA: [number, number, number];
  ambientB: [number, number, number];
  ambientC: [number, number, number];
  indicator: [number, number, number, number, number] | null;
  dirty: boolean;
  sceneDirty: boolean;
  visible: boolean;
  ready: boolean;
  rectDirty: boolean;
  lastRender: number;
  lastScenePaint: number;
  ro: ResizeObserver | null;
  io: IntersectionObserver | null;
  handle: GlassSurfaceHandle;
};

const MAX_GL_WIDTH = 3200;
const MAX_GL_HEIGHT = 1280;
const MAX_SURFACE_PIXELS = 1_100_000;
const MAX_DPR = 2;
const MAX_DPR_MOBILE = 1.5;
const SCROLL_INTERVAL = 1000 / 20;
const BURST_INTERVAL = 1000 / 20;
const BURST_MS = 1200;
const CONTENT_DEBOUNCE = 100;
const QUALITY_STEPS = [1, 0.85, 0.7] as const;

const VARIANT_DEFAULTS: Record<
  GlassVariant,
  Omit<ResolvedOptions, "variant" | "base">
> = {
  nav: {
    scrim: 0.08,
    ambient: 0.45,
    bezel: 16,
    refraction: 0.9,
    blur: 2.4,
    dispersion: 0.1,
    specular: 0.9,
  },
  search: {
    scrim: 0.26,
    ambient: 0.18,
    bezel: 20,
    refraction: 1.15,
    blur: 2.6,
    dispersion: 0.13,
    specular: 1,
  },
  panel: {
    scrim: 0,
    ambient: 0.5,
    bezel: 22,
    refraction: 1.05,
    blur: 2.4,
    dispersion: 0.11,
    specular: 0.95,
  },
  popover: {
    scrim: 0,
    ambient: 0.45,
    bezel: 18,
    refraction: 1,
    blur: 2.2,
    dispersion: 0.1,
    specular: 0.9,
  },
  chat: {
    scrim: 0,
    ambient: 0.3,
    bezel: 26,
    refraction: 1.1,
    blur: 2.8,
    dispersion: 0.12,
    specular: 1,
  },
  orb: {
    scrim: 0,
    ambient: 0.6,
    bezel: 22,
    refraction: 1.2,
    blur: 2.2,
    dispersion: 0.14,
    specular: 1.1,
  },
  dock: {
    scrim: 0.04,
    ambient: 0.5,
    bezel: 20,
    refraction: 1.15,
    blur: 2.4,
    dispersion: 0.12,
    specular: 1,
  },
};

const VERTEX_SHADER = `#version 300 es
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/* Pass 1: the painted backdrop plus a very slow ambient light drift. */
const SCENE_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform float uAmbient;
uniform vec3 uAmbA;
uniform vec3 uAmbB;
uniform vec3 uAmbC;

vec3 blob(vec2 p, vec2 c, float r, vec3 col){
  float d = length(p - c);
  return col * exp(-d * d / (r * r));
}

void main(){
  vec4 tx = texture(uTex, vUv);
  vec3 c = tx.rgb;
  if (uAmbient > 0.001) {
    float asp = uRes.x / max(uRes.y, 1.0);
    vec2 p = (vUv - 0.5) * vec2(asp, 1.0);
    float t = uTime * 0.16;
    vec3 glow = vec3(0.0);
    glow += blob(p, vec2(-0.55 + sin(t * 1.1) * 0.12, 0.25 + cos(t * 0.9) * 0.10), 0.55, uAmbA);
    glow += blob(p, vec2(0.45 + cos(t * 0.8) * 0.14, 0.20 + sin(t * 1.3) * 0.12), 0.50, uAmbB);
    glow += blob(p, vec2(sin(t * 0.7) * 0.20, -0.30 + cos(t * 1.2) * 0.08), 0.55, uAmbC);
    c += glow * uAmbient;
  }
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  o = vec4(c, 1.0);
}`;

/* Pass 2: the reference liquid-glass lens, generalised to one rounded
   surface plus an optional selection indicator. */
const GLASS_SHADER = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uScene;
uniform vec2 uRes;
uniform float uDpr;
uniform vec4 uRect;
uniform float uRectR;
uniform vec4 uInd;
uniform float uIndR;
uniform float uIndOn;
uniform float uBezelA;
uniform float uBezelB;
uniform float uRefr;
uniform float uBlur;
uniform float uDisp;
uniform float uSpec;
uniform float uQuality;
const vec2 L = vec2(-0.6, -0.8);

float sdRB(vec2 p, vec2 hb, float r){
  vec2 q = abs(p) - hb + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float smin(float a, float b, float k){
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float dA(vec2 p){ return sdRB(p - uRect.xy, uRect.zw, uRectR); }
float dB(vec2 p){
  if (uIndOn < 0.5) return 1e4;
  return sdRB(p - uInd.xy, uInd.zw, uIndR);
}
vec2 nrm(vec2 g){
  float l = length(g);
  return l > 1e-4 ? g / l : vec2(0.0, 1.0);
}
vec2 gradA(vec2 p){
  return nrm(vec2(
    dA(p + vec2(1.0, 0.0)) - dA(p - vec2(1.0, 0.0)),
    dA(p + vec2(0.0, 1.0)) - dA(p - vec2(0.0, 1.0))
  ));
}
vec2 gradB(vec2 p){
  return nrm(vec2(
    dB(p + vec2(1.0, 0.0)) - dB(p - vec2(1.0, 0.0)),
    dB(p + vec2(0.0, 1.0)) - dB(p - vec2(0.0, 1.0))
  ));
}
vec2 lens(float d, vec2 g, float bezel){
  float ins = -d;
  if (ins <= 0.0) return vec2(0.0);
  float t = clamp(ins / bezel, 0.0, 1.0);
  float u = 1.0 - t;
  float u3 = u * u * u;
  float a = max(1.0 - u3 * u, 1e-3);
  float h = pow(a, 0.25);
  float s = min(pow(a, -0.75) * u3, 4.0);
  vec3 n = normalize(vec3(g * s, 1.0));
  vec3 r = refract(vec3(0.0, 0.0, -1.0), n, 1.0 / 1.5);
  return r.xy / max(-r.z, 0.2) * bezel * (0.35 + 0.65 * h) * 2.4 * uRefr;
}
vec3 tap(vec2 q, float lod){
  return textureLod(uScene, vec2(q.x / uRes.x, 1.0 - q.y / uRes.y), lod).rgb;
}
vec3 blurAt(vec2 P, float lod, float rad){
  vec3 acc = tap(P, lod);
  int taps = uQuality > 0.8 ? 6 : (uQuality > 0.5 ? 3 : 1);
  for (int i = 0; i < 6; i++){
    if (i >= taps) break;
    float a = float(i) * 2.39996 + 0.7;
    float r = sqrt((float(i) + 0.5) / 6.0) * rad;
    acc += tap(P + vec2(cos(a), sin(a)) * r, lod);
  }
  return acc / float(taps + 1);
}
float specOf(float d, vec2 g){
  float ins = max(-d, 0.0);
  float line = exp(-ins / (1.25 * uDpr));
  float dir = pow(abs(dot(g, L)), 1.5);
  float halo = exp(-ins / (9.0 * uDpr)) * pow(clamp(dot(g, L) * 0.5 + 0.5, 0.0, 1.0), 3.0) * 0.22;
  return (line * (0.25 + 0.95 * dir) + halo) * uSpec;
}

void main(){
  vec2 P = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 base = textureLod(uScene, uv, 0.0).rgb;
  float da = dA(P);
  float db = dB(P);
  float maskA = clamp(0.5 - da, 0.0, 1.0);
  float maskB = clamp(0.5 - db, 0.0, 1.0);
  float sh = exp(-max(dA(P - vec2(0.0, 10.0 * uDpr)), 0.0) / (16.0 * uDpr)) * 0.28 * (1.0 - maskA);
  sh += exp(-max(dB(P - vec2(0.0, 8.0 * uDpr)), 0.0) / (12.0 * uDpr)) * 0.16 * (1.0 - maskB);
  vec3 col = base * (1.0 - min(sh, 0.5));
  float m = max(maskA, maskB);
  if (m > 0.0) {
    vec2 gA = gradA(P);
    vec2 gB = gradB(P);
    vec2 off = lens(da, gA, uBezelA) + lens(db, gB, uBezelB);
    float lod = uBlur * 0.4;
    float rad = uBlur * 1.3 * uDpr;
    vec3 g;
    g.r = blurAt(P + off * (1.0 + uDisp), lod, rad).r;
    g.g = blurAt(P + off, lod, rad).g;
    g.b = blurAt(P + off * (1.0 - uDisp), lod, rad).b;
    float lum = dot(g, vec3(0.299, 0.587, 0.114));
    g = mix(vec3(lum), g, 1.18) * 1.04 + 0.05;
    float insA = max(-da, 0.0);
    float insB = max(-db, 0.0);
    g += exp(-insA / (7.0 * uDpr)) * 0.10 * maskA;
    g += (0.09 + exp(-insB / (6.0 * uDpr)) * 0.12) * maskB;
    g *= 1.0 - 0.10 * exp(-insA / (12.0 * uDpr)) * clamp(-dot(gA, L), 0.0, 1.0) * maskA;
    g += specOf(da, gA) * maskA + specOf(db, gB) * maskB;
    col = mix(col, g, m);
  }
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const isDarkTheme = () => {
  const cl = document.documentElement.classList;
  return (
    cl.contains("dark") ||
    cl.contains("sunset") ||
    cl.contains("ocean") ||
    cl.contains("forest")
  );
};

const fitDpr = (
  cssW: number,
  cssH: number,
  quality: number,
  maxTex: number,
): number => {
  const area = Math.max(1, cssW * cssH);
  const mobile = window.innerWidth < 768;
  let dpr = Math.min(
    window.devicePixelRatio || 1,
    mobile ? MAX_DPR_MOBILE : MAX_DPR,
  );
  dpr *= quality;
  dpr = Math.min(dpr, Math.sqrt(MAX_SURFACE_PIXELS / area));
  dpr = Math.min(dpr, MAX_GL_WIDTH / Math.max(1, cssW));
  dpr = Math.min(dpr, MAX_GL_HEIGHT / Math.max(1, cssH));
  dpr = Math.min(dpr, maxTex / Math.max(1, cssW));
  dpr = Math.min(dpr, maxTex / Math.max(1, cssH));
  return Math.max(0.5, Math.floor(dpr * 20) / 20);
};

const parseObjectPosition = (value: string): [number, number] => {
  const parts = value.trim().split(/\s+/);
  const parse = (part: string | undefined, fallback: number) => {
    if (!part) return fallback;
    if (part.endsWith("%")) return clamp(Number.parseFloat(part) / 100, 0, 1);
    if (part === "left" || part === "top") return 0;
    if (part === "right" || part === "bottom") return 1;
    if (part === "center") return 0.5;
    return fallback;
  };
  return [parse(parts[0], 0.5), parse(parts[1], 0.5)];
};

const sameOrigin = (url: string): boolean => {
  if (!url) return false;
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
};

class LiquidGlassRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private glCanvas: HTMLCanvasElement | null = null;
  private pScene: WebGLProgram | null = null;
  private pGlass: WebGLProgram | null = null;
  private uScene: Record<string, WebGLUniformLocation | null> = {};
  private uGlass: Record<string, WebGLUniformLocation | null> = {};
  private surfaces: Surface[] = [];
  private raf = 0;
  private started = false;
  private failed = false;
  private contextLost = false;
  private reducedMotion = false;
  private highp = true;
  private maxTexSize = 4096;
  private qualityLevel = 0;
  private quality: number = QUALITY_STEPS[0];
  private qualityCooldown = 0;
  private frameCostEma = 0;
  private qualitySamples = 0;
  private clock = 0;
  private lastFrameAt = 0;
  private burstUntil = 0;
  private lastVideoTick = 0;
  private lastScrollPaint = 0;
  private scrollTimer = 0;
  private themeTimer = 0;
  private contentTimer = 0;
  private resizeTimer = 0;
  private viewportTimer = 0;
  private burstTimer = 0;
  private themeObserver: MutationObserver | null = null;
  private contentObserver: MutationObserver | null = null;
  private bodyObserver: ResizeObserver | null = null;
  private motionQuery: MediaQueryList | null = null;
  private videos: HTMLVideoElement[] = [];
  private observedVideos = new WeakSet<HTMLVideoElement>();
  private blockedMedia = new WeakSet<Element>();
  private colorCanvas: HTMLCanvasElement | null = null;
  private colorCtx: CanvasRenderingContext2D | null = null;
  private colorCache = new Map<string, RGBA>();
  private listenersInstalled = false;

  register(
    el: HTMLElement,
    canvas: HTMLCanvasElement,
    options: GlassSurfaceOptions = {},
  ): GlassSurfaceHandle {
    const variant = options.variant ?? "panel";
    const defaults = VARIANT_DEFAULTS[variant];
    const opts: ResolvedOptions = {
      variant,
      scrim: options.scrim ?? defaults.scrim,
      ambient: options.ambient ?? defaults.ambient,
      bezel: options.bezel ?? defaults.bezel,
      refraction: options.refraction ?? defaults.refraction,
      blur: options.blur ?? defaults.blur,
      dispersion: options.dispersion ?? defaults.dispersion,
      specular: options.specular ?? defaults.specular,
      base: options.base,
    };

    let destroyed = false;
    let surface: Surface | null = null;

    const handle: GlassSurfaceHandle = {
      canvas,
      invalidate: () => {
        if (!surface) return;
        surface.sceneDirty = true;
        surface.dirty = true;
        this.requestFrame();
      },
      setIndicator: (cx, cy, hw, hh, radius) => {
        if (!surface) return;
        surface.indicator = [
          cx,
          cy,
          Math.max(0, hw),
          Math.max(0, hh),
          Math.max(0, radius),
        ];
        surface.dirty = true;
        this.requestFrame();
      },
      clearIndicator: () => {
        if (!surface) return;
        surface.indicator = null;
        surface.dirty = true;
        this.requestFrame();
      },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        if (surface) this.unregister(surface);
      },
    };

    if (this.failed || this.contextLost || !this.start()) {
      document.documentElement.dataset.glassEngine = "css";
      return handle;
    }

    const ctx = canvas.getContext("2d");
    const sceneCanvas = document.createElement("canvas");
    const sceneCtx = sceneCanvas.getContext("2d");
    if (!ctx || !sceneCtx) {
      this.degrade("No 2D context available for a glass surface.");
      return handle;
    }

    surface = {
      el,
      canvas,
      ctx,
      sceneCanvas,
      sceneCtx,
      opts,
      w: 2,
      h: 2,
      cssW: 1,
      cssH: 1,
      dpr: 1,
      radius: 0,
      tex: null,
      sceneTex: null,
      fbo: null,
      padRect: { left: 0, top: 0, width: 1, height: 1 },
      ambientA: [0.1, 0.1, 0.1],
      ambientB: [0.1, 0.1, 0.1],
      ambientC: [0.1, 0.1, 0.1],
      indicator: null,
      dirty: true,
      sceneDirty: true,
      visible: true,
      ready: false,
      rectDirty: true,
      lastRender: 0,
      lastScenePaint: 0,
      ro: null,
      io: null,
      handle,
    };

    this.surfaces.push(surface);
    this.measure(surface, true);
    this.paint(surface);
    this.render(surface);
    surface.sceneDirty = false;
    surface.dirty = false;

    if ("ResizeObserver" in window) {
      surface.ro = new ResizeObserver(() => {
        if (!surface || destroyed) return;
        if (el.clientWidth < 2 || el.clientHeight < 2) {
          this.markNotReady(surface);
          return;
        }
        this.measure(surface, true);
        this.paint(surface);
        surface.dirty = true;
        this.requestFrame();
      });
      surface.ro.observe(el);
    }

    if ("IntersectionObserver" in window) {
      surface.io = new IntersectionObserver(
        (entries) => {
          if (!surface || destroyed) return;
          for (const entry of entries) {
            surface.visible = entry.isIntersecting;
            if (entry.isIntersecting) {
              surface.rectDirty = true;
              surface.sceneDirty = true;
              surface.dirty = true;
              this.requestFrame();
            }
          }
        },
        { rootMargin: "96px 0px" },
      );
      surface.io.observe(el);
    }

    this.requestFrame();
    return handle;
  }

  private start(): boolean {
    if (this.gl) return true;
    if (this.started) return false;
    this.started = true;

    document.documentElement.dataset.glassEngine = "css";

    if (typeof WebGL2RenderingContext === "undefined") {
      this.fail("WebGL2 is not available in this browser.");
      return false;
    }

    const reducedTransparency = window.matchMedia(
      "(prefers-reduced-transparency: reduce)",
    );
    if (reducedTransparency.matches) {
      this.fail("prefers-reduced-transparency is enabled.", false);
      return false;
    }

    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      this.fail("WebGL2 context creation failed.");
      return false;
    }

    this.gl = gl;
    this.glCanvas = canvas;
    this.maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    const highpFormat = gl.getShaderPrecisionFormat(
      gl.FRAGMENT_SHADER,
      gl.HIGH_FLOAT,
    );
    this.highp = !!highpFormat && highpFormat.precision > 0;

    if (!this.initResources(gl)) {
      this.fail("The liquid-glass shaders could not be compiled.");
      return false;
    }

    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);

    document.documentElement.dataset.glassEngine = "webgl";
    document.documentElement.classList.remove("no-gl");
    this.installListeners();
    this.requestFrame();
    return true;
  }

  private initResources(gl: WebGL2RenderingContext): boolean {
    const pScene = this.createProgram(
      gl,
      VERTEX_SHADER,
      this.prepareFragment(SCENE_SHADER),
    );
    const pGlass = this.createProgram(
      gl,
      VERTEX_SHADER,
      this.prepareFragment(GLASS_SHADER),
    );
    if (!pScene || !pGlass) {
      if (pScene) gl.deleteProgram(pScene);
      if (pGlass) gl.deleteProgram(pGlass);
      return false;
    }

    this.pScene = pScene;
    this.pGlass = pGlass;
    this.uScene = this.uniforms(gl, pScene, [
      "uTex",
      "uRes",
      "uTime",
      "uAmbient",
      "uAmbA",
      "uAmbB",
      "uAmbC",
    ]);
    this.uGlass = this.uniforms(gl, pGlass, [
      "uScene",
      "uRes",
      "uDpr",
      "uRect",
      "uRectR",
      "uInd",
      "uIndR",
      "uIndOn",
      "uBezelA",
      "uBezelB",
      "uRefr",
      "uBlur",
      "uDisp",
      "uSpec",
      "uQuality",
    ]);

    gl.bindVertexArray(gl.createVertexArray());
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    return true;
  }

  private prepareFragment(source: string): string {
    if (this.highp) return source;
    return source.replace("precision highp float;", "precision mediump float;");
  }

  private fail(reason?: string, markNoGl = true): void {
    this.failed = true;
    this.gl = null;
    this.pScene = null;
    this.pGlass = null;
    this.stopLoop();
    document.documentElement.dataset.glassEngine = "css";
    if (markNoGl) document.documentElement.classList.add("no-gl");
    for (const surface of this.surfaces) this.markNotReady(surface);
    if (reason) console.warn(`[liquid-glass] ${reason}`);
  }

  private degrade(reason: string): void {
    this.fail(reason);
  }

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.contextLost) return;
    this.contextLost = true;
    this.stopLoop();
    document.documentElement.dataset.glassEngine = "css";
    document.documentElement.classList.add("no-gl");
    for (const surface of this.surfaces) this.markNotReady(surface);
    console.warn(
      "[liquid-glass] WebGL context lost; using the CSS fallback until it is restored.",
    );
  };

  private onContextRestored = (): void => {
    const gl = this.gl;
    if (!gl || this.failed) return;
    this.contextLost = false;
    if (!this.initResources(gl)) {
      this.fail("WebGL context restoration failed.");
      return;
    }
    for (const surface of this.surfaces) {
      surface.tex = null;
      surface.sceneTex = null;
      surface.fbo = null;
      surface.w = 2;
      surface.h = 2;
      surface.ready = false;
      surface.rectDirty = true;
      surface.sceneDirty = true;
      surface.dirty = true;
    }
    document.documentElement.dataset.glassEngine = "webgl";
    document.documentElement.classList.remove("no-gl");
    for (const surface of this.surfaces) {
      this.measure(surface, true);
      this.paint(surface);
      this.render(surface);
      surface.sceneDirty = false;
      surface.dirty = false;
    }
    this.requestFrame();
    console.info("[liquid-glass] WebGL context restored.");
  };

  private createProgram(
    gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
  ): WebGLProgram | null {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      return null;
    }

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  private uniforms(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    names: string[],
  ): Record<string, WebGLUniformLocation | null> {
    const result: Record<string, WebGLUniformLocation | null> = {};
    for (const name of names) result[name] = gl.getUniformLocation(program, name);
    return result;
  }

  private installListeners(): void {
    if (this.listenersInstalled) return;
    this.listenersInstalled = true;

    window.addEventListener("scroll", this.onScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", this.onResize, { passive: true });
    window.addEventListener("orientationchange", this.onResize, {
      passive: true,
    });
    window.addEventListener("load", this.onContentChange, { passive: true });
    document.addEventListener("load", this.onContentChange, true);
    document.addEventListener("error", this.onContentChange, true);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    document.addEventListener("transitionrun", this.onMotionStart, true);
    document.addEventListener("transitionstart", this.onMotionStart, true);
    document.addEventListener("transitionend", this.onMotionEnd, true);
    document.addEventListener("transitioncancel", this.onMotionEnd, true);
    document.addEventListener("animationstart", this.onMotionStart, true);
    document.addEventListener("animationiteration", this.onMotionStart, true);
    document.addEventListener("animationend", this.onMotionEnd, true);
    document.addEventListener("animationcancel", this.onMotionEnd, true);
    document.addEventListener("play", this.onVideoEvent, true);
    document.addEventListener("playing", this.onVideoEvent, true);
    document.addEventListener("pause", this.onVideoEvent, true);
    document.addEventListener("seeked", this.onVideoEvent, true);
    document.addEventListener("loadeddata", this.onVideoEvent, true);
    document.fonts?.ready.then(this.onContentChange).catch(() => undefined);

    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.motionQuery.addEventListener?.("change", this.onMotionPreference);

    if ("MutationObserver" in window && document.body) {
      this.themeObserver = new MutationObserver(this.onThemeChange);
      this.themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "style"],
      });

      this.contentObserver = new MutationObserver(this.onMutations);
      this.contentObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    }

    if ("ResizeObserver" in window && document.body) {
      this.bodyObserver = new ResizeObserver(this.onBodyResize);
      this.bodyObserver.observe(document.body);
    }

    window.visualViewport?.addEventListener("resize", this.onViewportChange, {
      passive: true,
    });
    window.visualViewport?.addEventListener("scroll", this.onViewportChange, {
      passive: true,
    });
    this.refreshVideos();
  }

  private uninstallListeners(): void {
    if (!this.listenersInstalled) return;
    this.listenersInstalled = false;

    window.removeEventListener("scroll", this.onScroll, true);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("orientationchange", this.onResize);
    window.removeEventListener("load", this.onContentChange);
    document.removeEventListener("load", this.onContentChange, true);
    document.removeEventListener("error", this.onContentChange, true);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    document.removeEventListener("transitionrun", this.onMotionStart, true);
    document.removeEventListener("transitionstart", this.onMotionStart, true);
    document.removeEventListener("transitionend", this.onMotionEnd, true);
    document.removeEventListener("transitioncancel", this.onMotionEnd, true);
    document.removeEventListener("animationstart", this.onMotionStart, true);
    document.removeEventListener("animationiteration", this.onMotionStart, true);
    document.removeEventListener("animationend", this.onMotionEnd, true);
    document.removeEventListener("animationcancel", this.onMotionEnd, true);
    document.removeEventListener("play", this.onVideoEvent, true);
    document.removeEventListener("playing", this.onVideoEvent, true);
    document.removeEventListener("pause", this.onVideoEvent, true);
    document.removeEventListener("seeked", this.onVideoEvent, true);
    document.removeEventListener("loadeddata", this.onVideoEvent, true);
    this.motionQuery?.removeEventListener?.("change", this.onMotionPreference);
    this.motionQuery = null;
    window.visualViewport?.removeEventListener("resize", this.onViewportChange);
    window.visualViewport?.removeEventListener("scroll", this.onViewportChange);

    this.themeObserver?.disconnect();
    this.themeObserver = null;
    this.contentObserver?.disconnect();
    this.contentObserver = null;
    this.bodyObserver?.disconnect();
    this.bodyObserver = null;

    if (this.scrollTimer) window.clearTimeout(this.scrollTimer);
    if (this.themeTimer) window.clearTimeout(this.themeTimer);
    if (this.contentTimer) window.clearTimeout(this.contentTimer);
    if (this.resizeTimer) window.clearTimeout(this.resizeTimer);
    if (this.viewportTimer) window.clearTimeout(this.viewportTimer);
    if (this.burstTimer) window.clearTimeout(this.burstTimer);
    this.scrollTimer = 0;
    this.themeTimer = 0;
    this.contentTimer = 0;
    this.resizeTimer = 0;
    this.viewportTimer = 0;
    this.burstTimer = 0;
  }

  private onMutations = (records: MutationRecord[]): void => {
    for (const record of records) {
      const target = record.target;
      if (
        target instanceof Element &&
        target.closest(".lg-surface, .lg-canvas-host, .lg-tint")
      ) {
        continue;
      }
      // The legacy SVG engine rewrites its filter primitives on every scan.
      // Those attributes never reach this painter, and treating them as
      // content churn kept the engine recapturing while the page was idle.
      if (target instanceof Element && target.closest("svg")) continue;

      if (record.type === "attributes") {
        const element =
          target instanceof Element ? target : target.parentElement;
        const attribute = record.attributeName;
        const isTheme =
          element === document.documentElement || element === document.body;
        const isMedia =
          element instanceof HTMLImageElement ||
          element instanceof HTMLVideoElement ||
          element?.tagName === "SOURCE" ||
          element?.tagName === "PICTURE";

        if (isMedia) {
          if (
            attribute !== "src" &&
            attribute !== "srcset" &&
            attribute !== "poster" &&
            attribute !== "sizes" &&
            attribute !== "media"
          ) {
            continue;
          }
        } else if (!isTheme) {
          // Class/style churn from cursors, hovers and decorative overlays is
          // painted above the glass, so it cannot change the sampled backdrop.
          continue;
        }
      }

      this.scheduleContentRefresh();
      return;
    }
  };

  private scheduleContentRefresh = (): void => {
    const now = performance.now();
    this.burstUntil = Math.max(this.burstUntil, now + 160);
    for (const surface of this.surfaces) {
      if (!surface.visible) continue;
      surface.sceneDirty = true;
      surface.dirty = true;
    }
    this.requestFrame();

    if (this.contentTimer) return;
    this.contentTimer = window.setTimeout(() => {
      this.contentTimer = 0;
      this.refreshVideos();
      this.markAllDirty();
      this.burstUntil = Math.max(this.burstUntil, performance.now() + 200);
    }, CONTENT_DEBOUNCE);
  };

  private onBodyResize = (): void => {
    this.scheduleContentRefresh();
  };

  private onScroll = (): void => {
    const now = performance.now();
    const elapsed = now - this.lastScrollPaint;
    if (elapsed >= SCROLL_INTERVAL) {
      this.lastScrollPaint = now;
      this.markVisibleDirty();
      return;
    }
    if (this.scrollTimer) return;
    this.scrollTimer = window.setTimeout(() => {
      this.scrollTimer = 0;
      this.lastScrollPaint = performance.now();
      this.markVisibleDirty();
    }, SCROLL_INTERVAL - elapsed);
  };

  private markVisibleDirty(): void {
    for (const surface of this.surfaces) {
      surface.rectDirty = true;
      if (!surface.visible) continue;
      surface.sceneDirty = true;
      surface.dirty = true;
    }
    this.burstUntil = Math.max(this.burstUntil, performance.now() + 160);
    this.requestFrame();
  }

  private onResize = (): void => {
    if (this.resizeTimer) return;
    this.resizeTimer = window.setTimeout(() => {
      this.resizeTimer = 0;
      if (this.scrollTimer) {
        window.clearTimeout(this.scrollTimer);
        this.scrollTimer = 0;
      }
      for (const surface of this.surfaces) {
        if (surface.el.clientWidth < 2 || surface.el.clientHeight < 2) {
          this.markNotReady(surface);
          continue;
        }
        this.measure(surface, true);
        this.paint(surface);
        surface.dirty = true;
      }
      this.requestFrame();
    }, 100);
  };

  private onViewportChange = (): void => {
    if (this.viewportTimer) return;
    this.viewportTimer = window.setTimeout(() => {
      this.viewportTimer = 0;
      for (const surface of this.surfaces) surface.rectDirty = true;
      this.markAllDirty();
    }, 100);
  };

  private onContentChange = (): void => {
    this.refreshVideos();
    this.markAllDirty();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.stopLoop();
    } else {
      this.lastFrameAt = 0;
      this.requestFrame();
    }
  };

  private onMotionPreference = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches;
    this.markAllDirty();
  };

  private onMotionStart = (event: Event): void => {
    const target = event.target;
    if (target instanceof Element) {
      // The legacy SVG engine animates its filter primitives continuously.
      if (target.closest("svg")) return;
      // Infinite decorative loops (pulse, shimmer, spinners) repeat forever
      // and never move the media this painter samples. Bursting for them kept
      // the whole scene recapturing at 20 fps while the page was idle.
      if (event.type === "animationiteration" && !this.isSceneMedia(target)) {
        return;
      }
    }
    this.burstUntil = Math.max(this.burstUntil, performance.now() + BURST_MS);
    this.markAllDirty();
  };

  private isSceneMedia(target: Element): boolean {
    return (
      target instanceof HTMLImageElement ||
      target instanceof HTMLVideoElement ||
      target.tagName === "PICTURE" ||
      target.tagName === "SOURCE" ||
      !!target.querySelector("img, video, picture")
    );
  }

  private onMotionEnd = (): void => {
    this.markAllDirty();
  };

  private onVideoEvent = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLVideoElement)) return;
    if (event.type === "pause") {
      this.observedVideos.delete(target);
      this.markAllDirty();
      return;
    }
    this.observeVideo(target);
    this.markAllDirty();
  };

  private refreshVideos(): void {
    if (!document.body) return;
    this.videos = Array.from(document.querySelectorAll("video"));
    for (const video of this.videos) {
      if (!video.paused) this.observeVideo(video);
    }
  }

  private observeVideo(video: HTMLVideoElement): void {
    if (
      this.observedVideos.has(video) ||
      typeof video.requestVideoFrameCallback !== "function"
    ) {
      return;
    }
    this.observedVideos.add(video);
    const tick = (): void => {
      if (video.paused || video.ended || video.readyState < 2) {
        this.observedVideos.delete(video);
        return;
      }
      const now = performance.now();
      if (now - this.lastVideoTick >= BURST_INTERVAL) {
        this.lastVideoTick = now;
        this.burstUntil = Math.max(this.burstUntil, now + 160);
        for (const surface of this.surfaces) {
          if (!surface.visible) continue;
          surface.sceneDirty = true;
          surface.dirty = true;
        }
        this.requestFrame();
      }
      video.requestVideoFrameCallback(tick);
    };
    video.requestVideoFrameCallback(tick);
  }

  private onThemeChange = (): void => {
    if (this.themeTimer) window.clearTimeout(this.themeTimer);
    this.themeTimer = window.setTimeout(() => {
      this.themeTimer = 0;
      this.markAllDirty();
    }, 80);
  };

  private markAllDirty(): void {
    for (const surface of this.surfaces) {
      surface.sceneDirty = true;
      surface.dirty = true;
    }
    this.requestFrame();
  }

  private requestFrame(): void {
    if (this.raf || !this.gl || this.contextLost || this.failed || document.hidden)
      return;
    this.raf = window.requestAnimationFrame(this.frame);
  }

  private stopLoop(): void {
    if (this.raf) {
      window.cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    if (this.burstTimer) {
      window.clearTimeout(this.burstTimer);
      this.burstTimer = 0;
    }
  }

  private frame = (now: number): void => {
    this.raf = 0;
    if (document.hidden || this.contextLost || this.failed) return;
    const started = performance.now();
    const burst = now < this.burstUntil;
    let didWork = false;

    for (const surface of this.surfaces) {
      if (!surface.visible || surface.w < 4 || surface.h < 4) continue;
      const sceneDue =
        surface.sceneDirty ||
        (burst && now - surface.lastScenePaint >= BURST_INTERVAL);
      if (!sceneDue && !surface.dirty) continue;
      if (sceneDue) {
        this.paint(surface);
        surface.lastScenePaint = now;
      }
      this.render(surface);
      surface.sceneDirty = false;
      surface.dirty = false;
      surface.lastRender = now;
      didWork = true;
    }

    if (didWork) {
      const contiguous = this.lastFrameAt > 0 && now - this.lastFrameAt < 250;
      const delta =
        this.lastFrameAt > 0
          ? Math.min(0.05, (now - this.lastFrameAt) / 1000)
          : 0;
      this.clock += delta;
      this.lastFrameAt = now;
      this.sampleQuality(performance.now() - started, now, contiguous);
    }

    if (this.hasDirtyWork()) {
      this.requestFrame();
      return;
    }
    if (now < this.burstUntil && this.hasVisibleSurface()) {
      if (!this.burstTimer) {
        this.burstTimer = window.setTimeout(() => {
          this.burstTimer = 0;
          this.requestFrame();
        }, BURST_INTERVAL);
      }
    }
  };

  private hasDirtyWork(): boolean {
    for (const surface of this.surfaces) {
      if (
        surface.visible &&
        surface.w >= 4 &&
        surface.h >= 4 &&
        (surface.dirty || surface.sceneDirty)
      ) {
        return true;
      }
    }
    return false;
  }

  private hasVisibleSurface(): boolean {
    for (const surface of this.surfaces) {
      if (surface.visible && surface.w >= 4 && surface.h >= 4) return true;
    }
    return false;
  }

  private sampleQuality(
    cost: number,
    now: number,
    contiguous: boolean,
  ): void {
    if (!contiguous) {
      this.frameCostEma = cost;
      this.qualitySamples = 0;
      return;
    }
    this.frameCostEma = this.frameCostEma * 0.85 + cost * 0.15;
    this.qualitySamples++;
    if (now < this.qualityCooldown) return;

    if (
      this.frameCostEma > 14 &&
      this.qualityLevel < QUALITY_STEPS.length - 1 &&
      this.qualitySamples >= 20
    ) {
      this.setQuality(this.qualityLevel + 1);
    } else if (
      this.frameCostEma < 7 &&
      this.qualityLevel > 0 &&
      this.qualitySamples >= 120
    ) {
      this.setQuality(this.qualityLevel - 1);
    }
  }

  private setQuality(level: number): void {
    this.qualityLevel = level;
    this.quality = QUALITY_STEPS[level];
    this.qualitySamples = 0;
    this.qualityCooldown = performance.now() + 1500;
    for (const surface of this.surfaces) {
      this.measure(surface, true);
      this.paint(surface);
      surface.dirty = true;
    }
    this.requestFrame();
  }

  private measure(surface: Surface, reallocate: boolean): void {
    if (!reallocate && !surface.rectDirty) return;
    const el = surface.el;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
    const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
    const cssW = Math.max(1, el.clientWidth || rect.width - borderLeft);
    const cssH = Math.max(1, el.clientHeight || rect.height - borderTop);
    const radius = Math.max(
      0,
      (Number.parseFloat(style.borderTopLeftRadius) || 0) - borderLeft,
    );

    surface.padRect.left = rect.left + borderLeft;
    surface.padRect.top = rect.top + borderTop;
    surface.padRect.width = cssW;
    surface.padRect.height = cssH;
    surface.radius = radius;
    surface.rectDirty = false;

    if (cssW < 2 || cssH < 2) {
      surface.cssW = cssW;
      surface.cssH = cssH;
      this.markNotReady(surface);
      return;
    }

    if (!reallocate) return;

    const dpr = fitDpr(cssW, cssH, this.quality, this.maxTexSize);
    const w = Math.min(this.maxTexSize, Math.max(2, Math.round(cssW * dpr)));
    const h = Math.min(this.maxTexSize, Math.max(2, Math.round(cssH * dpr)));
    if (w < 4 || h < 4) {
      this.markNotReady(surface);
      return;
    }
    if (surface.w === w && surface.h === h && surface.dpr === dpr) {
      surface.cssW = cssW;
      surface.cssH = cssH;
      return;
    }

    surface.w = w;
    surface.h = h;
    surface.cssW = cssW;
    surface.cssH = cssH;
    surface.dpr = dpr;
    surface.ready = false;
    this.markNotReady(surface);
    surface.canvas.width = w;
    surface.canvas.height = h;
    surface.sceneCanvas.width = w;
    surface.sceneCanvas.height = h;
    if (surface.canvas.width !== w || surface.sceneCanvas.width !== w) {
      this.degrade("The browser could not allocate the glass canvases.");
      return;
    }

    const gl = this.gl;
    if (!gl) return;

    try {
      while (gl.getError() !== gl.NO_ERROR) {
        /* drain stale errors before allocating */
      }

      if (surface.tex) gl.deleteTexture(surface.tex);
      surface.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, surface.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      if (surface.sceneTex) gl.deleteTexture(surface.sceneTex);
      surface.sceneTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, surface.sceneTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        w,
        h,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      if (surface.fbo) gl.deleteFramebuffer(surface.fbo);
      surface.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, surface.fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        surface.sceneTex,
        0,
      );
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        this.degrade("The glass framebuffer is incomplete.");
        return;
      }
      if (gl.getError() !== gl.NO_ERROR) {
        this.degrade("The glass textures could not be allocated.");
        return;
      }
    } catch (error) {
      this.degrade(
        `The glass textures could not be allocated: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    if (this.glCanvas) {
      let grew = false;
      if (this.glCanvas.width < w) {
        this.glCanvas.width = Math.min(w, MAX_GL_WIDTH);
        grew = true;
      }
      if (this.glCanvas.height < h) {
        this.glCanvas.height = Math.min(h, MAX_GL_HEIGHT);
        grew = true;
      }
      if (grew) {
        for (const other of this.surfaces) other.dirty = true;
      }
    }

    surface.sceneDirty = true;
    surface.dirty = true;
    this.requestFrame();
  }

  private markReady(surface: Surface): void {
    if (surface.ready) return;
    surface.ready = true;
    surface.el.dataset.glassReady = "true";
  }

  private markNotReady(surface: Surface): void {
    if (!surface.ready && !surface.el.dataset.glassReady) return;
    surface.ready = false;
    delete surface.el.dataset.glassReady;
  }

  private unregister(surface: Surface): void {
    surface.ro?.disconnect();
    surface.io?.disconnect();
    this.markNotReady(surface);
    const index = this.surfaces.indexOf(surface);
    if (index >= 0) this.surfaces.splice(index, 1);
    const gl = this.gl;
    if (gl) {
      if (surface.tex) gl.deleteTexture(surface.tex);
      if (surface.sceneTex) gl.deleteTexture(surface.sceneTex);
      if (surface.fbo) gl.deleteFramebuffer(surface.fbo);
    }
    surface.tex = null;
    surface.sceneTex = null;
    surface.fbo = null;
    if (!this.surfaces.length) {
      this.stopLoop();
      this.uninstallListeners();
    }
  }

  /* ── scene painter ─────────────────────────────────────────────────── */

  private paint(surface: Surface): void {
    this.measure(surface, false);
    const ctx = surface.sceneCtx;
    const cw = surface.cssW;
    const ch = surface.cssH;
    if (cw < 2 || ch < 2) return;

    ctx.setTransform(surface.dpr, 0, 0, surface.dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const base = surface.opts.base ?? this.sampleBase(surface);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, cw, ch);

    const style = window.getComputedStyle(surface.el);
    const ambient = [
      this.cssColor(style.getPropertyValue("--ambient-a"), [255, 191, 0, 0.12]),
      this.cssColor(style.getPropertyValue("--ambient-b"), [255, 146, 80, 0.07]),
      this.cssColor(style.getPropertyValue("--ambient-c"), [120, 190, 255, 0.07]),
    ];
    surface.ambientA = [
      (ambient[0].r / 255) * ambient[0].a,
      (ambient[0].g / 255) * ambient[0].a,
      (ambient[0].b / 255) * ambient[0].a,
    ];
    surface.ambientB = [
      (ambient[1].r / 255) * ambient[1].a,
      (ambient[1].g / 255) * ambient[1].a,
      (ambient[1].b / 255) * ambient[1].a,
    ];
    surface.ambientC = [
      (ambient[2].r / 255) * ambient[2].a,
      (ambient[2].g / 255) * ambient[2].a,
      (ambient[2].b / 255) * ambient[2].a,
    ];

    this.paintAmbient(ctx, cw, ch, ambient);
    this.paintImages(surface, ctx);
    this.paintVignette(ctx, cw, ch);

    if (surface.opts.scrim > 0) {
      ctx.fillStyle = `rgba(6, 8, 14, ${surface.opts.scrim})`;
      ctx.fillRect(0, 0, cw, ch);
    }

    surface.sceneDirty = true;
    surface.dirty = true;
  }

  private paintAmbient(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    ambient: RGBA[],
  ): void {
    const spots: Array<[number, number, number, RGBA]> = [
      [0.16, 0.18, 0.72, ambient[0]],
      [0.86, 0.12, 0.66, ambient[1]],
      [0.52, 0.98, 0.82, ambient[2]],
    ];
    const radius = Math.max(cw, ch);
    for (const [x, y, scale, color] of spots) {
      if (color.a <= 0.001) continue;
      const g = ctx.createRadialGradient(
        x * cw,
        y * ch,
        0,
        x * cw,
        y * ch,
        radius * scale,
      );
      g.addColorStop(
        0,
        `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`,
      );
      g.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  private paintVignette(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
  ): void {
    const g = ctx.createRadialGradient(
      cw * 0.5,
      ch * 0.42,
      Math.min(cw, ch) * 0.15,
      cw * 0.5,
      ch * 0.5,
      Math.max(cw, ch) * 0.78,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, isDarkTheme() ? "rgba(0,0,0,0.22)" : "rgba(24,20,8,0.1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  }

  private paintImages(surface: Surface, ctx: CanvasRenderingContext2D): void {
    const rect = surface.padRect;
    if (rect.width < 2 || rect.height < 2) return;
    const images = document.images;
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (img) this.paintMedia(surface, ctx, img);
    }
    for (const video of this.videos) {
      this.paintMedia(surface, ctx, video);
    }
  }

  private paintMedia(
    surface: Surface,
    ctx: CanvasRenderingContext2D,
    media: HTMLImageElement | HTMLVideoElement,
  ): void {
    const rect = surface.padRect;
    if (surface.el.contains(media) || this.blockedMedia.has(media)) return;

    const isVideo = media instanceof HTMLVideoElement;
    if (isVideo) {
      if (media.readyState < 2 || media.videoWidth === 0 || media.videoHeight === 0)
        return;
    } else if (
      !media.complete ||
      media.naturalWidth === 0 ||
      media.naturalHeight === 0
    ) {
      return;
    }

    const url = media.currentSrc || media.src;
    const cors =
      media.crossOrigin === "anonymous" ||
      media.crossOrigin === "use-credentials";
    if (!sameOrigin(url) && !cors) return;
    if (media.closest('[aria-hidden="true"]')) return;

    const ir = media.getBoundingClientRect();
    if (ir.width < 4 || ir.height < 4) return;
    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    if (
      ir.right <= rect.left ||
      ir.left >= right ||
      ir.bottom <= rect.top ||
      ir.top >= bottom
    ) {
      return;
    }

    let opacity = 1;
    let node: Element | null = media;
    for (let depth = 0; node && depth < 3; depth++) {
      const cs = window.getComputedStyle(node);
      if (cs.display === "none" || cs.visibility === "hidden") {
        opacity = 0;
        break;
      }
      opacity *= Number.parseFloat(cs.opacity) || 1;
      if (opacity < 0.04) break;
      node = node.parentElement;
    }
    if (opacity < 0.04) return;

    const style = window.getComputedStyle(media);
    const fit = style.objectFit || "fill";
    const [px, py] = parseObjectPosition(style.objectPosition || "50% 50%");
    const nw = isVideo ? media.videoWidth : media.naturalWidth;
    const nh = isVideo ? media.videoHeight : media.naturalHeight;

    ctx.save();
    ctx.globalAlpha = opacity;
    try {
      if (fit === "fill") {
        ctx.drawImage(
          media,
          ir.left - rect.left,
          ir.top - rect.top,
          ir.width,
          ir.height,
        );
        return;
      }

      let scale = 1;
      if (fit === "cover") scale = Math.max(ir.width / nw, ir.height / nh);
      else if (fit === "contain") scale = Math.min(ir.width / nw, ir.height / nh);
      else if (fit === "scale-down")
        scale = Math.min(1, ir.width / nw, ir.height / nh);
      else if (fit === "none") scale = 1;

      const dw = nw * scale;
      const dh = nh * scale;
      const ox = ir.left + (ir.width - dw) * px;
      const oy = ir.top + (ir.height - dh) * py;
      const x0 = Math.max(ox, rect.left);
      const y0 = Math.max(oy, rect.top);
      const x1 = Math.min(ox + dw, right);
      const y1 = Math.min(oy + dh, bottom);
      if (x1 <= x0 || y1 <= y0) return;

      const sx = (x0 - ox) / scale;
      const sy = (y0 - oy) / scale;
      const sw = (x1 - x0) / scale;
      const sh = (y1 - y0) / scale;
      ctx.drawImage(
        media,
        sx,
        sy,
        sw,
        sh,
        x0 - rect.left,
        y0 - rect.top,
        x1 - x0,
        y1 - y0,
      );
    } catch {
      this.blockedMedia.add(media);
    } finally {
      ctx.restore();
    }
  }

  private sampleBase(surface: Surface): string {
    const rect = surface.padRect;
    const points: Array<[number, number]> = [
      [rect.left + rect.width * 0.5, rect.top + rect.height * 0.5],
      [rect.left + rect.width * 0.2, rect.top + rect.height * 0.25],
      [rect.left + rect.width * 0.8, rect.top + rect.height * 0.25],
      [rect.left + rect.width * 0.2, rect.top + rect.height * 0.8],
      [rect.left + rect.width * 0.8, rect.top + rect.height * 0.8],
    ];

    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    let count = 0;
    for (const [x, y] of points) {
      const color = this.samplePoint(surface, x, y);
      if (!color) continue;
      r += color.r;
      g += color.g;
      b += color.b;
      a += color.a;
      count++;
    }
    if (!count) {
      const body = this.cssColor(
        window.getComputedStyle(document.body).backgroundColor,
        isDarkTheme() ? [10, 12, 18, 1] : [247, 244, 236, 1],
      );
      return `rgb(${Math.round(body.r)}, ${Math.round(body.g)}, ${Math.round(body.b)})`;
    }

    const color: RGBA = {
      r: r / count,
      g: g / count,
      b: b / count,
      a: a / count,
    };
    const fallback = isDarkTheme() ? [10, 12, 18] : [247, 244, 236];
    const alpha = clamp(color.a, 0, 1);
    const outR = color.r * alpha + fallback[0] * (1 - alpha);
    const outG = color.g * alpha + fallback[1] * (1 - alpha);
    const outB = color.b * alpha + fallback[2] * (1 - alpha);
    return `rgb(${Math.round(outR)}, ${Math.round(outG)}, ${Math.round(outB)})`;
  }

  private samplePoint(surface: Surface, x: number, y: number): RGBA | null {
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight)
      return null;
    const stack = document.elementsFromPoint(x, y);
    if (!stack.length) return null;
    let surfaceIndex = stack.indexOf(surface.el);
    if (surfaceIndex < 0) surfaceIndex = 0;

    let color: RGBA = { r: 0, g: 0, b: 0, a: 0 };
    for (let i = stack.length - 1; i > surfaceIndex; i--) {
      const node = stack[i];
      if (!(node instanceof Element)) continue;
      if (node.tagName === "IMG" || node.tagName === "VIDEO") continue;
      const cs = window.getComputedStyle(node);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const bg = this.cssColor(cs.backgroundColor, [0, 0, 0, 0]);
      if (bg.a > 0.01) color = this.blend(bg, color);
      if (color.a > 0.98) break;
    }
    return color;
  }

  private cssColor(value: string, fallback: [number, number, number, number]): RGBA {
    const key = value.trim();
    if (key) {
      const cached = this.colorCache.get(key);
      if (cached) return cached;
    }
    if (!this.colorCanvas) {
      this.colorCanvas = document.createElement("canvas");
      this.colorCanvas.width = 1;
      this.colorCanvas.height = 1;
      this.colorCtx = this.colorCanvas.getContext("2d", {
        willReadFrequently: true,
      });
    }
    let color: RGBA = {
      r: fallback[0],
      g: fallback[1],
      b: fallback[2],
      a: fallback[3],
    };
    if (key && this.colorCtx) {
      this.colorCtx.clearRect(0, 0, 1, 1);
      this.colorCtx.fillStyle = "#000";
      this.colorCtx.fillStyle = key;
      this.colorCtx.fillRect(0, 0, 1, 1);
      const data = this.colorCtx.getImageData(0, 0, 1, 1).data;
      color = { r: data[0], g: data[1], b: data[2], a: data[3] / 255 };
      if (this.colorCache.size > 256) this.colorCache.clear();
      this.colorCache.set(key, color);
    }
    return color;
  }

  private blend(top: RGBA, bottom: RGBA): RGBA {
    const alpha = top.a + bottom.a * (1 - top.a);
    if (alpha <= 0.0001) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / alpha,
      g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / alpha,
      b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / alpha,
      a: alpha,
    };
  }

  /* ── GPU passes ────────────────────────────────────────────────────── */

  private render(surface: Surface): void {
    const gl = this.gl;
    const glCanvas = this.glCanvas;
    if (!gl || !glCanvas || !surface.tex || !surface.sceneTex || !surface.fbo)
      return;
    if (surface.w < 4 || surface.h < 4) return;

    const sceneChanged = surface.sceneDirty;
    if (sceneChanged) {
      try {
        gl.bindTexture(gl.TEXTURE_2D, surface.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          surface.sceneCanvas,
        );
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      } catch (error) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        this.markNotReady(surface);
        this.degrade(
          `The glass scene could not be uploaded: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }
    }

    const time = this.reducedMotion ? 4 : this.clock;

    gl.bindFramebuffer(gl.FRAMEBUFFER, surface.fbo);
    gl.viewport(0, 0, surface.w, surface.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.pScene);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, surface.tex);
    gl.uniform1i(this.uScene.uTex, 0);
    gl.uniform2f(this.uScene.uRes, surface.w, surface.h);
    gl.uniform1f(this.uScene.uTime, time);
    gl.uniform1f(this.uScene.uAmbient, surface.opts.ambient);
    gl.uniform3f(
      this.uScene.uAmbA,
      surface.ambientA[0],
      surface.ambientA[1],
      surface.ambientA[2],
    );
    gl.uniform3f(
      this.uScene.uAmbB,
      surface.ambientB[0],
      surface.ambientB[1],
      surface.ambientB[2],
    );
    gl.uniform3f(
      this.uScene.uAmbC,
      surface.ambientC[0],
      surface.ambientC[1],
      surface.ambientC[2],
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (sceneChanged) {
      try {
        gl.bindTexture(gl.TEXTURE_2D, surface.sceneTex);
        gl.generateMipmap(gl.TEXTURE_2D);
      } catch (error) {
        this.markNotReady(surface);
        this.degrade(
          `The glass mipmaps could not be generated: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }
    }

    gl.viewport(0, 0, surface.w, surface.h);
    gl.useProgram(this.pGlass);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, surface.sceneTex);
    gl.uniform1i(this.uGlass.uScene, 0);
    gl.uniform2f(this.uGlass.uRes, surface.w, surface.h);
    gl.uniform1f(this.uGlass.uDpr, surface.dpr);
    gl.uniform1f(this.uGlass.uQuality, this.quality);

    const hw = surface.w / 2;
    const hh = surface.h / 2;
    gl.uniform4f(this.uGlass.uRect, hw, hh, hw, hh);
    gl.uniform1f(
      this.uGlass.uRectR,
      Math.min(surface.radius * surface.dpr, hw, hh),
    );

    const ind = surface.indicator;
    if (ind) {
      gl.uniform4f(
        this.uGlass.uInd,
        ind[0] * surface.dpr,
        ind[1] * surface.dpr,
        ind[2] * surface.dpr,
        ind[3] * surface.dpr,
      );
      gl.uniform1f(
        this.uGlass.uIndR,
        Math.min(ind[4] * surface.dpr, ind[2] * surface.dpr, ind[3] * surface.dpr),
      );
      gl.uniform1f(this.uGlass.uIndOn, 1);
    } else {
      gl.uniform4f(this.uGlass.uInd, 0, 0, 0, 0);
      gl.uniform1f(this.uGlass.uIndR, 0);
      gl.uniform1f(this.uGlass.uIndOn, 0);
    }

    const maxBezel = Math.min(hw, hh) * 0.95;
    gl.uniform1f(
      this.uGlass.uBezelA,
      Math.min(surface.opts.bezel * surface.dpr, maxBezel),
    );
    gl.uniform1f(
      this.uGlass.uBezelB,
      ind ? Math.min(surface.opts.bezel * surface.dpr * 0.9, maxBezel) : 0,
    );
    gl.uniform1f(this.uGlass.uRefr, surface.opts.refraction);
    gl.uniform1f(this.uGlass.uBlur, surface.opts.blur);
    gl.uniform1f(this.uGlass.uDisp, surface.opts.dispersion);
    gl.uniform1f(this.uGlass.uSpec, surface.opts.specular);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const ctx = surface.ctx;
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, surface.w, surface.h);
      ctx.drawImage(
        glCanvas,
        0,
        glCanvas.height - surface.h,
        surface.w,
        surface.h,
        0,
        0,
        surface.w,
        surface.h,
      );
    } catch (error) {
      this.markNotReady(surface);
      this.degrade(
        `The glass frame could not be copied: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    this.markReady(surface);
  }
}

export const glassEngine = new LiquidGlassRenderer();
