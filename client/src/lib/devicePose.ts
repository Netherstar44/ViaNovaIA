import { Euler, Quaternion, Vector3 } from "three";
import { cameraBasis, wrapYaw, type Pose } from "@shared/sphere";
/** W3C device orientation -> rear-camera optical frame, including screen rotation. */
export function devicePose(alpha: number, beta: number, gamma: number, screenAngle: number): Pose {
  const r = Math.PI / 180;
  const q = new Quaternion().setFromEuler(new Euler(beta * r, alpha * r, -gamma * r, "YXZ"))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -screenAngle * r));
  const forward = new Vector3(0, 0, -1).applyQuaternion(q), up = new Vector3(0, 1, 0).applyQuaternion(q);
  const yaw = wrapYaw(Math.atan2(forward.z, forward.x) / r), pitch = Math.asin(Math.max(-1, Math.min(1, forward.y))) / r;
  const basis = cameraBasis({ yaw, pitch, roll: 0 });
  const dot = (v: number[]) => up.x * v[0] + up.y * v[1] + up.z * v[2];
  return { yaw, pitch, roll: Math.atan2(-dot(basis.right), dot(basis.up)) / r };
}
