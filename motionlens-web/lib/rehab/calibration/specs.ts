// Per-exercise calibration specs — the approved plan table, as data.
//
// Before every rehab exercise the patient does two short holds:
//
//   Hold 1 — Start pose:      get into the starting position, stay still
//                             → confirms the camera can see the joint,
//                               records the REST value of the signal
//   Hold 2 — Show your range: move as far as is comfortable, hold there
//                             → records the patient's available RANGE
//
// Both pass → 3-2-1 → the exercise begins. Side bend has a third hold
// for the other side.
//
// There is ONE calibration engine. These rows are the only thing that
// differs between exercises: which view the camera should have, which
// body parts must be visible, which signal to read, and what to say.
// The same arrangement as RepCountShell (one shell, thirteen configs)
// and the Games calibration (one HoldTracker, three hold definitions).
//
// RECORD ONLY. Nothing here changes an exercise's thresholds, rep
// counting, scoring or saved metrics — the two values land beside them
// under metrics.calibration.
//
// Camera views come from each page's own "Camera setup" text, not from
// the mechanic; four of them were wrong in the first draft (hip
// abduction, lateral step and marching are frontal; wall slide is
// side-on), which is why the pages are the source of truth.

/** Which way the patient should face. `either` skips the view check. */
/** "back": frontal width, but the patient faces AWAY from the camera
 *  (scapular set — the shoulder blades are what is being watched). */
export type CalibView = "side" | "frontal" | "back" | "either";

/** Body orientation. The view check assumes an upright trunk; floor
 *  postures need their own branch because the trunk is horizontal. */
export type CalibPosture = "standing" | "seated" | "supine" | "quadruped";

export type BodyPart =
  | "NOSE"
  | "EAR"
  | "SHOULDER"
  | "ELBOW"
  | "WRIST"
  | "HIP"
  | "KNEE"
  | "ANKLE";

/**
 * Which side of the body a required part is on.
 *   working — the prescribed / picked side
 *   other   — the opposite side
 *   both    — both sides must be visible (frontal exercises)
 *   any     — at least one side (side-on exercises with no picked side,
 *             where the far side is naturally occluded)
 */
export type PartSide = "working" | "other" | "both" | "any";

export interface PartReq {
  part: BodyPart;
  side: PartSide;
}

/** Body-relative length used for the distance check, so the band means
 *  the same thing for any body size at any distance from the camera. */
export type ScaleRef = "thigh" | "torso" | "shoulderWidth" | "hipWidth";

/**
 * The number each hold records. Named after the helper that produces
 * it so the mapping in signals.ts is one line per entry. Where a page
 * stores the same quantity under a different convention (bridge keeps
 * hip INTERIOR, the helper returns FLEXION) the conversion happens when
 * the page is wired, not here.
 */
export type CalibSignal =
  | "knee_flexion"
  | "hip_flexion"
  | "hip_abduction"
  | "shoulder_abduction"
  | "shoulder_flexion"
  | "trunk_extension"
  | "forward_head_offset"
  | "spine_flexion_proxy"
  | "lateral_trunk_flexion"
  | "pelvic_tilt"
  | "hip_mid_x_norm"
  | "shoulder_hip_width_ratio"
  | "forearm_rotation_proxy";

export type SignalUnit = "deg" | "ratio";

/** Which side the signal is read from. `any` takes the larger of the
 *  two — marching lifts either knee. */
export type SignalSide = "working" | "any" | "none";

export interface HoldSpec {
  /** Stable id, saved with the value. */
  id: "rest" | "range" | "range_left" | "range_right";
  /** Short heading on the overlay. */
  title: string;
  /** What to tell the patient. Plain, one sentence. */
  instruction: string;
  /** range_right only: the block message while the patient is still
   *  on the first side. */
  otherSideMessage?: string;
}

export interface CalibrationSpec {
  slug: string;
  view: CalibView;
  posture: CalibPosture;
  /** Whether the page has a working side. Drives the facing check and
   *  the resolution of `working` / `other` parts. */
  sided: boolean;
  parts: PartReq[];
  scaleRef: ScaleRef;
  signal: CalibSignal;
  signalSide: SignalSide;
  unit: SignalUnit;
  holds: HoldSpec[];
  /** Only one limb should move. On a range hold, if the OTHER side's
   *  reading moved more than the working side's (and past the minimum),
   *  the hold is blocked with "Use your LEFT leg/arm". Off for
   *  exercises where both limbs move together (squats). */
  contralateral?: boolean;
  /** Anything a wiring engineer needs to know about this row. */
  note?: string;
}

