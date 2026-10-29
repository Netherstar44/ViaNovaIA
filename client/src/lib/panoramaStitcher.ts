/**
 * Cámara 360° en el navegador.
 *
 * El motor no depende de sensores ni de una APK externa: mientras la persona
 * gira sobre sí misma, comparamos el perfil horizontal de cada fotograma para
 * estimar cuántos grados giró y pegamos el fotograma en un lienzo
 * equirectangular 2:1. El resultado se puede previsualizar y subir con el mismo
 * flujo que un panorama importado.
 *
 * Las funciones puras (perfil, desplazamiento, cobertura) viven separadas del
 * canvas para poder probarlas en Node.
 */

export const PANORAMA_WIDTH = 4096;
export const PANORAMA_HEIGHT = 2048;
/** Aproximación de la cámara trasera de un teléfono; suficiente para coser. */
export const DEFAULT_H_FOV = 65;
/** Cobertura mínima para que el panorama no tenga un sector vacío. */
export const MIN_COVERAGE_DEG = 240;

export type ShiftResult = {
  /** Desplazamiento en píxeles del perfil anterior al actual. */
  shift: number;
  /** 0 = nada parecido, 1 = idéntico. */
  score: number;
};

/** Perfil de luminancia por columna sobre la banda central del fotograma. */
export function columnProfile(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const out = new Float32Array(width);
  const y0 = Math.floor(height * 0.22);
  const y1 = Math.max(y0 + 1, Math.ceil(height * 0.78));
  const rows = y1 - y0;

  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = y0; y < y1; y += 1) {
      const index = (y * width + x) * 4;
      sum += rgba[index] * 0.299 + rgba[index + 1] * 0.587 + rgba[index + 2] * 0.114;
    }
    out[x] = sum / rows;
  }

  return out;
}

function center(profile: Float32Array, length: number): Float32Array {
  let mean = 0;
  for (let i = 0; i < length; i += 1) mean += profile[i];
  mean /= length;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = profile[i] - mean;
  return out;
}

/**
 * Busca `d` tal que `next[x] ≈ prev[x + d]`. Si la cámara gira a la derecha, el
 * contenido se mueve a la izquierda del encuadre y `d` es positivo.
 */
export function estimateShift(prev: Float32Array, next: Float32Array, maxShift?: number): ShiftResult {
  const length = Math.min(prev.length, next.length);
  if (length < 8) return { shift: 0, score: 0 };

  const limit = Math.max(1, Math.min(maxShift ?? Math.floor(length * 0.35), Math.floor(length * 0.45)));
  const a = center(prev, length);
  const b = center(next, length);
  const minOverlap = Math.max(24, Math.floor(length * 0.35));
  const costs = new Float64Array(limit * 2 + 1);

  let best = 0;
  let bestCost = Number.POSITIVE_INFINITY;

  for (let d = -limit; d <= limit; d += 1) {
    const start = Math.max(0, -d);
    const end = Math.min(length, length - d);
    if (end - start < minOverlap) {
      costs[d + limit] = Number.POSITIVE_INFINITY;
      continue;
    }

    let sum = 0;
    for (let x = start; x < end; x += 1) {
      const diff = b[x] - a[x + d];
      sum += diff < 0 ? -diff : diff;
    }

    const cost = sum / (end - start);
    costs[d + limit] = cost;
    if (cost < bestCost) {
      bestCost = cost;
      best = d;
    }
  }

  if (!Number.isFinite(bestCost)) return { shift: 0, score: 0 };

  let refined = best;
  const index = best + limit;
  if (index > 0 && index < costs.length - 1) {
    const left = costs[index - 1];
    const right = costs[index + 1];
    if (Number.isFinite(left) && Number.isFinite(right)) {
      const denominator = left - 2 * bestCost + right;
      if (Math.abs(denominator) > 1e-6) {
        refined += (0.5 * (left - right)) / denominator;
      }
    }
  }

  refined = Math.max(best - 0.5, Math.min(best + 0.5, refined));

  return {
    shift: refined,
    score: Math.max(0, Math.min(1, 1 - bestCost / 40)),
  };
}

export function coverageDeg(minYaw: number, maxYaw: number): number {
  return Math.max(0, maxYaw - minYaw);
}

/** Centro horizontal (px) del lienzo equirectangular para un giro dado. */
export function yawToX(yawDeg: number, width = PANORAMA_WIDTH): number {
  const normalized = ((yawDeg % 360) + 360) % 360;
  return (normalized / 360) * width;
}

/** Alto de la banda visible y sus bordes superior/inferior en el lienzo. */
export function panoramaBand(vFovDeg: number, height = PANORAMA_HEIGHT): { top: number; bottom: number; size: number } {
  const size = Math.max(2, Math.min(height, Math.round((vFovDeg / 180) * height)));
  const top = Math.round(height / 2 - size / 2);
  return { top, bottom: top + size, size };
}

