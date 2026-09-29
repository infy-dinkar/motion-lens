// What each calibration hold measures — one reader per CalibSignal.
//
// Every reader is an existing helper the exercise pages already use,
// called exactly as the pages call it. Calibration therefore records
// the same quantity the exercise itself will score, computed the same
// way, so rest and range are comparable with the session that follows
// and with each other across visits.
//
// Nothing is computed here that is not already computed somewhere in
// lib/rehab/poseMetrics.ts or lib/biomech/*-live.ts.

import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { computeKneeAngle } from "@/lib/biomech/knee-live";
import { computeHipAngle } from "@/lib/biomech/hip-live";
import { computeShoulderAngle } from "@/lib/biomech/shoulder-live";
import {
  computeForearmRotationProxyDeg,
  computeForwardHeadOffsetDeg,
  computeHipAbductionDeg,
  computeHipMidX,
  computeHipWidth,
  computeLateralTrunkFlexionDeg,
  computePelvicTiltDeg,
  computeShoulderWidth,
  computeSpineFlexionProxyDeg,
  computeTrunkExtensionAngleDeg,
} from "@/lib/rehab/poseMetrics";
import type { CalibSignal, SignalSide } from "@/lib/rehab/calibration/specs";

export type Side = "left" | "right";

export interface FrameSize {
  w: number;
  h: number;
}

/** The pages hand these helpers the live keypoints cast to their own
 *  Keypoint alias; the shapes are identical (x, y, score). */
type Kp = Parameters<typeof computeKneeAngle>[1];

function other(side: Side): Side {
  return side === "left" ? "right" : "left";
}

/** Largest finite of the two, or null when neither computed. */
function maxOf(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

/**
 * Read one signal from one frame.
 *
 * @param side       the working side; ignored for `signalSide: none`
 * @param signalSide how the spec wants the side applied — `any` reads
 *                   both and keeps the larger (marching lifts either
 *                   knee)
 * @returns the value, or null when the helper could not compute it —
 *          the hold tracker treats that as a block, not a zero
 */
export function readCalibSignal(
  signal: CalibSignal,
  kp: LiveKeypoint[],
  side: Side | null,
  signalSide: SignalSide,
  frame: FrameSize,
): number | null {
  const k = kp as unknown as Kp;
  // A sided reader with no side to read from cannot answer.
  const s: Side | null = signalSide === "none" ? null : side;

  const sided = (fn: (sd: Side) => number | null): number | null => {
    if (signalSide === "any") return maxOf(fn("left"), fn("right"));
    if (s === null) return null;
    return fn(s);
  };

  switch (signal) {
    case "knee_flexion":
      return sided((sd) => computeKneeAngle("flexion", k, sd));
    case "hip_flexion":
      return sided((sd) => computeHipAngle("flexion", k, sd));
    case "hip_abduction":
      return sided((sd) => computeHipAbductionDeg(kp, sd));
    case "shoulder_abduction":
      return sided((sd) => computeShoulderAngle("abduction", k, sd));
    case "shoulder_flexion":
      return sided((sd) => computeShoulderAngle("flexion", k, sd));
    case "forearm_rotation_proxy":
      return sided((sd) => computeForearmRotationProxyDeg(kp, sd));
    case "forward_head_offset":
      return sided((sd) => computeForwardHeadOffsetDeg(kp, sd));
    case "trunk_extension":
      return computeTrunkExtensionAngleDeg(kp);
    case "spine_flexion_proxy":
      return computeSpineFlexionProxyDeg(kp);
    case "lateral_trunk_flexion":
      return computeLateralTrunkFlexionDeg(kp);
    case "pelvic_tilt":
      return computePelvicTiltDeg(kp);
    case "hip_mid_x_norm": {
      // Hip midpoint as a fraction of frame width, MIRRORED (1 - x/w) —
      // the weight-shift page's own convention, and it makes positive
      // the patient's right when they face the camera, which is what
      // the left/right filing in the session summary assumes. The
      // absolute number means nothing; range minus rest is the shift.
      // Frame units rather than shoulder widths so a shoulder dropping
      // out of view mid-hold does not change the scale.
      const x = computeHipMidX(kp);
      return x === null || frame.w <= 0 ? null : 1 - x / frame.w;
    }
    case "shoulder_hip_width_ratio": {
      // Retraction narrows the apparent shoulder width; dividing by
      // hip width cancels a step toward or away from the camera.
      const sw = computeShoulderWidth(kp);
      const hw = computeHipWidth(kp);
      return sw === null || hw === null || hw < 1 ? null : sw / hw;
    }
  }
}

export { other as otherSide };
