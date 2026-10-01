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
import { computeShoulderAngle } from "@/lib/biomech/shoulder-live";

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

// ── Bird dog ──────────────────────────────────────────────────────
//
// The signal is the LEG's hip angle; the arm is not measured, so a leg
// extended with the hand still on the floor would pass. `side` is the
// leg (what the page saves); the arm is the other side. The page's
// own arm score peaks at 180 (arm in line with the trunk).
/** Arm counts as reaching forward at this shoulder flexion or more. */
const BIRD_DOG_ARM_MIN = 130;

const birdDog: Gate = (kp, holdId, side) => {
  if (side === null || holdId === "rest") return NONE;
  const armSide: Side = side === "left" ? "right" : "left";
  // The helper is SIGNED by facing direction (head to the image left
  // reads -90 arm down, -180 arm forward); the size is what matters.
  const signed = computeShoulderAngle(
    "flexion",
    kp as unknown as Parameters<typeof computeShoulderAngle>[1],
    armSide,
  );
  const arm = signed === null ? null : Math.abs(signed);
  const debug = `arm ${arm === null ? "—" : arm.toFixed(0)}° (need ≥ ${BIRD_DOG_ARM_MIN})`;
  if (arm === null) return { block: null, debug };
  if (arm < BIRD_DOG_ARM_MIN) {
    return { block: `Reach your ${armSide.toUpperCase()} arm forward too`, debug };
  }
  return { block: null, debug };
};

// ── Hip hinge / back extension: which way the trunk leans ─────────
//
// Both record the trunk's angle from vertical, and that helper is
// UNSIGNED — a forward bend and a backward arch read the same. So the
// range hold checks the direction against the way the face points
// (nose ahead of the ear): hinge = trunk leans the way the face points,
// back extension = the other way. Below TRUNK_LEAN_MIN there is no
// clear lean yet and the gate stays out of the way ("Move further"
// from the session covers it).
/** Shoulder-mid ahead of hip-mid by this share of the torso = a lean. */
const TRUNK_LEAN_MIN = 0.08;

function mid(kp: LiveKeypoint[], a: number, b: number): { x: number; y: number } | null {
  const pa = ok(kp, a), pb = ok(kp, b);
  if (pa && pb) return { x: (kp[a].x + kp[b].x) / 2, y: (kp[a].y + kp[b].y) / 2 };
  if (pa) return kp[a];
  if (pb) return kp[b];
  return null;
}

/** +1 / -1 for the direction the face points along x, or null. */
function facing(kp: LiveKeypoint[]): number | null {
  if (!ok(kp, LM.NOSE)) return null;
  const ear = mid(kp, LM.LEFT_EAR, LM.RIGHT_EAR);
  if (!ear) return null;
  const dx = kp[LM.NOSE].x - ear.x;
  return Math.abs(dx) < 2 ? null : Math.sign(dx);
}

