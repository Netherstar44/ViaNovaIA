export const FACE_MODEL = "face-api-1.7.15-recognition-v1-landmark68";
export type FaceSample = {
  descriptor: number[];
  yaw: number;
  roll: number;
  pitch?: number;
  facePixels: number;
  light: number;
  sharpness: number;
};
export interface FaceEngine {
  readonly model: string;
  analyze(image: Buffer, enrollment: boolean): Promise<FaceSample>;
}
export function distance(a: number[], b: number[]): number {
  if (a.length !== 128 || b.length !== 128 || [...a, ...b].some(v => !Number.isFinite(v))) return Infinity;
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}
export function quality(sample: FaceSample, action: string): string | null {
  if (sample.facePixels < 120) return "Acerca el rostro: debe medir al menos 120 píxeles.";
  if (sample.light < 45 || sample.light > 220) return "Busca luz uniforme de frente, sin contraluz.";
  if (sample.sharpness < 65) return "Limpia la lente y mantén el teléfono quieto.";
  if (Math.abs(sample.roll) > 15) return "Mantén el teléfono y la cabeza derechos.";
  if (sample.pitch !== undefined && Math.abs(sample.pitch) > 25) return "Mantén el rostro a la altura de la cámara, sin mirar arriba ni abajo.";
  if (action === "center" && Math.abs(sample.yaw) > 0.12) return "Mira de frente a la cámara.";
  return null;
}
export function actionMatches(action: string, sample: FaceSample): boolean {
  return action === "center" ? Math.abs(sample.yaw) <= 0.12
    : action === "left" ? sample.yaw < -0.20 && sample.yaw > -0.7
    : action === "right" && sample.yaw > 0.20 && sample.yaw < 0.7;
}
export function isCurrent(record: { approvedName?: string; validUntil?: number; revoked?: boolean; method?: string; consentAt?: number; templateExpires?: number }, now = Date.now()): boolean {
  return !!record.approvedName && !record.revoked && (record.validUntil ?? 0) > now &&
    (record.method === "manual" || (!!record.consentAt && (record.templateExpires ?? 0) > now));
}
