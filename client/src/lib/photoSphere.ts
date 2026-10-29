/**
 * Utilidades de validación para panoramas equirectangulares.
 *
 * La captura 360 se hace en la propia app (ver panoramaStitcher.ts); este
 * módulo solo comprueba y re-encoda el archivo final antes de subirlo.
 */

export type PanoramaCheck = {
  ok: boolean;
  width: number;
  height: number;
  ratio: number;
  /** Roughly 2:1, the projection used by Photo Sphere. */
  isEquirectangular: boolean;
  warning?: string;
};

/**
 * Reads the image dimensions without loading the whole bitmap into the DOM.
 * Used to warn vendors when they picked a normal photo instead of a panorama.
 */
export async function inspectPanorama(file: File): Promise<PanoramaCheck> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo leer la imagen."));
      element.src = url;
    });

    const ratio = image.naturalWidth / image.naturalHeight;
    const isEquirectangular = Math.abs(ratio - 2) <= 0.12;
    const tooSmall = image.naturalWidth < 2048 || image.naturalHeight < 1024;
    return {
      ok: !tooSmall,
      width: image.naturalWidth,
      height: image.naturalHeight,
      ratio,
      isEquirectangular,
      warning: tooSmall
        ? "La imagen es muy pequeña para verse bien en 360°. Usa al menos 2048 × 1024 px."
        : !isEquirectangular
          ? `La proporción es ${ratio.toFixed(2)}:1. Un panorama 360° debería ser 2:1 (por ejemplo 4000 × 2000).`
          : undefined,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const MAX_UPLOAD_BYTES = 9.5 * 1024 * 1024;
const MAX_PANORAMA_WIDTH = 4096;

/**
 * Server uploads cap images at 10 MB and 4096 px textures keep mobile GPUs
 * responsive. Re-encode only when the panorama exceeds either limit so the
 * original XMP metadata survives in the common case.
 */
export async function preparePanorama(file: File): Promise<File> {
  const needsResize = file.size > MAX_UPLOAD_BYTES;
  if (!needsResize) return file;

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo procesar la imagen."));
      element.src = url;
    });

    const scale = Math.min(1, MAX_PANORAMA_WIDTH / image.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "panorama";
    return new File([blob], `${baseName}-360.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}
