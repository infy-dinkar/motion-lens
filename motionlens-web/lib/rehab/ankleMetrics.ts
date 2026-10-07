// Ankle measures for the rehab ankle exercises.
//
// Rehab's OWN copy, written to match the ankle biomech assessment
// (lib/biomech/ankle-live, "Dorsiflexion + Plantarflexion") so the
// numbers agree — but not imported from it, so a change on either side
// does not move the other.
//
//   ankle angle — angle θ between the SHIN line (ankle → knee) and the
//                 SOLE line (heel → toe). Neutral (foot ⟂ shin) is 90°.
//                 Returned as 90 − θ: positive = dorsiflexion (toes up
//                 toward the shin), negative = plantarflexion (toes
//                 pointed down).
//   knee        — interior hip–knee–ankle angle (did the knee move?)
//   leg lift    — hip/knee mid-point height (did the leg lift?)

import type { LiveKeypoint as Keypoint } from "@/hooks/usePoseDetectionLive";
import { LM_LIVE as LM } from "@/lib/pose/landmarks-live";

type Side = "left" | "right";

/** Knee / ankle / hip confidence floor. */
const VIS = 0.15;
/** Heel / toe are noisier; a lower floor keeps the end positions. */
const FOOT_VIS = 0.1;

const IDX = {
  left: {
    hip: LM.LEFT_HIP, knee: LM.LEFT_KNEE, ankle: LM.LEFT_ANKLE,
    heel: LM.LEFT_HEEL, toe: LM.LEFT_FOOT_INDEX,
  },
  right: {
    hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE,
    heel: LM.RIGHT_HEEL, toe: LM.RIGHT_FOOT_INDEX,
  },
} as const;

function seen(k: Keypoint | undefined, floor: number): k is Keypoint {
  return !!k && (k.score ?? 0) >= floor;
}

/** Signed ankle angle: + dorsiflexion, − plantarflexion, 0 = neutral.
 *  Null when the knee, ankle, heel or toe is not seen. */
export function computeAnklePumpDeg(kp: Keypoint[], side: Side): number | null {
  const i = IDX[side];
  const knee = kp[i.knee], ankle = kp[i.ankle], heel = kp[i.heel], toe = kp[i.toe];
  if (!seen(knee, VIS) || !seen(ankle, VIS)) return null;
  if (!seen(heel, FOOT_VIS) || !seen(toe, FOOT_VIS)) return null;
  const sx = knee.x - ankle.x, sy = knee.y - ankle.y; // shin: ankle → knee
  const fx = toe.x - heel.x, fy = toe.y - heel.y;     // sole: heel → toe
  if (Math.hypot(sx, sy) < 1e-6 || Math.hypot(fx, fy) < 1e-6) return null;
  const dot = sx * fx + sy * fy;
  const cross = sx * fy - sy * fx;
  const theta = (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
  return 90 - theta;
}

/** Interior hip–knee–ankle angle (180 = straight). Null when unseen. */
export function computeKneeInteriorDeg(kp: Keypoint[], side: Side): number | null {
  const i = IDX[side];
  const hip = kp[i.hip], knee = kp[i.knee], ankle = kp[i.ankle];
  if (!seen(hip, VIS) || !seen(knee, VIS) || !seen(ankle, VIS)) return null;
  const ax = hip.x - knee.x, ay = hip.y - knee.y;
  const bx = ankle.x - knee.x, by = ankle.y - knee.y;
  if (Math.hypot(ax, ay) < 1e-6 || Math.hypot(bx, by) < 1e-6) return null;
  const dot = ax * bx + ay * by;
  const cross = ax * by - ay * bx;
  return (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
}

/** Leg position for the lift check: the hip/knee mid-point's y and the
 *  thigh length (hip → knee) to scale it. Null when unseen. */
export function computeLegHeight(kp: Keypoint[], side: Side): { y: number; thigh: number } | null {
  const i = IDX[side];
  const hip = kp[i.hip], knee = kp[i.knee];
  if (!seen(hip, VIS) || !seen(knee, VIS)) return null;
  const thigh = Math.hypot(hip.x - knee.x, hip.y - knee.y);
  if (thigh < 1) return null;
  return { y: (hip.y + knee.y) / 2, thigh };
}