// ── Timing, shared by every exercise ──────────────────────────────

/** Stillness needed to complete a hold. Games use 5 s for one hold;
 *  rehab has two per exercise, so 3 s keeps a session moving. */
export const HOLD_MS = 3000;
/** A hold not completed in this long offers "Start anyway". The patient
 *  is never locked out of the exercise — the Games calibration has no
 *  such exit, and its target population cannot always pass it. */
export const START_ANYWAY_MS = 10_000;
/** After the last hold passes. A clear "go" beat; the 10 s the session
 *  used to allow for positioning is no longer needed. */
export const POST_GATE_COUNTDOWN_SEC = 3;

// ── Hold text, reused where the pose is the same ──────────────────

const STAND_TALL: HoldSpec = {
  id: "rest",
  title: "Start pose",
  instruction: "Stand tall, arms relaxed.",
};

function rest(instruction: string): HoldSpec {
  return { id: "rest", title: "Start pose", instruction };
}
function range(instruction: string): HoldSpec {
  return { id: "range", title: "Show your range", instruction };
}

const W = (part: BodyPart): PartReq => ({ part, side: "working" });
const O = (part: BodyPart): PartReq => ({ part, side: "other" });
const B = (part: BodyPart): PartReq => ({ part, side: "both" });
const A = (part: BodyPart): PartReq => ({ part, side: "any" });

// ── The 23 rows ───────────────────────────────────────────────────