function trunkGate(want: "forward" | "backward"): Gate {
  return (kp, holdId) => {
    if (holdId !== "range") return NONE;
    const sh = mid(kp, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
    const hp = mid(kp, LM.LEFT_HIP, LM.RIGHT_HIP);
    const face = facing(kp);
    if (!sh || !hp || face === null) return NONE;
    const torso = Math.hypot(sh.x - hp.x, sh.y - hp.y);
    if (torso < 1) return NONE;
    const lean = (sh.x - hp.x) / torso; // + = shoulders toward +x
    const debug = `lean ${(lean * face).toFixed(2)} (+ = forward) · face ${face > 0 ? "+x" : "-x"}`;
    if (Math.abs(lean) < TRUNK_LEAN_MIN) return { block: null, debug };
    const forward = Math.sign(lean) === face;
    if (want === "forward" && !forward) {
      return { block: "Other way — hinge FORWARD from the hips", debug };
    }
    if (want === "backward" && forward) {
      return { block: "Other way — arch gently BACKWARD", debug };
    }
    return { block: null, debug };
  };
}

// ── Which side is toward the camera (hip hinge, posture hold) ──────
//
// Seen on camera: picking LEFT and standing with the RIGHT side to the
// camera passed on both pages. The generic facing check compares how
// clearly each side's landmarks are seen, and ears, shoulders and hips
// read about equally well from either side, so it never fires here.
// The face does not lie: the nose points the way the patient faces.
// Keypoints are RAW camera coordinates (the view is mirrored only for
// display), so with the RIGHT side toward the camera the face points
// toward +x, with the LEFT side toward -x.
const sideGate: Gate = (kp, _holdId, side) => {
  if (side === null) return NONE;
  const face = facing(kp);
  if (face === null) return NONE;
  const want = side === "right" ? 1 : -1;
  const debug = `face ${face > 0 ? "+x" : "-x"} (want ${want > 0 ? "+x" : "-x"} for ${side})`;
  if (face !== want) {
    return { block: `Turn around — your ${side.toUpperCase()} side should face the camera`, debug };
  }
  return { block: null, debug };
};

/** First gate that blocks wins; debug lines are joined. */
function both(a: Gate, b: Gate): Gate {
  return (kp, holdId, side) => {
    const r1 = a(kp, holdId, side);
    if (r1.block) return r1;
    const r2 = b(kp, holdId, side);
    const debug = [r1.debug, r2.debug].filter(Boolean).join(" · ") || null;
    return { block: r2.block, debug };
  };
}

// ── Standing hamstring curl ───────────────────────────────────────
//
// The signal is the knee angle, and a squat or a knee lifted forward
// bends the knee too. In a hamstring curl the thigh stays pointing
// down: on the range hold, the hip→knee line must stay within
// THIGH_DOWN_MAX of vertical.
const THIGH_DOWN_MAX = 30;

const hamstringCurl: Gate = (kp, holdId, side) => {
  if (side === null || holdId !== "range") return NONE;
  const H = side === "left" ? LM.LEFT_HIP : LM.RIGHT_HIP;
  const K = side === "left" ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
  if (!ok(kp, H) || !ok(kp, K)) return NONE;
  const dx = kp[K].x - kp[H].x;
  const dy = kp[K].y - kp[H].y;
  if (Math.hypot(dx, dy) < 1) return NONE;
  // 0 = thigh straight down (knee below hip), grows as the thigh swings.
  const thigh = Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
  const debug = `thigh ${thigh.toFixed(0)}° from vertical (max ${THIGH_DOWN_MAX})`;
  if (thigh > THIGH_DOWN_MAX) {
    return { block: "Keep your thigh pointing down — bend only the knee", debug };
  }
  return { block: null, debug };
};

// ── Elbow AROM ─────────────────────────────────────────────────────
//
// Raising the whole arm also changes the elbow angle on screen. The
// upper arm must hang by the side: the shoulder→elbow line stays within
// UPPER_ARM_DOWN_MAX of vertical on the range hold.
const UPPER_ARM_DOWN_MAX = 35;

const elbowArom: Gate = (kp, holdId, side) => {
  if (side === null || holdId !== "range") return NONE;
  const S = side === "left" ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
  const E = side === "left" ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
  if (!ok(kp, S) || !ok(kp, E)) return NONE;
  const dx = kp[E].x - kp[S].x;
  const dy = kp[E].y - kp[S].y;
  if (Math.hypot(dx, dy) < 1) return NONE;
  const upper = Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
  const debug = `upper arm ${upper.toFixed(0)}° from vertical (max ${UPPER_ARM_DOWN_MAX})`;
  if (upper > UPPER_ARM_DOWN_MAX) {
    return { block: "Keep your upper arm by your side — bend only the elbow", debug };
  }
  return { block: null, debug };
};

// ── Cervical side flexion ─────────────────────────────────────────
//
// Shrugging one shoulder up tilts the shoulder→ear line too. The
// shoulders must stay level on the range hold. Facing the camera the
// right shoulder is on the image left, so a level line reads ~180°
// from +x: fold it to the smaller angle from horizontal.
const SHOULDERS_LEVEL_MAX = 10;

const cervicalSideFlex: Gate = (kp, holdId) => {
  if (holdId !== "range") return NONE;
  if (!ok(kp, LM.LEFT_SHOULDER) || !ok(kp, LM.RIGHT_SHOULDER)) return NONE;
  const dx = kp[LM.RIGHT_SHOULDER].x - kp[LM.LEFT_SHOULDER].x;
  const dy = kp[LM.RIGHT_SHOULDER].y - kp[LM.LEFT_SHOULDER].y;
  if (Math.hypot(dx, dy) < 1) return NONE;
  const a = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
  const tilt = Math.min(a, 180 - a);
  const debug = `shoulder line ${tilt.toFixed(0)}° (max ${SHOULDERS_LEVEL_MAX})`;
  if (tilt > SHOULDERS_LEVEL_MAX) {
    return { block: "Keep your shoulders level — tilt only your head", debug };
  }
  return { block: null, debug };
};

// ── Self-SNAG (one-way rotation) ──────────────────────────────────
//
// The calibration signal is the unsigned head turn, so turning the
// wrong way passed the range hold. On the range hold the nose must sit
// toward the picked side of the ear midpoint. Raw (unmirrored) frame:
// the patient's right is image-left, so a turn to the right moves the
// nose to smaller x (negative ratio). Blocks only past a clear margin,
// so a slightly off-centre nose at rest never trips it.
const SNAG_WRONG_WAY_RATIO = 0.25;

const selfSnag: Gate = (kp, holdId, side) => {
  if (holdId !== "range" || side === null) return NONE;
  if (![LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR].every((i) => ok(kp, i))) return NONE;
  const earW = Math.abs(kp[LM.LEFT_EAR].x - kp[LM.RIGHT_EAR].x);
  if (earW < 1) return NONE;
  const earMid = (kp[LM.LEFT_EAR].x + kp[LM.RIGHT_EAR].x) / 2;
  const ratio = (kp[LM.NOSE].x - earMid) / (earW / 2);
  // Positive toward = turned toward the picked side.
  const toward = side === "right" ? -ratio : ratio;
  const debug = `nose ratio ${ratio.toFixed(2)} (toward ${side} ${toward.toFixed(2)}, wrong way past ${SNAG_WRONG_WAY_RATIO})`;
  if (toward < -SNAG_WRONG_WAY_RATIO) {
    return { block: `Turn your head to your ${side.toUpperCase()}, not the other way`, debug };
  }
  return { block: null, debug };
};

// ── Heel slides ───────────────────────────────────────────────────
//
// Lifting the leg off the floor with the knee bent reads the same knee
// angle as a heel slide. Lying side-on, a heel on the floor sits about
// as low on screen as the hip; on the range hold the ankle may not rise
// above the hip by more than HEEL_LIFT_MAX thigh lengths.
const HEEL_LIFT_MAX = 0.3;

const heelSlides: Gate = (kp, holdId, side) => {
  if (holdId !== "range" || side === null) return NONE;
  const H = side === "left" ? LM.LEFT_HIP : LM.RIGHT_HIP;
  const K = side === "left" ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
  const A = side === "left" ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
  if (![H, K, A].every((i) => ok(kp, i))) return NONE;
  const thigh = d(kp, H, K);
  if (thigh < 1) return NONE;
  // Image y grows downward: a raised ankle has a SMALLER y than the hip.
  const lift = (kp[H].y - kp[A].y) / thigh;
  const debug = `ankle above hip ${lift.toFixed(2)} thighs (max ${HEEL_LIFT_MAX})`;
  if (lift > HEEL_LIFT_MAX) {
    return { block: "Keep your heel on the floor — slide it, do not lift", debug };
  }
  return { block: null, debug };
};

// ── Straight leg raise ────────────────────────────────────────────
//
// Bending the knee lifts the thigh too, so the hip angle alone would
// pass a bent-knee lift. On the range hold the working knee must be
// within SLR_KNEE_BENT_MAX of straight (same limit as the page).
const SLR_KNEE_BENT_MAX = 20;

const straightLegRaise: Gate = (kp, holdId, side) => {
  if (holdId !== "range" || side === null) return NONE;
  const H = side === "left" ? LM.LEFT_HIP : LM.RIGHT_HIP;
  const K = side === "left" ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
  const A = side === "left" ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
  if (![H, K, A].every((i) => ok(kp, i))) return NONE;
  const ax = kp[H].x - kp[K].x, ay = kp[H].y - kp[K].y;
  const bx = kp[A].x - kp[K].x, by = kp[A].y - kp[K].y;
  const m = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (m < 1) return NONE;
  const interior = (Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / m))) * 180) / Math.PI;
  const bend = 180 - interior;
  const debug = `knee bend ${bend.toFixed(0)}° (max ${SLR_KNEE_BENT_MAX})`;
  if (bend > SLR_KNEE_BENT_MAX) {
    return { block: "Keep the knee straight — lift the whole leg", debug };
  }
  return { block: null, debug };
};

