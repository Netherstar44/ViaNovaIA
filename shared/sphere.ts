/** Coordinates: yaw 0 faces +X, yaw 90 faces +Z, pitch +90 is zenith. */
export type Pose = { yaw: number; pitch: number; roll: number };
export type Vec3 = [number, number, number];
const rad = Math.PI / 180;
export const clampPitch = (pitch: number) => Math.max(-90, Math.min(90, pitch));
export const wrapYaw = (yaw: number) => ((yaw % 360) + 360) % 360;
export function direction(yaw: number, pitch: number): Vec3 {
  const p = clampPitch(pitch) * rad, y = yaw * rad;
  return [Math.cos(p) * Math.cos(y), Math.sin(p), Math.cos(p) * Math.sin(y)];
}
export function cameraBasis(pose: Pose): { forward: Vec3; right: Vec3; up: Vec3 } {
  const forward = direction(pose.yaw, pose.pitch), y = pose.yaw * rad, p = pose.pitch * rad, r = pose.roll * rad;
  const right: Vec3 = [-Math.sin(y), 0, Math.cos(y)];
  const up: Vec3 = [-Math.sin(p) * Math.cos(y), Math.cos(p), -Math.sin(p) * Math.sin(y)];
  return { forward, right: right.map((v, i) => v * Math.cos(r) + up[i] * Math.sin(r)) as Vec3,
    up: up.map((v, i) => v * Math.cos(r) - right[i] * Math.sin(r)) as Vec3 };
}
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Inverse rectilinear camera projection, including roll; no stretched rows. */
export function projectRay(ray: Vec3, pose: Pose, hFov: number, vFov: number): [number, number] | null {
  return projectBasis(ray, cameraBasis(pose), Math.tan(hFov * rad / 2), Math.tan(vFov * rad / 2));
}
export function projectBasis(ray: Vec3, basis: ReturnType<typeof cameraBasis>, tanH: number, tanV: number): [number, number] | null {
  const z = dot(ray, basis.forward);
  if (z <= 0) return null;
  const x = dot(ray, basis.right) / (z * tanH), y = dot(ray, basis.up) / (z * tanV);
  return Math.abs(x) <= 1 && Math.abs(y) <= 1 ? [(x + 1) / 2, (1 - y) / 2] : null;
}
export function angularDistance(a: Pick<Pose, "yaw" | "pitch">, b: Pick<Pose, "yaw" | "pitch">): number {
  return Math.acos(Math.max(-1, Math.min(1, dot(direction(a.yaw, a.pitch), direction(b.yaw, b.pitch))))) / rad;
}
/** Rings adapt to the actual estimated FOV (35% overlap); both poles explicit. */
export function captureTargets(hFov = 65, vFov = 40): Pose[] {
  const step = Math.min(40, Math.max(12, vFov * 0.65));
  const rings = Math.ceil(180 / step);
  const out: Pose[] = [];
  const pitches = Array.from({ length: rings - 1 }, (_, i) => -90 + (i + 1) * 180 / rings).sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
  for (const pitch of pitches) {
    const count = Math.ceil(360 * Math.cos(pitch * rad) / (hFov * 0.65));
    for (let i = 0; i < count; i++) out.push({ yaw: i * 360 / count, pitch, roll: 0 });
  }
  out.push({ yaw: 0, pitch: 90, roll: 0 }, { yaw: 0, pitch: -90, roll: 0 });
  return out;
}
/** Correct solid angle, not percentage of equirectangular pixels. */
export function sphereCoverage(mask: ArrayLike<number>, width: number, height: number): number {
  let covered = 0, total = 0;
  for (let y = 0; y < height; y++) {
    const area = Math.sin((90 - y / height * 180) * rad) - Math.sin((90 - (y + 1) / height * 180) * rad);
    total += width * area;
    for (let x = 0; x < width; x++) if (mask[y * width + x] > 0) covered += area;
  }
  return total ? covered / total * 100 : 0;
}
export function partialVerticalFov(width: number, height: number): number {
  return Math.min(180, 360 * height / Math.max(1, width));
}