export const CALIBRATION_SPECS: Record<string, CalibrationSpec> = {
  // ── A. Side-on view — working side toward the camera

  "squat": {
    slug: "squat",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    holds: [STAND_TALL, range("Squat down as far as is comfortable, and hold.")],
  },
  "mini-squat": {
    slug: "mini-squat",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    holds: [rest("Stand tall."), range("Bend your knees into a shallow squat, and hold.")],
  },
  "single-leg-squat": {
    slug: "single-leg-squat",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    holds: [
      rest("Stand on your test leg, other foot lifted."),
      range("Bend the standing knee as far as is comfortable, and hold."),
    ],
    note: "Light hand support is allowed throughout, as in the exercise itself.",
  },
  "wall-sit": {
    slug: "wall-sit",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    holds: [
      rest("Stand with your back against the wall."),
      range("Slide down to a comfortable sitting height, and hold."),
    ],
  },
  "knee-extension": {
    slug: "knee-extension",
    view: "side", posture: "seated", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    contralateral: true,
    holds: [
      rest("Sit with the knee bent and relaxed."),
      range("Straighten the knee as far as you can, and hold."),
    ],
    note: "Camera at knee height. Rest is the BENT position; range is maximum extension, so range < rest.",
  },
  "hip-hinge": {
    slug: "hip-hinge",
    view: "side", posture: "standing", sided: false,
    parts: [A("SHOULDER"), A("HIP"), A("KNEE"), A("ANKLE")],
    scaleRef: "torso",
    signal: "trunk_extension", signalSide: "none", unit: "deg",
    holds: [
      STAND_TALL,
      range("Hinge forward from the hips, back flat, as far as is comfortable — and hold."),
    ],
    note: "computeHipHingeAngleDeg is computeTrunkExtensionAngleDeg; the page calls the result trunk_tilt.",
  },
  "back-extension": {
    slug: "back-extension",
    view: "side", posture: "standing", sided: false,
    parts: [A("SHOULDER"), A("HIP")],
    scaleRef: "torso",
    signal: "trunk_extension", signalSide: "none", unit: "deg",
    holds: [STAND_TALL, range("Arch gently backward as far as is comfortable, and hold.")],
  },
  "posture-hold": {
    slug: "posture-hold",
    view: "side", posture: "standing", sided: true,
    parts: [W("EAR"), W("SHOULDER"), W("HIP")],
    scaleRef: "torso",
    signal: "forward_head_offset", signalSide: "working", unit: "deg",
    holds: [
      rest("Sit or stand relaxed, as you normally would."),
      range("Tuck your chin and stack your ear over your shoulder — best posture — and hold."),
    ],
    note: "Rest is the HABITUAL position, range is the corrected one, so range < rest. Ear must be clear of hair.",
  },
  "wall-slide": {
    slug: "wall-slide",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("SHOULDER"), W("ELBOW")],
    scaleRef: "torso",
    signal: "shoulder_flexion", signalSide: "working", unit: "deg",
    holds: [
      rest("Back to the wall, arm bent, forearm on the wall."),
      range("Slide the arm up the wall as high as is comfortable, and hold."),
    ],
  },

  // ── B. Floor — camera low, trunk horizontal

  "bridge": {
    slug: "bridge",
    view: "side", posture: "supine", sided: true,
    parts: [W("SHOULDER"), W("HIP"), W("KNEE")],
    scaleRef: "torso",
    signal: "hip_flexion", signalSide: "working", unit: "deg",
    holds: [
      rest("Lie on your back, knees bent, feet flat. Relax."),
      range("Lift your hips as high as is comfortable, and hold."),
    ],
    note: "Page stores hip INTERIOR (180 - flexion); convert when wiring. Camera at floor level.",
  },
  "cat-cow": {
    slug: "cat-cow",
    view: "side", posture: "quadruped", sided: false,
    parts: [A("SHOULDER"), A("HIP"), { part: "NOSE", side: "any" }],
    scaleRef: "torso",
    signal: "spine_flexion_proxy", signalSide: "none", unit: "deg",
    holds: [
      rest("Hands and knees, back flat and neutral."),
      range("Round your back up toward the ceiling (cat), and hold."),
    ],
  },
  "bird-dog": {
    slug: "bird-dog",
    view: "side", posture: "quadruped", sided: true,
    // ANY shoulder: with the leg side nearest the camera the arm's
    // shoulder is the far one and often faint; requiring it blocked a
    // correctly set-up patient. The arm gate checks it when it is seen.
    parts: [A("SHOULDER"), W("HIP"), W("KNEE")],
    scaleRef: "torso",
    signal: "hip_flexion", signalSide: "working", unit: "deg",
    contralateral: true,
    holds: [
      rest("Hands and knees, back flat."),
      range("Extend the arm forward and the opposite leg back — and hold."),
    ],
    note: "The prescribed side names the LEG (what the page saves); the arm is the other side. Camera ~30 degrees off side-on so both stay in frame.",
  },

  // ── C. Frontal view — lower body

  "hip-abduction": {
    slug: "hip-abduction",
    view: "frontal", posture: "standing", sided: true,
    parts: [B("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "hipWidth",
    signal: "hip_abduction", signalSide: "working", unit: "deg",
    contralateral: true,
    holds: [
      rest("Face the camera, feet together, hand on your support."),
      range("Lift your test leg straight out to the side, and hold."),
    ],
  },
  "lateral-step": {
    slug: "lateral-step",
    view: "frontal", posture: "standing", sided: true,
    parts: [B("KNEE"), B("ANKLE")],
    scaleRef: "hipWidth",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    holds: [
      rest("Face the camera, feet hip-width, knees slightly bent."),
      range("Step wide to your test side and sink into it — and hold."),
    ],
  },
  "marching": {
    slug: "marching",
    view: "frontal", posture: "standing", sided: false,
    parts: [B("HIP"), B("KNEE"), B("ANKLE")],
    scaleRef: "hipWidth",
    signal: "hip_flexion", signalSide: "any", unit: "deg",
    holds: [
      rest("Face the camera, feet hip-width."),
      range("Lift one knee up toward hip height, and hold."),
    ],
    note: "Either leg. The signal takes the larger of the two hip flexions.",
  },
  "step-up": {
    slug: "step-up",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    holds: [
      rest("Stand beside the step."),
      range("Step up and stand tall on the step — and hold."),
    ],
    note: "Side-on, working leg nearest the camera (the reference image). Knee flexion is only trustworthy side-on; a frontal view used to pass.",
  },

  // ── D. Frontal view — trunk and pelvis

  "side-bend": {
    slug: "side-bend",
    view: "frontal", posture: "standing", sided: false,
    parts: [B("SHOULDER"), B("HIP")],
    scaleRef: "shoulderWidth",
    signal: "lateral_trunk_flexion", signalSide: "none", unit: "deg",
    holds: [
      rest("Stand tall, arms at your sides."),
      { id: "range_left", title: "Show your range", instruction: "Bend to one side as far as is comfortable, and hold." },
      {
        id: "range_right", title: "And the other side",
        instruction: "Now bend to the other side, and hold.",
        otherSideMessage: "Now bend to the other side",
      },
    ],
    note: "Three holds. The signal is SIGNED (positive = anatomical right), so left and right are told apart by sign, not by order: the patient may bend either way first, and the third hold is blocked until they bend to the other side.",
  },
  "pelvic-hold": {
    slug: "pelvic-hold",
    view: "frontal", posture: "standing", sided: true,
    parts: [B("HIP")],
    scaleRef: "hipWidth",
    signal: "pelvic_tilt", signalSide: "none", unit: "deg",
    holds: [
      rest("Stand on both feet, pelvis level."),
      range("Stand on your test leg, other foot lifted a few centimetres — and hold."),
    ],
    note: "Sided by stance leg (the page saves side = stance). Both hips must be clearly visible — no loose clothing.",
  },
  "weight-shift": {
    slug: "weight-shift",
    view: "frontal", posture: "standing", sided: false,
    parts: [B("SHOULDER"), B("HIP"), B("ANKLE")],
    scaleRef: "shoulderWidth",
    signal: "hip_mid_x_norm", signalSide: "none", unit: "ratio",
    holds: [
      rest("Stand centred and still."),
      { id: "range_left", title: "Show your range", instruction: "Shift your weight to one side without stepping, and hold." },
      {
        id: "range_right", title: "And the other side",
        instruction: "Now shift your weight to the other side, and hold.",
        otherSideMessage: "Now shift to the other side",
      },
    ],
    note: "The page already locks its own baseline from 10 frames; that logic stays exactly as it is. Hold 1 sits in front of it.",
  },
  "scapular-set": {
    slug: "scapular-set",
    view: "back", posture: "standing", sided: false,
    parts: [B("SHOULDER"), B("HIP")],
    scaleRef: "shoulderWidth",
    signal: "shoulder_hip_width_ratio", signalSide: "none", unit: "ratio",
    holds: [
      rest("Stand with your back to the camera, arms relaxed at your sides."),
      range("Squeeze your shoulder blades back and down, and hold."),
    ],
    note: "The page already locks its own baseline from 10 frames; that logic stays exactly as it is. Hold 1 sits in front of it.",
  },

  // ── E. Frontal view — upper limb

  "shoulder-raise": {
    slug: "shoulder-raise",
    view: "frontal", posture: "standing", sided: true,
    parts: [W("SHOULDER"), W("ELBOW"), W("WRIST"), W("HIP")],
    scaleRef: "shoulderWidth",
    signal: "shoulder_abduction", signalSide: "working", unit: "deg",
    holds: [
      rest("Arm relaxed at your side."),
      range("Raise the arm out to the side as high as is comfortable, and hold."),
    ],
  },
  "external-rotation": {
    slug: "external-rotation",
    view: "frontal", posture: "standing", sided: true,
    parts: [B("SHOULDER"), W("ELBOW"), W("WRIST")],
    scaleRef: "shoulderWidth",
    signal: "forearm_rotation_proxy", signalSide: "working", unit: "deg",
    contralateral: true,
    holds: [
      rest("Elbow tucked at your side, bent to 90 degrees, forearm pointing forward."),
      range("Rotate the forearm outward, keeping the elbow tucked — and hold."),
    ],
  },
  "wall-clock": {
    slug: "wall-clock",
    view: "frontal", posture: "standing", sided: true,
    parts: [B("SHOULDER"), W("WRIST")],
    scaleRef: "shoulderWidth",
    signal: "shoulder_abduction", signalSide: "working", unit: "deg",
    contralateral: true,
    holds: [
      rest("Face the camera, arm relaxed."),
      range("Reach the arm straight up as high as is comfortable, and hold."),
    ],
    note: "The exercise counts circles and has no resting signal of its own; overhead reach is recorded instead, as the circle's ceiling.",
  },
};

/** The spec for a slug, or null for an exercise that has none (a
 *  retired slug still sitting in a saved prescription reaches here). */
export function calibrationSpec(slug: string): CalibrationSpec | null {
  return CALIBRATION_SPECS[slug] ?? null;
}

/** Every slug that has a spec, in a stable order. */
export const CALIBRATED_SLUGS: readonly string[] = Object.keys(CALIBRATION_SPECS);