// ── Cervical flexion / extension ──────────────────────────────────
//
// Leaning the whole trunk forward tips the head too. The trunk (hip →
// shoulder) must stay within TRUNK_UPRIGHT_MAX of vertical on the range
// hold; a chair back allows some recline.
const TRUNK_UPRIGHT_MAX = 20;

const cervicalFlexExt: Gate = (kp, holdId) => {
  if (holdId !== "range") return NONE;
  const sh = mid(kp, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
  const hp = mid(kp, LM.LEFT_HIP, LM.RIGHT_HIP);
  if (!sh || !hp) return NONE;
  const dx = sh.x - hp.x, dy = sh.y - hp.y;
  if (Math.hypot(dx, dy) < 1) return NONE;
  const lean = Math.abs((Math.atan2(dx, -dy) * 180) / Math.PI);
  const debug = `trunk ${lean.toFixed(0)}° from vertical (max ${TRUNK_UPRIGHT_MAX})`;
  if (lean > TRUNK_UPRIGHT_MAX) {
    return { block: "Keep your back still — move only your head", debug };
  }
  return { block: null, debug };
};

const GATES: Record<string, Gate> = {
  "cervical-flexion-extension": cervicalFlexExt,
  "cervical-side-flexion": cervicalSideFlex,
  "upper-trap-levator-stretch": cervicalSideFlex,
  "self-snag": selfSnag,
  "heel-slides": heelSlides,
  "straight-leg-raise": straightLegRaise,
  "hamstring-stretch": straightLegRaise,
  "elbow-arom": elbowArom,
  "eccentric-biceps-curl": elbowArom,
  "standing-hamstring-curl": hamstringCurl,
  "hip-hinge": both(sideGate, trunkGate("forward")),
  "posture-hold": sideGate,
  "back-extension": trunkGate("backward"),
  "bird-dog": birdDog,
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
