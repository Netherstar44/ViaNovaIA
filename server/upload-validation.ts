/**
 * Validación de archivos por contenido real (magic bytes), no solo por
 * Content-Type o extensión declarada por el cliente.
 */

export type UploadKind = "image" | "video" | "model";

export type UploadValidationInput = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
  maxImageBytes?: number;
  maxVideoBytes?: number;
  maxModelBytes?: number;
};

export type UploadValidationResult =
  | { ok: true; kind: UploadKind; mime: string; extension: string }
  | { ok: false; reason: string };

const DEFAULT_MAX_IMAGE = 10 * 1024 * 1024;
const DEFAULT_MAX_VIDEO = 50 * 1024 * 1024;
const DEFAULT_MAX_MODEL = 25 * 1024 * 1024;

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function ascii(buffer: Buffer, start: number, end: number): string {
  return buffer.slice(start, end).toString("ascii");
}

/** Detecta el tipo real a partir de los primeros bytes. */
export function sniffMime(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null;

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(buffer, 0, 4) === "GIF8") return "image/gif";
  if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WEBP") return "image/webp";
  if (ascii(buffer, 4, 8) === "ftyp") return "video/mp4";
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (ascii(buffer, 0, 4) === "glTF") return "model/gltf-binary";

  const head = buffer.slice(0, 512).toString("utf8").trim();
  if (head.startsWith("{") && /"asset"\s*:/.test(head) && /"version"\s*:/.test(head)) {
    return "model/gltf+json";
  }

  return null;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "model/gltf-binary": "glb",
  "model/gltf+json": "gltf",
};

export function validateUpload(input: UploadValidationInput): UploadValidationResult {
  const { buffer } = input;
  if (!buffer || buffer.length === 0) return { ok: false, reason: "El archivo está vacío" };

  const realMime = sniffMime(buffer);
  if (!realMime) {
    return { ok: false, reason: "El contenido del archivo no corresponde a un formato permitido" };
  }

  const extension = String(input.originalname || "").split(".").pop()?.toLowerCase() || "";
  const expectedExtension = EXTENSIONS[realMime];

  if (extension && extension !== expectedExtension && !(realMime === "image/jpeg" && extension === "jpeg")) {
    return { ok: false, reason: "La extensión no coincide con el contenido real del archivo" };
  }

  // application/octet-stream solo se tolera para modelos 3D reales.
  if (input.mimetype === "application/octet-stream" && !realMime.startsWith("model/")) {
    return { ok: false, reason: "Tipo MIME genérico no permitido para este archivo" };
  }

  if (input.mimetype && input.mimetype !== "application/octet-stream" && input.mimetype !== realMime) {
    return { ok: false, reason: "El tipo MIME declarado no coincide con el contenido real" };
  }

  const kind: UploadKind = realMime.startsWith("image/")
    ? "image"
    : realMime.startsWith("video/")
      ? "video"
      : "model";

  const maxBytes =
    kind === "image"
      ? input.maxImageBytes ?? DEFAULT_MAX_IMAGE
      : kind === "video"
        ? input.maxVideoBytes ?? DEFAULT_MAX_VIDEO
        : input.maxModelBytes ?? DEFAULT_MAX_MODEL;

  if (buffer.length > maxBytes) {
    return { ok: false, reason: "El archivo excede el tamaño máximo permitido para su tipo" };
  }

  return { ok: true, kind, mime: realMime, extension: expectedExtension };
}
