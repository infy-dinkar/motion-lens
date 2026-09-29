// Per-exercise pose checks the generic readiness rules cannot express.
//
// Readiness answers "can the camera see what it needs, from the right
// angle". Some exercises also need "is the body in the pose this hold
// asks for", and a single signal cannot tell: external rotation's
// signal reads the same for "elbow folded forward" as for "forearm
// rotated", pelvic hold's tilt reads the same whichever foot is up.
// Each gate looks at the raw keypoints for one slug and returns a block
// message, or null to let the hold run.
//
// Gates only block. They never change the recorded value, so what is
// saved is still the page's own measure.

import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { LM_LIVE as LM } from "@/lib/pose/landmarks-live";
import type { HoldSpec } from "@/lib/rehab/calibration/specs";
import type { Side } from "@/lib/rehab/calibration/signals";

const VIS = 0.35;

export interface GateResult {
  block: string | null;
  /** Numbers for the ?rehabdebug=1 readout. */
  debug: string | null;
}

type Gate = (kp: LiveKeypoint[], holdId: HoldSpec["id"], side: Side | null) => GateResult;

function ok(kp: LiveKeypoint[], i: number): boolean {
  return (kp[i]?.score ?? 0) >= VIS;
}
function d(kp: LiveKeypoint[], a: number, b: number): number {
  return Math.hypot(kp[a].x - kp[b].x, kp[a].y - kp[b].y);
}
const NONE: GateResult = { block: null, debug: null };

// ── External rotation ─────────────────────────────────────────────
//
// Seen on camera: arm hanging, then folding the elbow to 90 degrees
// passed as rotation — the proxy reads the forearm's sideways share,
// and folding changes it. So each hold checks the pose itself:
//   rest  — forearm pointing FORWARD: short on screen next to the
//           upper arm (foreshortened toward the camera)
//   range — forearm OUT to the side: its end is well outside the elbow,
//           roughly level, elbow still tucked by the ribs
/** Rest: forearm on screen at most this share of the upper arm. */
const ER_FORWARD_MAX = 0.6;
/** Range: wrist this far outside the elbow, in upper-arm lengths. */
const ER_OUT_MIN = 0.45;
/** Range: elbow no further than this from the shoulder, sideways, in
 *  shoulder widths. */
const ER_TUCK_MAX = 0.35;

const externalRotation: Gate = (kp, holdId, side) => {
  if (side === null) return NONE;
  const S = side === "left" ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
  const E = side === "left" ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
  const W = side === "left" ? LM.LEFT_WRIST : LM.RIGHT_WRIST;
  if (![S, E, W, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER].every((i) => ok(kp, i))) return NONE;
  const upper = d(kp, S, E);
  if (upper < 1) return NONE;
  const fore = d(kp, E, W);
  const midX = (kp[LM.LEFT_SHOULDER].x + kp[LM.RIGHT_SHOULDER].x) / 2;
  const sw = Math.abs(kp[LM.LEFT_SHOULDER].x - kp[LM.RIGHT_SHOULDER].x);
  // Outward = away from the body midline, whichever way the frame is.
  const out = (Math.abs(kp[W].x - midX) - Math.abs(kp[E].x - midX)) / upper;
  const tuck = sw > 1 ? Math.abs(kp[E].x - kp[S].x) / sw : 0;
  const debug = `fore/upper ${(fore / upper).toFixed(2)} · out ${out.toFixed(2)} · tuck ${tuck.toFixed(2)}`;

  if (holdId === "rest") {
    if (fore / upper > ER_FORWARD_MAX) {
      return { block: "Bend your elbow to 90° with the forearm pointing forward", debug };
    }
    return { block: null, debug };
  }
  if (tuck > ER_TUCK_MAX) return { block: "Keep your elbow tucked at your side", debug };
  if (out < ER_OUT_MIN) return { block: "Rotate the forearm out to the side", debug };
  return { block: null, debug };
};

// ── Pelvic hold ───────────────────────────────────────────────────
//
// Seen on camera: standing on the wrong leg still calibrated — pelvic
// tilt changes whichever foot comes up. `side` here is the STANCE leg.
//   rest  — both feet down
//   range — the non-stance foot is the one off the floor
/** Foot counts as lifted when its ankle is this far above the other,
 *  in body heights (shoulder-mid to ankle-mid). ~3 cm on an adult:
 *  the exercise asks for "a few centimetres". */
const LIFT_MIN = 0.02;

const pelvicHold: Gate = (kp, holdId, side) => {
  if (side === null) return NONE;
  const need = [LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER];
  if (!need.every((i) => ok(kp, i))) {
    return { block: "Step back so both feet are in view", debug: null };
  }
  const shY = (kp[LM.LEFT_SHOULDER].y + kp[LM.RIGHT_SHOULDER].y) / 2;
  const anY = (kp[LM.LEFT_ANKLE].y + kp[LM.RIGHT_ANKLE].y) / 2;
  const bodyH = Math.abs(anY - shY);
  if (bodyH < 1) return NONE;
  const stanceAnkle = side === "left" ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
  const liftAnkle = side === "left" ? LM.RIGHT_ANKLE : LM.LEFT_ANKLE;
  // Positive = the foot that should lift is higher (smaller y).
  const lift = (kp[stanceAnkle].y - kp[liftAnkle].y) / bodyH;
  const debug = `foot lift ${lift.toFixed(3)} (need ≥ ${LIFT_MIN})`;
  const up = side === "left" ? "RIGHT" : "LEFT";
  const stance = side.toUpperCase();

  if (holdId === "rest") {
    if (Math.abs(lift) >= LIFT_MIN) return { block: "Put both feet down", debug };
    return { block: null, debug };
  }
  if (lift <= -LIFT_MIN) {
    return { block: `Wrong foot — stand on your ${stance} leg, lift your ${up} foot`, debug };
  }
  if (lift < LIFT_MIN) return { block: `Lift your ${up} foot a few centimetres`, debug };
  return { block: null, debug };
};

const GATES: Record<string, Gate> = {
  "external-rotation": externalRotation,
  "pelvic-hold": pelvicHold,
};

export function poseGate(
  slug: string,
  kp: LiveKeypoint[],
  holdId: HoldSpec["id"],
  side: Side | null,
): GateResult {
  const g = GATES[slug];
  return g ? g(kp, holdId, side) : NONE;
}
