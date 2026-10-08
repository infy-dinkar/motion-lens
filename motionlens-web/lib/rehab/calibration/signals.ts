// What each calibration hold measures — one reader per CalibSignal.
//
// Every reader is an existing helper the exercise pages already use,
// called exactly as the pages call it. Calibration therefore records
// the same quantity the exercise itself will score, computed the same
// way, so rest and range are comparable with the session that follows
// and with each other across visits.
//
// Nothing is computed here that is not already computed somewhere in
// lib/rehab/poseMetrics.ts, lib/rehab/ankleMetrics.ts or lib/biomech/*-live.ts.

import { computeAnklePumpDeg } from "@/lib/rehab/ankleMetrics";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { computeKneeAngle } from "@/lib/biomech/knee-live";
import { computeHipAngle } from "@/lib/biomech/hip-live";
import { computeShoulderAngle } from "@/lib/biomech/shoulder-live";
import { computeNeckAngle } from "@/lib/biomech/neck-live";
import {
  computeForearmRotationProxyDeg,
  computeForwardHeadOffsetDeg,
  computeHeelLiftDeg,
  computeShinTiltDeg,
  computeFootLiftRatio,
  computeFootReachRatio,
  computeSidePlankLine,
  computeKneeOpeningDeg,
  computeKneeSpreadRatio,
  computeForearmFromDownDeg,
  computeWristRiseRatio,
  computeArmCrossRatio,
  computeElbowBehindRatio,
  computeTrunkAngleFromHorizontal,
  computeElbowInteriorDeg,
  computeHipAbductionDeg,
  computeHipMidX,
  computeHipWidth,
  computeLateralTrunkFlexionDeg,
  computeLeanAwayDeg,
  computeShoulderOverWrist,
  computeWristAboveHipRatio,
  computeRollerExtension,
  computeWristFlexExtDeg,
  computeForearmRotationDialDeg,
  computeChinTuck,
  computeBothWristsRisePct,
  computeUpperArmFromVerticalDeg,
  computeKneeStrideRatio,
  computeHipMidY,
  computeForearmInwardPct,
  computePunchReachPct,
  computeWristReachPct,
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
    case "hip_extension":
      return sided((sd) => {
        // Signed from the plumb line, forward positive: extension is the
        // thigh BEHIND it, so flip the sign; standing/kneeling upright ≈ 0.
        const v = computeHipAngle("flexion_extension", k, sd);
        return v === null ? null : Math.max(0, -v);
      });
    case "elbow_flexion":
      return sided((sd) => {
        const a = computeElbowInteriorDeg(kp, sd);
        return a === null ? null : 180 - a;
      });
    case "neck_lateral_flexion": {
      const v = computeNeckAngle("lateral_flexion", k as Parameters<typeof computeNeckAngle>[1]);
      return v === null ? null : Math.abs(v);
    }
    case "neck_flex_ext": {
      const v = computeNeckAngle("flexion_extension", k as Parameters<typeof computeNeckAngle>[1]);
      return v === null ? null : Math.abs(v);
    }
    case "neck_rotation":
      return computeNeckAngle("rotation", k as Parameters<typeof computeNeckAngle>[1]);
    case "heel_lift":
      // Unsided (heel raises) reads the clearer foot; sided reads that foot.
      return s === null ? computeHeelLiftDeg(kp) : computeHeelLiftDeg(kp, s);
    case "shin_tilt":
      return sided((sd) => computeShinTiltDeg(kp, sd));
    case "foot_reach":
      return sided((sd) => computeFootReachRatio(kp, sd));
    case "foot_lift":
      return sided((sd) => computeFootLiftRatio(kp, sd));
    case "trunk_from_horizontal":
      return computeTrunkAngleFromHorizontal(kp);
    case "elbow_behind":
      return sided((sd) => computeElbowBehindRatio(kp, sd));
    case "arm_cross":
      return sided((sd) => computeArmCrossRatio(kp, sd));
    case "wrist_rise":
      return sided((sd) => computeWristRiseRatio(kp, sd));
    case "forearm_from_down":
      return sided((sd) => computeForearmFromDownDeg(kp, sd));
    case "wrist_reach":
      return computeWristReachPct(kp);
    case "punch_reach":
      return computePunchReachPct(kp);
    case "forearm_inward":
      return sided((sd) => computeForearmInwardPct(kp, sd));
    case "hip_mid_y_norm": {
      // Frame units ×100, flipped so up is higher (as hip_mid_x_norm).
      const y = computeHipMidY(kp);
      return y === null || frame.h <= 0 ? null : (1 - y / frame.h) * 100;
    }
    case "knee_stride": {
      const r = computeKneeStrideRatio(kp);
      return r === null ? null : Math.abs(r) * 100;
    }
    case "upper_arm_elev":
      return sided((sd) => computeUpperArmFromVerticalDeg(kp, sd));
    case "wrists_rise_both":
      return computeBothWristsRisePct(kp);
    case "chin_tuck_forward":
      return computeChinTuck(kp)?.forward ?? null;
    case "forearm_dial":
      return sided((sd) => computeForearmRotationDialDeg(kp, sd));
    case "wrist_flex_ext":
      return sided((sd) => computeWristFlexExtDeg(kp, sd));
    case "ear_hip_elev":
      return computeRollerExtension(kp)?.elev ?? null;
    case "wrist_above_hip":
      return sided((sd) => computeWristAboveHipRatio(kp, sd));
    case "ankle_pump":
      return sided((sd) => computeAnklePumpDeg(kp, sd));
    case "shoulder_over_wrist":
      return computeShoulderOverWrist(kp)?.shiftPct ?? null;
    case "lean_away":
      return sided((sd) => computeLeanAwayDeg(kp, sd));
    case "knee_spread":
      return computeKneeSpreadRatio(kp);
    case "knee_opening":
      return computeKneeOpeningDeg(kp);
    case "leg_reach": {
      const l = computeHipAngle("flexion", k, "left");
      const r = computeHipAngle("flexion", k, "right");
      const vals = [l, r].filter((v): v is number => v !== null);
      return vals.length === 0 ? null : 180 - Math.min(...vals);
    }
    case "body_line_top":
      return sided((sd) => {
        const l = computeSidePlankLine(kp, sd);
        return l === null ? null : l.straight;
      });
    case "body_line": {
      const l = computeSidePlankLine(kp);
      return l === null ? null : l.straight;
    }
    case "hip_interior":
      return sided((sd) => {
        const f = computeHipAngle("flexion", k, sd);
        return f === null ? null : 180 - f;
      });
    case "hip_abduction":
      return sided((sd) => computeHipAbductionDeg(kp, sd));
    case "shoulder_abduction":
      return sided((sd) => computeShoulderAngle("abduction", k, sd));
    case "shoulder_flexion":
      // The helper is SIGNED by facing direction (-150 facing one way,
      // +150 the other). The size is the angle; the sign would put a
      // left-facing patient's calibration in negative numbers.
      return sided((sd) => {
        const v = computeShoulderAngle("flexion", k, sd);
        return v === null ? null : Math.abs(v);
      });
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
