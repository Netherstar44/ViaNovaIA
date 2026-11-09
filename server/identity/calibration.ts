/**
 * Production activation gate for face verification.
 *
 * A threshold and an arbitrary ID are not evidence. The MVP test suite uses
 * synthetic descriptors, so those values must never enable the feature by
 * themselves. An operator must additionally approve the calibration after
 * reviewing an independent evaluation report.
 *
 * `FACE_DEV_MODE` is a local-only escape hatch: it is ignored outside
 * development/test and never sets `ready`. It exists so enrollment and face
 * login can be exercised before a real calibration report is approved.
 */
export const FACE_CALIBRATION_TARGET_FAR = 0.001; // 0.1 %
export const FACE_CALIBRATION_TARGET_FRR = 0.05; // 5 %
export const FACE_CALIBRATION_CONFIDENCE = 0.95;
// One-sided 95% upper bound for zero false accepts: ~3 / N. With 3000
// independent impostor comparisons the upper bound is below 0.1 %.
export const FACE_CALIBRATION_MIN_EVALUATION_IMPOSTORS = 3000;
export const FACE_CALIBRATION_MIN_EVALUATION_GENUINE = 300;
// A condition represented by one or two probes is anecdotal, not a subgroup
// estimate. These minimums keep a sparse group from enabling the model.
export const FACE_CALIBRATION_MIN_GROUP_IMPOSTORS = 100;
export const FACE_CALIBRATION_MIN_GROUP_GENUINE = 30;

export type CalibrationGate = {
  /** Production-approved calibration. Only this flag may enable the feature in production. */
  ready: boolean;
  /** Explicit local override active. Always false in production. */
  development: boolean;
  threshold: number | null;
  reason: string | null;
};

/**
 * The values are intentionally read from the server environment. The client
 * never receives the threshold or any calibration identifier.
 */
export function calibrationGate(env: NodeJS.ProcessEnv = process.env): CalibrationGate {
  const rawThreshold = env.FACE_DISTANCE_THRESHOLD;
  const threshold = Number(rawThreshold);
  if (!rawThreshold || !Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) {
    return { ready: false, development: false, threshold: null, reason: "Falta un umbral de distancia calibrado." };
  }

  // Local-only override. It deliberately requires an explicit flag and a
  // non-production environment; setting it in production changes nothing.
  const development = env.FACE_DEV_MODE === "true" && (env.NODE_ENV === "development" || env.NODE_ENV === "test");
  const developmentThreshold = development ? threshold : null;

  const calibrationId = String(env.FACE_CALIBRATION_ID ?? "").trim();
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(calibrationId)) {
    return { ready: false, development, threshold: developmentThreshold, reason: "Falta un identificador de calibración válido." };
  }

  if (env.FACE_CALIBRATION_APPROVED !== "true") {
    return { ready: false, development, threshold: developmentThreshold, reason: "La calibración no tiene aprobación explícita." };
  }

  return { ready: true, development, threshold, reason: null };
}