export function verticalFov(hFovDeg: number, frameWidth: number, frameHeight: number): number {
  if (!frameWidth || !frameHeight) return 40;
  const half = (hFovDeg * Math.PI) / 360;
  return (2 * Math.atan(Math.tan(half) * (frameHeight / frameWidth)) * 180) / Math.PI;
}

/**
 * FOV horizontal cuando el teléfono se sostiene en vertical. Al girar la
 * cámara, el lado corto pasa a ser el ancho: usamos el FOV vertical del
 * encuadre horizontal como nueva referencia.
 */
export function horizontalFovForFrame(
  frameWidth: number,
  frameHeight: number,
  landscapeFov = DEFAULT_H_FOV,
): number {
  if (!frameWidth || !frameHeight) return landscapeFov;
  if (frameWidth >= frameHeight) return landscapeFov;
  const half = (landscapeFov * Math.PI) / 360;
  return (2 * Math.atan(Math.tan(half) * (frameWidth / frameHeight)) * 180) / Math.PI;
}

export type Feather = "none" | "left" | "right" | "both";

export type PanoramaFrameOptions = {
  yawDeg: number;
  hFovDeg: number;
  vFovDeg: number;
  feather?: Feather;
  pitchDeg?: number;
};

function applyFeather(context: CanvasRenderingContext2D, width: number, height: number, feather: Feather) {
  if (feather === "none") return;

  const gradient = context.createLinearGradient(0, 0, width, 0);
  if (feather === "left") {
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.16, "rgba(0,0,0,1)");
  } else if (feather === "right") {
    gradient.addColorStop(0.84, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
  } else {
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.14, "rgba(0,0,0,1)");
    gradient.addColorStop(0.86, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
  }

  context.globalCompositeOperation = "destination-in";
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "source-over";
}

/**
 * Pega un fotograma en el lienzo. El `scratch` se reutiliza entre fotogramas
 * para no crear un canvas por muestra.
 */
export function drawPanoramaFrame(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  options: PanoramaFrameOptions,
  scratch: HTMLCanvasElement,
): void {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const frameWidth = Math.max(2, Math.round((options.hFovDeg / 360) * width));
  const band = panoramaBand(options.vFovDeg, height);

  if (scratch.width !== frameWidth || scratch.height !== band.size) {
    scratch.width = frameWidth;
    scratch.height = band.size;
  }

  const scratchContext = scratch.getContext("2d");
  if (!scratchContext) return;

  scratchContext.setTransform(1, 0, 0, 1, 0, 0);
  scratchContext.globalAlpha = 1;
  scratchContext.globalCompositeOperation = "source-over";
  scratchContext.clearRect(0, 0, frameWidth, band.size);
  scratchContext.imageSmoothingQuality = "high";
  scratchContext.drawImage(source, 0, 0, frameWidth, band.size);
  applyFeather(scratchContext, frameWidth, band.size, options.feather ?? "none");

  const centerX = yawToX(options.yawDeg, width);
  const x = centerX - frameWidth / 2;
  const y = band.top - ((options.pitchDeg ?? 0) / 180) * height;

  context.drawImage(scratch, x, y);
  if (x < 0) context.drawImage(scratch, x + width, y);
  if (x + frameWidth > width) context.drawImage(scratch, x - width, y);
}

function stretchRow(
  context: CanvasRenderingContext2D,
  row: number,
  width: number,
  targetHeight: number,
  toTop: boolean,
) {
  if (targetHeight < 1) return;

  const strip = document.createElement("canvas");
  strip.width = width;
  strip.height = 1;
  const stripContext = strip.getContext("2d");
  if (!stripContext) return;

  stripContext.drawImage(context.canvas, 0, row, width, 1, 0, 0, width, 1);

  context.save();
  // El filtro suaviza las estrías verticales del cielo y del suelo.
  context.filter = "blur(18px)";
  const targetY = toTop ? 0 : context.canvas.height - targetHeight;
  context.drawImage(strip, 0, 0, width, 1, 0, targetY, width, targetHeight);
  context.restore();
}

/**
 * El barrido solo cubre una banda horizontal. Estiramos la primera y la última
 * fila hacia los polos para que la esfera no muestre negro arriba ni abajo.
 */
export function fillPanoramaPoles(context: CanvasRenderingContext2D, vFovDeg: number): void {
  const height = context.canvas.height;
  const width = context.canvas.width;
  const band = panoramaBand(vFovDeg, height);

  if (band.top > 1) stretchRow(context, band.top, width, band.top, true);
  if (height - band.bottom > 1) stretchRow(context, band.bottom - 1, width, height - band.bottom, false);
}

export function createPanoramaCanvas(
  width = PANORAMA_WIDTH,
  height = PANORAMA_HEIGHT,
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no pudo crear el lienzo del panorama.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

export function clearPanorama(context: CanvasRenderingContext2D): void {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
}

export function panoramaToFile(canvas: HTMLCanvasElement, name = "panorama-360.jpg"): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar la imagen del panorama."));
          return;
        }
        resolve(new File([blob], name, { type: "image/jpeg", lastModified: Date.now() }));
      },
      "image/jpeg",
      0.9,
    );
  });
}
