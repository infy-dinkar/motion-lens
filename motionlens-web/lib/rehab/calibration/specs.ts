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
  | "ANKLE"
  | "HEEL"
  | "FOOT_INDEX"
  | "INDEX"
  | "PINKY"
  | "THUMB";

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
  /** Thigh behind the plumb line side-on (−computeHipAngle "flexion_extension", floored at 0). */
  | "hip_extension"
  /** 180 − hip_flexion: the shoulder–hip–knee angle the bridge page
   *  scores and reports, so its calibration card reads in the same
   *  numbers as its clinical metric. */
  | "hip_interior"
  /** Foot pitch side-on (computeHeelLiftDeg): up as the heel lifts. */
  | "heel_lift"
  /** Shin lean from vertical side-on (computeShinTiltDeg): ankle dorsiflexion with the heel down. */
  | "shin_tilt"
  /** Free ankle above the standing ankle, share of leg length (computeFootLiftRatio). */
  | "foot_lift"
  /** Star excursion: reaching ankle distance from the standing ankle, share of leg length (computeFootReachRatio). */
  | "foot_reach"
  /** Trunk (hip-mid → shoulder-mid) angle from horizontal (computeTrunkAngleFromHorizontal): prone press-ups. */
  | "trunk_from_horizontal"
  /** Side-plank body straightness: shoulder–hip–knee interior at the hip (computeSidePlankLine). */
  | "body_line"
  /** Copenhagen plank: body line through the TOP knee only (computeSidePlankLine with a side). */
  | "body_line_top"
  /** Wrist above the same-side shoulder, share of the trunk length (computeWristRiseRatio). */
  | "wrist_rise"
  /** Cross-body: working elbow toward the other shoulder, share of shoulder width (computeArmCrossRatio). */
  | "arm_cross"
  /** Elbow behind its shoulder, share of trunk length, side-on (computeElbowBehindRatio). */
  | "elbow_behind"
  /** Dead bug: 180 − the smaller hip flexion of the two legs (~90 tabletop, rising as a leg reaches out). */
  | "leg_reach"
  /** Clamshell: angle between the two thighs at the hip-mid, from the front (computeKneeOpeningDeg). */
  | "knee_opening"
  /** Supine abduction: knee gap / hip width from the feet end (computeKneeSpreadRatio). */
  | "knee_spread"
  /** IT band stretch: side bend away from the working leg (computeLeanAwayDeg). */
  | "lean_away"
  /** Quadruped weight shift: shoulder ahead of the wrist, % of the arm (computeShoulderOverWrist). */
  | "shoulder_over_wrist"
  /** Ankle pumps: signed ankle angle, + dorsi / − plantar (lib/rehab/ankleMetrics). */
  | "ankle_pump"
  /** Towel IR stretch: wrist above the hip, % of the trunk, from behind (computeWristAboveHipRatio). */
  | "wrist_above_hip"
  /** Foam roller thoracic extension: ear→hip line above the floor, signed degrees (computeRollerExtension). */
  | "ear_hip_elev"
  /** Wrist flexion/extension, side-on, signed: + up (extension) / − down (computeWristFlexExtDeg). */
  | "wrist_flex_ext"
  /** Pronation/supination, front, forearm toward the camera: pinky→thumb line from up, + supination (computeForearmRotationDialDeg). */
  | "forearm_dial"
  /** Side-lying ER: forearm angle from straight down, from the front (computeForearmFromDownDeg). */
  | "forearm_from_down"
  /** 180 − elbow interior angle: 0 straight, up as the elbow bends. */
  | "elbow_flexion"
  /** Head rotation, unsigned (neck-live computeNeckAngle "rotation"). */
  | "neck_rotation"
  /** Head side tilt, unsigned (neck-live computeNeckAngle "lateral_flexion"). */
  | "neck_lateral_flexion"
  /** Head pitch, unsigned (neck-live computeNeckAngle "flexion_extension"). */
  | "neck_flex_ext"
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
  /** Which way the range hold must move from rest, when the signal's
   *  size alone cannot tell good from bad (posture hold: the corrected
   *  head is LOWER; pushing it further forward also moves the number).
   *  A range the wrong way is blocked with `wrongWayMessage`. */
  rangeDirection?: "lower" | "higher";
  wrongWayMessage?: string;
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

  "sit-to-stand": {
    slug: "sit-to-stand",
    view: "side", posture: "standing", sided: false,
    parts: [A("HIP"), A("KNEE"), A("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "any", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Sit down on the chair",
    holds: [
      rest("Stand tall in front of the chair."),
      range("Sit down on the chair, and stay seated."),
    ],
    note: "Rehab exercise, separate from the orthopedic sit-to-stand assessment. Reads either knee (whichever is clearer).",
  },
  "decline-squat": {
    slug: "decline-squat",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Bend the knee — squat down",
    // No contralateral check: the other leg helps on the way up.
    holds: [
      rest("Stand tall, chosen leg nearest the camera."),
      range("Squat down on the chosen leg as far as is comfortable, and hold."),
    ],
    note: "The range hold sets the page's personal depth line (85% of it); the page times each lowering.",
  },
  "spanish-squat": {
    slug: "spanish-squat",
    view: "side", posture: "standing", sided: false,
    parts: [A("HIP"), A("KNEE"), A("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "any", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Lean back and squat down",
    holds: [
      rest("Stand tall in the strap."),
      range("Lean back into the strap and squat as deep as is comfortable, and hold."),
    ],
    note: "Reads either knee (the clearer one). The range hold sets the page's personal depth line (85% of it).",
  },
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
  "heel-raises": {
    slug: "heel-raises",
    view: "side", posture: "standing", sided: false,
    parts: [A("HIP"), A("KNEE"), A("ANKLE"), A("HEEL"), A("FOOT_INDEX")],
    scaleRef: "thigh",
    signal: "heel_lift", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Rise up onto your toes",
    holds: [
      rest("Stand tall holding a chair, feet flat."),
      range("Rise up onto your toes, and hold."),
    ],
    note: "Rest is the patient's flat-foot pitch; the page counts reps against it, so camera height and foot shape drop out.",
  },
  "isometric-calf-hold": {
    slug: "isometric-calf-hold",
    view: "side", posture: "standing", sided: false,
    parts: [A("HIP"), A("KNEE"), A("ANKLE"), A("HEEL"), A("FOOT_INDEX")],
    scaleRef: "thigh",
    signal: "heel_lift", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Rise up onto your toes",
    holds: [
      rest("Stand tall holding a chair, feet flat."),
      range("Rise up onto your toes, and hold."),
    ],
    note: "Same calibration as heel-raises; rest is the flat-foot zero the page times each hold against.",
  },
  "eccentric-heel-drops": {
    slug: "eccentric-heel-drops",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE"), W("HEEL"), W("FOOT_INDEX")],
    scaleRef: "thigh",
    signal: "heel_lift", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Rise up onto your toes",
    // No contralateral check: the other leg helps the rise on purpose.
    holds: [
      rest("Stand tall holding a rail, feet flat."),
      range("Rise up onto your toes, and hold."),
    ],
    note: "Reads the picked foot only; rest is the flat-foot zero the page times each lowering against.",
  },
  "rathleff-heel-raise": {
    slug: "rathleff-heel-raise",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE"), W("HEEL"), W("FOOT_INDEX")],
    scaleRef: "thigh",
    signal: "heel_lift", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Rise up onto your toes",
    // No contralateral check: the other foot is lifted off the floor.
    holds: [
      rest("Stand tall holding a chair, toes on the towel, foot flat."),
      range("Rise up onto your toes, and hold."),
    ],
    note: "Reads the picked foot only; rest (on the towel) is the zero for the top hold and the lowering.",
  },
  "ankle-pumps": {
    slug: "ankle-pumps",
    view: "side", posture: "seated", sided: true,
    parts: [W("KNEE"), W("ANKLE"), W("HEEL"), W("FOOT_INDEX")],
    scaleRef: "thigh",
    signal: "ankle_pump", signalSide: "working", unit: "deg",
    holds: [
      rest("Sit with the leg straight out and resting on a support, foot relaxed."),
      { id: "range_left", title: "Toes up", instruction: "Pull the toes up toward you as far as you can, and hold." },
      {
        id: "range_right", title: "Toes down",
        instruction: "Now point the toes down like pressing a pedal, and hold.",
        otherSideMessage: "Now point the toes down",
      },
    ],
    note: "Rehab ankle pumps. Signed ankle angle (shin vs sole, 90° neutral; + dorsi / − plantar), rehab's own copy of the biomech assessment's math. The two ends use the two-sided range holds: filed by sign, range_right = up (dorsi), range_left = down (plantar). A gate keeps the knee straight.",
  },
  "calf-wall-stretch": {
    slug: "calf-wall-stretch",
    view: "side", posture: "standing", sided: true,
    parts: [W("KNEE"), W("ANKLE"), W("HEEL"), W("FOOT_INDEX")],
    scaleRef: "thigh",
    signal: "shin_tilt", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Lean toward the wall, back heel down",
    // No contralateral check: the front leg bends as you lean.
    holds: [
      rest("Hands on the wall, chosen leg back, stand upright."),
      range("Lean toward the wall, back heel down, until you feel the calf stretch, and hold."),
    ],
    note: "Shin lean of the back leg = ankle dorsiflexion while the heel stays down (pose gate). The range hold sets the page's personal stretch line (85% of it).",
  },
  "toe-raises": {
    slug: "toe-raises",
    view: "side", posture: "standing", sided: false,
    parts: [A("KNEE"), A("ANKLE"), A("HEEL"), A("FOOT_INDEX")],
    scaleRef: "thigh",
    signal: "heel_lift", signalSide: "none", unit: "deg",
    // The foot pitch DROPS as the toes come up.
    rangeDirection: "lower",
    wrongWayMessage: "Lift your toes, heels stay down",
    holds: [
      rest("Stand (or sit) side-on, feet flat."),
      range("Keep the heels down and lift the toes and front of the feet up, and hold."),
    ],
    note: "Same foot-pitch reading as heel raises, the other way: rest is the flat-foot zero, the toes up read below it.",
  },
  "seated-soleus-raise": {
    slug: "seated-soleus-raise",
    view: "side", posture: "seated", sided: false,
    parts: [A("KNEE"), A("ANKLE"), A("HEEL"), A("FOOT_INDEX")],
    scaleRef: "thigh",
    signal: "heel_lift", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Lift your heels, toes staying down",
    holds: [
      rest("Sit with knees bent and feet flat."),
      range("Lift both heels as high as you can, and hold."),
    ],
    note: "Same signal as heel-raises; seated, so the hip is not required.",
  },
  "triceps-extension": {
    slug: "triceps-extension",
    view: "side", posture: "standing", sided: true,
    parts: [W("SHOULDER"), W("ELBOW"), W("WRIST"), W("HIP")],
    scaleRef: "torso",
    signal: "elbow_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Bend the elbow, hand behind your head",
    holds: [
      rest("Arm straight up overhead, elbow pointing to the ceiling."),
      range("Keeping the elbow up, bend it to lower the hand behind your head, and hold."),
    ],
    note: "Overhead triceps extension. A pose gate keeps the elbow above the shoulder (else it is a curl). The range hold sets the page's personal bend line (85% of it).",
  },
  "wall-push-up": {
    slug: "wall-push-up",
    view: "side", posture: "standing", sided: false,
    parts: [A("SHOULDER"), A("ELBOW"), A("WRIST")],
    scaleRef: "torso",
    signal: "elbow_flexion", signalSide: "any", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Bend the elbows — chest toward the wall",
    holds: [
      rest("Hands on the wall at shoulder height, elbows straight."),
      range("Bend the elbows and bring the chest toward the wall, and hold."),
    ],
    note: "Rehab wall push-up. Elbow bend of the arm bent more (both arms work together). No body-line or hand-height check (user's choice).",
  },
  "biceps-curl": {
    slug: "biceps-curl",
    view: "side", posture: "standing", sided: true,
    parts: [W("SHOULDER"), W("ELBOW"), W("WRIST")],
    scaleRef: "torso",
    signal: "elbow_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Curl the weight up toward your shoulder",
    holds: [
      rest("Stand tall, weight in the hand, arm straight down by your side."),
      range("Curl the weight up toward your shoulder, upper arm by your side, and hold."),
    ],
    note: "Rehab biceps curl (standing, with a weight). Same signal as elbow AROM; the elbow AROM gate keeps the upper arm down. The page counts with a personal line and a short pause.",
  },
  "median-nerve-slider": {
    slug: "median-nerve-slider",
    view: "frontal", posture: "standing", sided: true,
    parts: [W("SHOULDER"), W("ELBOW"), W("WRIST"), B("EAR")],
    scaleRef: "shoulderWidth",
    signal: "elbow_flexion", signalSide: "working", unit: "deg",
    // Elbow bend DROPS as the elbow straightens.
    rangeDirection: "lower",
    wrongWayMessage: "Straighten the elbow",
    holds: [
      rest("Face the camera, arm out to the side at shoulder height, elbow bent, head tilted away."),
      range("Straighten the elbow and tilt your head TOWARD the arm, and hold."),
    ],
    note: "Rehab median nerve slider (radial not built). Lines in elbow straightness (180 − bend). A gate needs the head tilted toward the arm on the range hold (away = tensioner). No arm-height check (user's choice); wrist extension not measured.",
  },
  "ulnar-nerve-tensioner": {
    slug: "ulnar-nerve-tensioner",
    view: "frontal", posture: "standing", sided: true,
    parts: [W("SHOULDER"), W("ELBOW"), W("WRIST"), { part: "NOSE", side: "any" }],
    scaleRef: "shoulderWidth",
    signal: "elbow_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Bend the elbow and bring the hand to your face",
    holds: [
      rest("Face the camera, arm straight out to the side at shoulder height."),
      range("TENSIONER: hand over your eye like a mask, and tilt your head AWAY from the arm, and hold."),
    ],
    note: "Rehab ulnar nerve glide — TENSIONER version (user's choice): mask position with the head tilted AWAY from the arm. Gates: hand at the face, head away (skipped when the ears are hidden).",
  },
  "wrist-flexion-extension": {
    slug: "wrist-flexion-extension",
    view: "side", posture: "seated", sided: true,
    parts: [W("ELBOW"), W("WRIST"), W("INDEX"), W("PINKY")],
    scaleRef: "torso",
    signal: "wrist_flex_ext", signalSide: "working", unit: "deg",
    holds: [
      rest("Forearm on the table, hand over the edge, palm down, fingers straight and relaxed."),
      { id: "range_left", title: "Hand up", instruction: "Bend the wrist UP as far as you can, and hold." },
      {
        id: "range_right", title: "Hand down",
        instruction: "Now bend the wrist DOWN as far as you can, and hold.",
        otherSideMessage: "Now bend the wrist down",
      },
    ],
    note: "Rehab wrist AROM. Signed wrist angle (forearm line vs wrist → index/pinky mid-point, the 'middle finger joint'). Two-sided holds filed by sign: range_right = up (extension), range_left = down (flexion). No forearm-flat check (user's choice).",
  },
  "wrist-flexor-extensor-stretch": {
    slug: "wrist-flexor-extensor-stretch",
    view: "side", posture: "standing", sided: true,
    parts: [W("ELBOW"), W("WRIST"), W("INDEX"), W("PINKY")],
    scaleRef: "torso",
    signal: "wrist_flex_ext", signalSide: "working", unit: "deg",
    holds: [
      rest("Arm straight out in front, wrist straight, fingers relaxed."),
      { id: "range_left", title: "Flexor stretch", instruction: "Palm forward, pull the fingers back toward you with the other hand, and hold." },
      {
        id: "range_right", title: "Extensor stretch",
        instruction: "Now palm down, press the hand down toward you with the other hand, and hold.",
        otherSideMessage: "Now bend the wrist DOWN",
      },
    ],
    note: "Rehab wrist flexor + extensor stretch on one page: 3 holds with the wrist UP (flexor stretch) then 3 with it DOWN (extensor stretch). Same signal as wrist AROM; two-sided holds filed by sign (range_right = up, range_left = down). No elbow-straight check (user's choice).",
  },
  "pronation-supination": {
    slug: "pronation-supination",
    view: "frontal", posture: "seated", sided: true,
    parts: [W("WRIST"), W("THUMB"), W("PINKY"), B("SHOULDER")],
    scaleRef: "shoulderWidth",
    signal: "forearm_dial", signalSide: "working", unit: "deg",
    holds: [
      rest("Face the camera, elbow bent at your side, forearm pointing at the camera, thumb up."),
      { id: "range_left", title: "Palm up", instruction: "Turn the palm UP as far as you can, and hold." },
      {
        id: "range_right", title: "Palm down",
        instruction: "Now turn the palm DOWN as far as you can, and hold.",
        otherSideMessage: "Now turn the palm the other way",
      },
    ],
    note: "Rehab pronation/supination — the most approximate wrist exercise: the hand read as a clock hand (pinky → thumb). Two-sided holds filed by sign: range_right = supination (+), range_left = pronation (−). No elbow-tucked check (user's choice).",
  },
  "wrist-curls": {
    slug: "wrist-curls",
    view: "side", posture: "seated", sided: true,
    parts: [W("ELBOW"), W("WRIST"), W("INDEX"), W("PINKY")],
    scaleRef: "torso",
    signal: "wrist_flex_ext", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Curl the weight up — wrist only",
    holds: [
      rest("Forearm on your thigh, palm up, weight in the hand, wrist hanging down."),
      range("Curl the weight up with the wrist only, and hold."),
    ],
    note: "Rehab dumbbell wrist curl (palm up; reverse curl not built — user's choice). Same signal as wrist AROM: rest = the hanging end, range = the curled end; reaching both is a rep. Approximate — the fingers grip the weight.",
  },
  "eccentric-wrist-extension": {
    slug: "eccentric-wrist-extension",
    view: "side", posture: "seated", sided: true,
    parts: [W("ELBOW"), W("WRIST"), W("INDEX"), W("PINKY")],
    scaleRef: "torso",
    signal: "wrist_flex_ext", signalSide: "working", unit: "deg",
    // Rest = the wrist held UP (by the other hand); range = lowered.
    rangeDirection: "lower",
    wrongWayMessage: "Lower the wrist all the way down",
    holds: [
      rest("Forearm on your thigh, palm down, weight in the hand; lift the wrist UP with the other hand, and hold."),
      range("Now let the wrist down all the way, and hold."),
    ],
    note: "Rehab eccentric wrist extension (PDF: Eccentric wrist extension / Tyler twist (FlexBar)). Same signal as wrist AROM; the page times each slow lowering (lib/rehab/loweringTimer). Palm direction is not seen — the extension and flexion versions look the same to the camera.",
  },
  "eccentric-wrist-flexion": {
    slug: "eccentric-wrist-flexion",
    view: "side", posture: "seated", sided: true,
    parts: [W("ELBOW"), W("WRIST"), W("INDEX"), W("PINKY")],
    scaleRef: "torso",
    signal: "wrist_flex_ext", signalSide: "working", unit: "deg",
    // Rest = the wrist held UP (by the other hand); range = lowered.
    rangeDirection: "lower",
    wrongWayMessage: "Lower the wrist all the way down",
    holds: [
      rest("Forearm on your thigh, palm up, weight in the hand; lift the wrist UP with the other hand, and hold."),
      range("Now let the wrist down all the way, and hold."),
    ],
    note: "Rehab eccentric wrist flexion (PDF: Eccentric wrist flexion / reverse Tyler twist). Same signal as wrist AROM; the page times each slow lowering (lib/rehab/loweringTimer). Palm direction is not seen — the extension and flexion versions look the same to the camera.",
  },
  "dart-throwers-motion": {
    slug: "dart-throwers-motion",
    view: "side", posture: "seated", sided: true,
    parts: [W("ELBOW"), W("WRIST"), W("INDEX"), W("PINKY")],
    scaleRef: "torso",
    signal: "wrist_flex_ext", signalSide: "working", unit: "deg",
    holds: [
      rest("Forearm on the table, thumb UP, wrist straight."),
      { id: "range_left", title: "Back", instruction: "Move the wrist UP and back toward the thumb, like cocking a dart, and hold." },
      {
        id: "range_right", title: "Throw",
        instruction: "Now move it DOWN and forward toward the little finger, like releasing a dart, and hold.",
        otherSideMessage: "Now move the wrist down, toward the little finger",
      },
    ],
    note: "Rehab dart-thrower's motion. Thumb up, so the visible part of the oblique path is up (radial) / down (ulnar) on screen — the same wrist signal as wrist AROM. The forward/back part goes toward the camera and is not seen. Two-sided holds filed by sign (range_right = up, range_left = down).",
  },
  "elbow-arom": {
    slug: "elbow-arom",
    view: "side", posture: "seated", sided: true,
    parts: [W("SHOULDER"), W("ELBOW"), W("WRIST")],
    scaleRef: "torso",
    signal: "elbow_flexion", signalSide: "working", unit: "deg",
    contralateral: true,
    rangeDirection: "higher",
    wrongWayMessage: "Bend your elbow, bringing your hand toward your shoulder",
    holds: [
      rest("Sit tall, arm straight down by your side."),
      range("Bend your elbow, bringing your hand toward your shoulder, and hold."),
    ],
    note: "A pose gate keeps the upper arm down, so lifting the shoulder does not pass as elbow flexion.",
  },
  "eccentric-biceps-curl": {
    slug: "eccentric-biceps-curl",
    view: "side", posture: "seated", sided: true,
    parts: [W("SHOULDER"), W("ELBOW"), W("WRIST")],
    scaleRef: "torso",
    signal: "elbow_flexion", signalSide: "working", unit: "deg",
    contralateral: true,
    rangeDirection: "higher",
    wrongWayMessage: "Bend your elbow, bringing your hand toward your shoulder",
    holds: [
      rest("Sit tall, arm straight down by your side."),
      range("Bend your elbow, bringing your hand toward your shoulder, and hold."),
    ],
    note: "Same calibration and upper-arm gate as elbow-arom; the page adds the slow-lowering rule.",
  },
  "cervical-rotation": {
    slug: "cervical-rotation",
    view: "frontal", posture: "seated", sided: false,
    parts: [{ part: "NOSE", side: "any" }, B("EAR"), B("SHOULDER")],
    scaleRef: "shoulderWidth",
    signal: "neck_rotation", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Turn your head to one side",
    holds: [
      rest("Sit tall, facing the camera, looking straight ahead."),
      range("Turn your head to one side as far as is comfortable, and hold."),
    ],
    note: "Calibration reads the unsigned nose-offset rotation; the page counts reps on the baseline-corrected rotation captured at go-live.",
  },
  "self-snag": {
    slug: "self-snag",
    view: "frontal", posture: "seated", sided: false,
    parts: [{ part: "NOSE", side: "any" }, B("EAR"), B("SHOULDER")],
    scaleRef: "shoulderWidth",
    signal: "neck_rotation", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Turn your head to one side",
    holds: [
      rest("Sit tall, facing the camera, towel round your neck, looking straight ahead."),
      range("Turn your head to the chosen side as far as is comfortable, and hold."),
    ],
    note: "Same calibration as cervical-rotation (unsigned rotation); the page counts only turns toward the picked side, each held at end range.",
  },
  "cervical-side-flexion": {
    slug: "cervical-side-flexion",
    view: "frontal", posture: "seated", sided: false,
    parts: [B("EAR"), B("SHOULDER")],
    scaleRef: "shoulderWidth",
    signal: "neck_lateral_flexion", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Tilt your ear toward your shoulder",
    holds: [
      rest("Sit tall, facing the camera, head upright."),
      range("Tilt your ear toward your shoulder as far as is comfortable, and hold."),
    ],
    note: "A pose gate keeps the shoulders level, so a shrug does not pass as a head tilt.",
  },
  "upper-trap-levator-stretch": {
    slug: "upper-trap-levator-stretch",
    view: "frontal", posture: "seated", sided: false,
    parts: [B("EAR"), B("SHOULDER")],
    scaleRef: "shoulderWidth",
    signal: "neck_lateral_flexion", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Tilt your ear toward your shoulder",
    holds: [
      rest("Sit tall, facing the camera, head upright."),
      range("Tilt your ear toward your shoulder until you feel the stretch, and hold."),
    ],
    note: "Same calibration and shoulders-level gate as cervical-side-flexion; the page counts held stretches.",
  },
  "cervical-flexion-extension": {
    slug: "cervical-flexion-extension",
    view: "side", posture: "seated", sided: false,
    parts: [{ part: "NOSE", side: "any" }, A("EAR"), A("SHOULDER"), A("HIP")],
    scaleRef: "torso",
    signal: "neck_flex_ext", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Nod your chin down toward your chest",
    holds: [
      rest("Sit tall, side-on to the camera, looking straight ahead."),
      range("Nod your chin down toward your chest, and hold."),
    ],
    note: "A pose gate keeps the trunk upright, so leaning the whole body does not pass as a nod.",
  },
  "quad-stretch": {
    slug: "quad-stretch",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Pull your heel up toward your buttock",
    // No contralateral check: the standing leg may soften a little.
    holds: [
      rest("Stand tall holding a chair, both feet down."),
      range("Hold the chosen ankle and pull the heel toward your buttock, knee pointing down, and hold."),
    ],
    note: "Same thigh-down pose gate as the standing hamstring curl. The range hold sets the page's personal stretch line (85% of it).",
  },
  "standing-hamstring-curl": {
    slug: "standing-hamstring-curl",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    // Only the working knee should bend; the other leg is the one standing.
    contralateral: true,
    holds: [
      rest("Stand tall holding a chair, test leg straight."),
      range("Curl your heel up toward your buttock, and hold."),
    ],
    note: "A pose gate keeps the thigh pointing down, so a squat or a hip lift does not pass as a curl.",
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
  "sciatic-nerve-slider": {
    slug: "sciatic-nerve-slider",
    view: "side", posture: "seated", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE"), { part: "NOSE", side: "any" }],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    // Knee flexion DROPS as the knee straightens.
    rangeDirection: "lower",
    wrongWayMessage: "Straighten the knee",
    holds: [
      rest("Sit tall, knee bent, foot on the floor, chin slightly down."),
      range("Straighten the knee while looking up, and hold."),
    ],
    note: "Rehab nerve slider. The page counts knee straightenings with the head NOT bent down (that would be a tensioner). Lines come from the calibration in knee-interior terms (180 − flexion).",
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
  "romanian-deadlift": {
    slug: "romanian-deadlift",
    view: "side", posture: "standing", sided: false,
    parts: [A("SHOULDER"), A("HIP"), A("KNEE"), A("ANKLE")],
    scaleRef: "torso",
    signal: "trunk_extension", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Hinge forward from the hips",
    holds: [
      STAND_TALL,
      range("Hinge forward from the hips, back flat, knees soft, as far as is comfortable — and hold."),
    ],
    note: "Same trunk-tilt reading as hip-hinge. Gates: forward lean only, and knees soft (not a squat). The range hold sets the page's personal hinge line (85% of it).",
  },
  "hip-flexor-stretch": {
    slug: "hip-flexor-stretch",
    // Upright half-kneeling: "seated" gives the right camera messages.
    view: "side", posture: "seated", sided: true,
    parts: [W("SHOULDER"), W("HIP"), W("KNEE"), { part: "NOSE", side: "any" }],
    scaleRef: "torso",
    signal: "hip_extension", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Shift your hips forward, trunk upright",
    // No contralateral check: the front leg bends as the hips move forward.
    holds: [
      rest("Half-kneeling, chosen knee down, trunk upright, thigh straight down."),
      range("Shift your hips forward, trunk upright, until the front of the hip stretches, and hold."),
    ],
    note: "Hip extension of the kneeling leg from the plumb line. A pose gate keeps the trunk upright. The range hold sets the page's personal stretch line (85% of it).",
  },
  "nordic-hamstring-curl": {
    slug: "nordic-hamstring-curl",
    // Upright kneeling: "seated" gives the right camera messages.
    view: "side", posture: "seated", sided: false,
    parts: [A("SHOULDER"), A("HIP"), A("KNEE")],
    scaleRef: "torso",
    signal: "trunk_extension", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Lean forward from the knees, hips straight",
    holds: [
      rest("Kneel upright, heels held down, body straight from knees to shoulders."),
      range("Lean forward from the knees, hips straight, as far as you can control, and hold."),
    ],
    note: "Trunk tilt (as hip-hinge). A pose gate keeps the hips straight (shoulder–hip–knee in line). No ankle points needed. The range hold sets the page's personal depth line (85% of it).",
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
  "seated-thoracic-extension": {
    slug: "seated-thoracic-extension",
    view: "side", posture: "seated", sided: false,
    parts: [A("SHOULDER"), A("HIP"), { part: "NOSE", side: "any" }],
    scaleRef: "torso",
    signal: "trunk_extension", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Arch your upper back backward",
    holds: [
      rest("Sit tall on a chair, hands behind your head."),
      range("Arch your upper back backward over the chair back, and hold."),
    ],
    note: "Same trunk reading and backward-only gate as back-extension. The range hold sets the page's personal line (85% of it).",
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
    rangeDirection: "lower",
    wrongWayMessage: "Other way — tuck your chin in, ear over your shoulder",
    holds: [
      rest("Sit or stand relaxed, as you normally would."),
      range("Tuck your chin and stack your ear over your shoulder — best posture — and hold."),
    ],
    note: "Rest is the HABITUAL position, range is the corrected one, so range < rest. Ear must be clear of hair.",
  },
  "wall-finger-walk": {
    slug: "wall-finger-walk",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("SHOULDER"), W("ELBOW")],
    scaleRef: "torso",
    signal: "shoulder_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Walk your fingers UP the wall",
    contralateral: true,
    holds: [
      rest("Face the wall, arm relaxed by your side."),
      range("Walk your fingers up the wall as high as is comfortable, and hold."),
    ],
    note: "The range hold sets the page's personal up line (85% of it).",
  },
  "wand-flexion": {
    slug: "wand-flexion",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("SHOULDER"), W("ELBOW")],
    scaleRef: "torso",
    signal: "shoulder_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Push the stick UP",
    // No contralateral check: both arms lift the wand together.
    holds: [
      rest("Holding the stick in both hands, arms down."),
      range("Push the stick up as high as is comfortable, and hold."),
    ],
    note: "The range hold sets the page's personal up line (85% of it), as in wall-finger-walk.",
  },
  "table-slides": {
    slug: "table-slides",
    view: "side", posture: "seated", sided: true,
    parts: [W("HIP"), W("SHOULDER"), W("ELBOW")],
    scaleRef: "torso",
    signal: "shoulder_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Slide the hand forward on the table",
    contralateral: true,
    holds: [
      rest("Sit beside the table, hand on the towel near you."),
      range("Slide the hand forward as far as is comfortable, and hold."),
    ],
    note: "The range hold sets the page's personal line (85% of it).",
  },
  "pulley-flexion": {
    slug: "pulley-flexion",
    view: "side", posture: "seated", sided: true,
    parts: [W("HIP"), W("SHOULDER"), W("ELBOW")],
    scaleRef: "torso",
    signal: "shoulder_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Pull the rope so the arm rises forward",
    // No contralateral check: the other arm pulls the rope on purpose.
    holds: [
      rest("Sit under the pulley, rope in both hands, arms down."),
      range("Pull down with the good arm so the chosen arm rises forward as far as is comfortable, and hold."),
    ],
    note: "Like wand-flexion. The range hold sets the page's personal line (85% of it).",
  },
  "serratus-wall-slide": {
    slug: "serratus-wall-slide",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("SHOULDER"), W("ELBOW")],
    scaleRef: "torso",
    signal: "shoulder_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Slide the forearms up the wall",
    // No contralateral check: both arms slide together.
    holds: [
      rest("Face the wall, forearms on it, elbows at shoulder height."),
      range("Slide the forearms up the wall as high as is comfortable, and hold."),
    ],
    note: "Facing the wall (not the existing back-to-wall wall-slide). The range hold sets the page's personal line (85% of it).",
  },
  "wall-slide": {
    slug: "wall-slide",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("SHOULDER"), W("ELBOW")],
    scaleRef: "torso",
    signal: "shoulder_flexion", signalSide: "working", unit: "deg",
    contralateral: true,
    holds: [
      rest("Back to the wall, arm bent, forearm on the wall."),
      range("Slide the arm up the wall as high as is comfortable, and hold."),
    ],
  },

  // ── B. Floor — camera low, trunk horizontal

  "heel-prop": {
    slug: "heel-prop",
    view: "side", posture: "supine", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    // Flexion DROPS as the knee sags straight.
    rangeDirection: "lower",
    wrongWayMessage: "Let the knee straighten — heel on the towel roll",
    holds: [
      rest("Lie on your back, knee a little bent (a hand or small towel under it). Relax."),
      range("Heel on the towel roll, nothing under the knee — let it straighten as far as it goes, and hold."),
    ],
    note: "Rehab heel prop. Lines are in the patient's own flexion (lib/rehab/flexionLines): calibrated range + 3°, never a fixed straight — a knee rarely reads 0° on camera.",
  },
  "heel-slides": {
    slug: "heel-slides",
    view: "side", posture: "supine", sided: true,
    parts: [W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "knee_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Slide your heel toward your buttock",
    contralateral: true,
    holds: [
      rest("Lie on your back, legs straight. Relax."),
      range("Slide your heel in toward your buttock as far as is comfortable, and hold."),
    ],
    note: "The range hold sets the page's personal bend line (85% of it). A pose gate keeps the heel on the floor. Camera at floor level.",
  },
  "straight-leg-raise": {
    slug: "straight-leg-raise",
    view: "side", posture: "supine", sided: true,
    parts: [W("SHOULDER"), W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "hip_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Lift the straight leg up",
    contralateral: true,
    holds: [
      rest("Lie on your back, chosen leg flat and straight, other knee bent."),
      range("Lift the straight leg as high as is comfortable, and hold."),
    ],
    note: "Rehab exercise, separate from the orthopedic SLR assessment. The range hold sets the page's personal up line (85% of it). A pose gate keeps the knee straight. Camera at floor level.",
  },
  "hamstring-stretch": {
    slug: "hamstring-stretch",
    view: "side", posture: "supine", sided: true,
    parts: [W("SHOULDER"), W("HIP"), W("KNEE"), W("ANKLE")],
    scaleRef: "thigh",
    signal: "hip_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Pull the straight leg up with the towel",
    contralateral: true,
    holds: [
      rest("Lie on your back, towel round the chosen foot, leg flat."),
      range("Pull the straight leg up until you feel the stretch, and hold."),
    ],
    note: "Separate from the orthopedic SLR assessment. The range hold sets the page's personal stretch line (85% of it). A pose gate keeps the knee straight. Camera at floor level.",
  },
  "single-leg-bridge": {
    slug: "single-leg-bridge",
    view: "side", posture: "supine", sided: true,
    parts: [W("SHOULDER"), W("HIP"), W("KNEE")],
    scaleRef: "torso",
    signal: "hip_interior", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Lift your hips",
    // No contralateral check: the free leg moves with the pelvis.
    holds: [
      rest("Lie on your back, chosen knee bent, foot flat, other leg straight. Relax."),
      range("Lift your hips on the chosen leg, other leg held out straight, and hold."),
    ],
    note: "Same hip-interior measure as the bridge page. A pose gate checks the other leg is held out straight.",
  },
  "bridge-on-heels": {
    slug: "bridge-on-heels",
    view: "side", posture: "supine", sided: false,
    parts: [A("SHOULDER"), A("HIP"), A("KNEE"), A("ANKLE")],
    scaleRef: "torso",
    signal: "hip_interior", signalSide: "any", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Lift your hips",
    holds: [
      rest("Lie on your back, heels on the floor further out, toes up. Relax."),
      range("Dig the heels in and lift your hips, and hold."),
    ],
    note: "Same hip-interior measure as the bridge page, either side. A pose gate keeps the heels out (knee only a little bent).",
  },
  "knee-to-chest": {
    slug: "knee-to-chest",
    view: "side", posture: "supine", sided: true,
    parts: [W("SHOULDER"), W("HIP"), W("KNEE")],
    scaleRef: "torso",
    signal: "hip_flexion", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Pull the knee toward your chest",
    contralateral: true,
    holds: [
      rest("Lie on your back, both legs flat. Relax."),
      range("Pull the chosen knee toward your chest as far as is comfortable, and hold."),
    ],
    note: "The range hold sets the page's personal line (85% of it). The other leg stays flat (contralateral check). Camera at floor level.",
  },
  "dead-bug": {
    slug: "dead-bug",
    view: "side", posture: "supine", sided: false,
    parts: [A("SHOULDER"), A("HIP"), A("KNEE")],
    scaleRef: "torso",
    signal: "leg_reach", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Reach one leg out toward the floor",
    holds: [
      rest("Lie on your back, arms up, hips and knees bent at 90° (tabletop)."),
      range("Reach one leg out long toward the floor, and hold."),
    ],
    note: "Either leg: the more extended one is read. Arms are in the instructions but not measured (they overlap side-on). The range hold sets the page's personal reach line (85% of it).",
  },
  "clamshell": {
    slug: "clamshell",
    view: "frontal", posture: "supine", sided: false,
    parts: [B("HIP"), B("KNEE")],
    scaleRef: "torso",
    signal: "knee_opening", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Open the top knee, feet together",
    holds: [
      rest("Lie on your side, knees bent, feet and knees together."),
      range("Keeping the feet together, open the top knee as far as is comfortable, and hold."),
    ],
    note: "Side-lying, the front of the body to a floor-level camera ('supine' only for the floor-level camera messages). Side picked on the page = the top (working) leg. The range hold sets the page's personal line (85% of it).",
  },
  "piriformis-stretch": {
    slug: "piriformis-stretch",
    view: "side", posture: "supine", sided: false,
    parts: [A("SHOULDER"), A("HIP"), A("KNEE")],
    scaleRef: "torso",
    signal: "hip_flexion", signalSide: "any", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Pull the bottom thigh toward your chest",
    holds: [
      rest("Lie on your back, chosen ankle crossed over the other knee, foot on the floor."),
      range("Pull the bottom thigh toward your chest until the hip stretches, and hold."),
    ],
    note: "Both thighs lift together, so either side's hip flexion (the larger) is read. The range hold sets the page's personal line (85% of it). The page's side is the crossed (stretched) leg.",
  },
  "supine-abduction-slide": {
    slug: "supine-abduction-slide",
    view: "frontal", posture: "supine", sided: false,
    parts: [B("HIP"), B("KNEE")],
    scaleRef: "shoulderWidth",
    signal: "knee_spread", signalSide: "none", unit: "ratio",
    rangeDirection: "higher",
    wrongWayMessage: "Slide the leg out to the side",
    holds: [
      rest("Lie on your back, legs straight, feet toward the camera."),
      range("Slide the chosen leg out to the side as far as is comfortable, and hold."),
    ],
    note: "Camera at floor level at the FEET end, looking up the body. The range hold sets the page's personal line (85% of it). The page's side is the sliding leg.",
  },
  "bridge": {
    slug: "bridge",
    view: "side", posture: "supine", sided: true,
    parts: [W("SHOULDER"), W("HIP"), W("KNEE")],
    scaleRef: "torso",
    signal: "hip_interior", signalSide: "working", unit: "deg",
    holds: [
      rest("Lie on your back, knees bent, feet flat. Relax."),
      range("Lift your hips as high as is comfortable, and hold."),
    ],
    note: "Records hip INTERIOR (180 - flexion), the page's own metric, so the report's calibration card and clinical metric read in the same numbers. Camera at floor level.",
  },
  "childs-pose": {
    slug: "childs-pose",
    view: "side", posture: "quadruped", sided: false,
    parts: [A("SHOULDER"), A("HIP"), A("KNEE")],
    scaleRef: "torso",
    signal: "hip_flexion", signalSide: "any", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Sit back toward your heels",
    holds: [
      rest("Hands and knees, back flat."),
      range("Sit back toward your heels, arms forward, and hold."),
    ],
    note: "Hip flexion of either side (the clearer one). The range hold sets the page's personal fold line (85% of it).",
  },
  "quadruped-weight-shift": {
    slug: "quadruped-weight-shift",
    view: "side", posture: "quadruped", sided: false,
    parts: [A("SHOULDER"), A("ELBOW"), A("WRIST"), A("HIP")],
    scaleRef: "torso",
    signal: "shoulder_over_wrist", signalSide: "none", unit: "ratio",
    rangeDirection: "higher",
    wrongWayMessage: "Shift forward over your hands",
    holds: [
      rest("Hands and knees, shoulders right over the hands, back flat."),
      range("Shift your body forward so the shoulders go past the hands, elbows straight, and hold."),
    ],
    note: "Rehab shoulder weight-bearing. Shoulder ahead of the wrist as % of the arm; forward is toward the head, so either facing works. A gate keeps the trunk level and the elbows straight.",
  },
  "quadruped-rock-back": {
    slug: "quadruped-rock-back",
    view: "side", posture: "quadruped", sided: false,
    parts: [A("SHOULDER"), A("HIP"), A("KNEE")],
    scaleRef: "torso",
    signal: "hip_flexion", signalSide: "any", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Rock your hips back toward your heels",
    holds: [
      rest("Hands and knees, back flat."),
      range("Rock back as far as you can keep the back flat, and hold."),
    ],
    note: "Same signal as child's pose. The range hold sets the page's personal rock-back line (85% of it).",
  },
  "foam-roller-thoracic-extension": {
    slug: "foam-roller-thoracic-extension",
    view: "side", posture: "supine", sided: false,
    parts: [A("EAR"), A("SHOULDER"), A("HIP"), A("KNEE")],
    scaleRef: "torso",
    signal: "ear_hip_elev", signalSide: "none", unit: "deg",
    // The head DROPS as the upper back extends over the roller.
    rangeDirection: "lower",
    wrongWayMessage: "Extend back over the roller",
    holds: [
      rest("Lie back on the roller, knees bent, hips down, hands behind your head."),
      range("Extend your upper back over the roller, head in your hands, and hold."),
    ],
    note: "Rehab thoracic extension over a foam roller. Signal: ear→hip line above the floor (the head moves about twice as far as the shoulders). Gates: hips stay down (thigh not flattened) and the neck stays in line (no head drop alone).",
  },
  "mckenzie-press-up": {
    slug: "mckenzie-press-up",
    view: "side", posture: "supine", sided: false,
    parts: [A("SHOULDER"), A("HIP"), A("KNEE")],
    scaleRef: "torso",
    signal: "trunk_from_horizontal", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Press your chest up with your arms",
    holds: [
      rest("Lie face down, hands under the shoulders, relaxed."),
      range("Press your chest up with your arms, hips on the floor, and hold."),
    ],
    note: "Prone, so posture 'supine' only for the floor-level camera messages. A pose gate keeps the hips on the floor. The range hold sets the page's personal line (85% of it).",
  },
  "prone-thoracic-extension": {
    slug: "prone-thoracic-extension",
    view: "side", posture: "supine", sided: false,
    parts: [A("SHOULDER"), A("HIP"), A("KNEE")],
    scaleRef: "torso",
    signal: "trunk_from_horizontal", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Lift your chest off the floor",
    holds: [
      rest("Lie face down, arms by your sides or hands behind the head, relaxed."),
      range("Lift your chest off the floor with your back muscles, no push from the arms, and hold."),
    ],
    note: "Same signal and hips-down gate as the McKenzie press-up; a smaller lift, no arm push. Prone, posture 'supine' only for the floor-level camera messages.",
  },
  "open-book": {
    slug: "open-book",
    view: "frontal", posture: "supine", sided: true,
    parts: [W("SHOULDER"), W("WRIST"), W("HIP")],
    scaleRef: "torso",
    signal: "wrist_rise", signalSide: "working", unit: "ratio",
    rangeDirection: "higher",
    wrongWayMessage: "Open the top arm up toward the ceiling",
    holds: [
      rest("Lie on your side, knees bent, both arms straight out in front together."),
      range("Open the top arm up toward the ceiling and over, eyes following the hand, and hold."),
    ],
    note: "Side-lying, the front of the body to a floor-level camera; the side is the TOP arm. Rotation itself is not seen in 2D; the page counts the arm sweeping up past a fixed height.",
  },
  "thread-the-needle": {
    slug: "thread-the-needle",
    view: "side", posture: "quadruped", sided: true,
    parts: [W("SHOULDER"), W("WRIST"), W("HIP")],
    scaleRef: "torso",
    signal: "wrist_rise", signalSide: "working", unit: "ratio",
    rangeDirection: "higher",
    wrongWayMessage: "Open the arm up toward the ceiling",
    holds: [
      rest("Hands and knees, the chosen hand threaded under the other arm."),
      range("Turn and open the chosen arm up toward the ceiling, and hold."),
    ],
    note: "Hands and knees, side-on, the moving arm nearest the camera. Rotation itself is not seen in 2D; the page counts the arm opening up past a fixed height and threading back down.",
  },
  "prone-ytw": {
    slug: "prone-ytw",
    view: "side", posture: "supine", sided: false,
    parts: [A("SHOULDER"), A("WRIST"), A("HIP")],
    scaleRef: "torso",
    signal: "wrist_rise", signalSide: "any", unit: "ratio",
    rangeDirection: "higher",
    wrongWayMessage: "Lift your arms off the floor",
    holds: [
      rest("Lie face down, forehead on a towel, arms resting on the floor."),
      range("Lift both arms off the floor, thumbs up, shoulder blades squeezed, and hold."),
    ],
    note: "Prone ('supine' only for the floor-level camera messages). Either wrist's lift above its shoulder. The arm shape (Y, T and W) is not recognised — the page counts arm lifts with a hold.",
  },
  "prone-iyt": {
    slug: "prone-iyt",
    view: "side", posture: "supine", sided: false,
    parts: [A("SHOULDER"), A("WRIST"), A("HIP")],
    scaleRef: "torso",
    signal: "wrist_rise", signalSide: "any", unit: "ratio",
    rangeDirection: "higher",
    wrongWayMessage: "Lift your arms off the floor",
    holds: [
      rest("Lie face down, forehead on a towel, arms resting on the floor."),
      range("Lift both arms off the floor, thumbs up, shoulder blades squeezed, and hold."),
    ],
    note: "Prone ('supine' only for the floor-level camera messages). Either wrist's lift above its shoulder. The arm shape (I, Y and T) is not recognised — the page counts arm lifts with a hold.",
  },
  "mcgill-curl-up": {
    slug: "mcgill-curl-up",
    view: "side", posture: "supine", sided: false,
    parts: [A("SHOULDER"), A("HIP"), { part: "NOSE", side: "any" }],
    scaleRef: "torso",
    signal: "trunk_from_horizontal", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Lift your head and shoulders slightly",
    holds: [
      rest("Lie on your back, one knee bent, hands under the low back."),
      range("Lift the head and shoulders a little off the floor, neck straight, and hold."),
    ],
    note: "Small lift, so small personal lines. No hips-down rule (one knee is bent on purpose).",
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

  "it-band-stretch": {
    slug: "it-band-stretch",
    view: "frontal", posture: "standing", sided: true,
    parts: [B("SHOULDER"), B("HIP"), B("KNEE")],
    scaleRef: "shoulderWidth",
    signal: "lean_away", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Lean the other way — away from the crossed leg",
    holds: [
      rest("Stand tall facing the camera, feet apart."),
      range("Cross the chosen leg behind the other, push that hip out and lean the upper body the other way, and hold."),
    ],
    note: "Rehab IT band / TFL stretch. Signal is side bend AWAY from the picked leg (positive), so bending toward it is the wrong way. Range hold is gated on the knees being crossed (knee points, not ankles).",
  },
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
  "lateral-hops": {
    slug: "lateral-hops",
    view: "frontal", posture: "standing", sided: true,
    parts: [B("HIP"), B("KNEE")],
    scaleRef: "hipWidth",
    signal: "hip_mid_x_norm", signalSide: "none", unit: "ratio",
    holds: [
      rest("Stand on the chosen leg on one side of the line, other knee lifted a little forward."),
      range("Hop across the line, land on the same leg, and hold."),
    ],
    note: "Rehab lateral hops. Rest and range are the two landing spots (either order); the page counts each arrival in the other spot (lib/rehab/zoneCounter). A gate keeps the other knee up (knees, not ankles).",
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
  "rows": {
    slug: "rows",
    view: "side", posture: "standing", sided: false,
    parts: [A("SHOULDER"), A("ELBOW"), A("WRIST"), A("HIP"), { part: "NOSE", side: "any" }],
    scaleRef: "torso",
    signal: "elbow_flexion", signalSide: "any", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Pull your elbows back",
    holds: [
      rest("Stand side-on, arms straight out in front (band optional)."),
      range("Pull your elbows back past your body, squeeze the shoulder blades, and hold."),
    ],
    note: "Elbow bend of either arm; a pose gate checks the elbow ends up behind the trunk (a pull, not just a bent elbow). The range hold sets the page's personal line (85% of it).",
  },
  "towel-ir-stretch": {
    slug: "towel-ir-stretch",
    view: "back", posture: "standing", sided: true,
    parts: [W("SHOULDER"), W("WRIST"), W("HIP")],
    scaleRef: "torso",
    signal: "wrist_above_hip", signalSide: "working", unit: "ratio",
    rangeDirection: "higher",
    wrongWayMessage: "Pull the towel — slide the lower hand up your back",
    holds: [
      rest("Back to the camera, the chosen hand behind you at the waist holding the towel."),
      range("Pull the towel with the top hand so the lower hand slides up your back, and hold."),
    ],
    note: "Rehab towel internal-rotation stretch, camera behind. Wrist above the hip as % of the trunk. No hand-in-the-middle check (user's choice), so a hand raised at the side also reads as rising.",
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

  "star-excursion": {
    slug: "star-excursion",
    view: "frontal", posture: "standing", sided: true,
    parts: [W("HIP"), B("ANKLE")],
    scaleRef: "shoulderWidth",
    signal: "foot_reach", signalSide: "working", unit: "ratio",
    rangeDirection: "higher",
    wrongWayMessage: "Reach the free foot out further",
    holds: [
      rest("Stand on the chosen leg, facing the camera, free foot beside it."),
      range("Reach the free foot out to the side as far as you can, touch lightly, and hold."),
    ],
    note: "The working side is the STANDING leg. The direction of each reach is not recognised, and reaches straight toward the camera are foreshortened. The range hold sets the page's personal line (85% of it).",
  },
  "single-leg-hops": {
    slug: "single-leg-hops",
    view: "side", posture: "standing", sided: true,
    parts: [W("HIP"), W("KNEE"), B("ANKLE")],
    scaleRef: "thigh",
    signal: "foot_lift", signalSide: "working", unit: "ratio",
    rangeDirection: "higher",
    wrongWayMessage: "Stand on the hopping leg, other foot up",
    holds: [
      rest("Stand side-on, both feet down, hopping leg nearest the camera."),
      range("Stand on the hopping leg with the other foot lifted, and hold."),
    ],
    note: "Rehab hops, separate from the orthopedic single-leg hop test (not imported). Calibration checks the single-leg stance and that both ankles are seen; the page counts hops against the standing ankle height captured at go-live.",
  },
  "single-leg-balance": {
    slug: "single-leg-balance",
    view: "frontal", posture: "standing", sided: true,
    parts: [W("HIP"), B("ANKLE")],
    scaleRef: "shoulderWidth",
    signal: "foot_lift", signalSide: "working", unit: "ratio",
    rangeDirection: "higher",
    wrongWayMessage: "Lift the other foot off the floor",
    holds: [
      rest("Stand tall facing the camera, both feet down, chair nearby."),
      range("Stand on the chosen leg and lift the other foot off the floor, and hold."),
    ],
    note: "Rehab exercise, separate from the orthopedic single-leg stance assessment. The working side is the STANDING leg.",
  },
  "copenhagen-plank": {
    slug: "copenhagen-plank",
    view: "frontal", posture: "supine", sided: true,
    parts: [B("SHOULDER"), B("HIP"), W("KNEE")],
    scaleRef: "torso",
    signal: "body_line_top", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Lift your hips into a straight line",
    holds: [
      rest("Lie on your side, top leg on the bench, hips on the floor."),
      range("Lift your hips so shoulder, hip and top knee make a straight line, and hold."),
    ],
    note: "Side plank with the top leg on a bench; the line runs through the TOP knee only (the bottom leg hangs). The page's side is the top leg.",
  },
  "side-plank": {
    slug: "side-plank",
    view: "frontal", posture: "supine", sided: false,
    parts: [B("SHOULDER"), B("HIP"), B("KNEE")],
    scaleRef: "torso",
    signal: "body_line", signalSide: "none", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Lift your hips into a straight line",
    holds: [
      rest("Lie on your side, elbow under the shoulder, hips on the floor."),
      range("Lift your hips so shoulder, hip and knee make a straight line, and hold."),
    ],
    note: "Camera faces the front of the body. A pose gate checks the body is lifted off the floor at an angle (not lying flat). Side picked on the page = the side that is down.",
  },
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
  "side-lying-er": {
    slug: "side-lying-er",
    view: "frontal", posture: "supine", sided: true,
    parts: [W("SHOULDER"), W("ELBOW"), W("WRIST"), W("HIP")],
    scaleRef: "torso",
    signal: "forearm_from_down", signalSide: "working", unit: "deg",
    rangeDirection: "higher",
    wrongWayMessage: "Rotate the forearm up toward the ceiling",
    holds: [
      rest("Lie on your side, top elbow bent on your waist, hand resting in front of the belly."),
      range("Keeping the elbow on the waist, rotate the hand up toward the ceiling, and hold."),
    ],
    note: "Side-lying, the front of the body to a floor-level camera; the side is the TOP (working) arm. A pose gate keeps the elbow on the waist. The range hold sets the page's personal line (85% of it).",
  },
  "cross-body-stretch": {
    slug: "cross-body-stretch",
    view: "frontal", posture: "standing", sided: true,
    parts: [B("SHOULDER"), W("ELBOW")],
    scaleRef: "shoulderWidth",
    signal: "arm_cross", signalSide: "working", unit: "ratio",
    rangeDirection: "higher",
    wrongWayMessage: "Pull the arm across your chest",
    holds: [
      rest("Stand facing the camera, arms relaxed by your sides."),
      range("Pull the chosen arm across your chest with the other hand, and hold."),
    ],
    note: "Facing the camera. The range hold sets the page's personal line (85% of it). The sleeper stretch (side-lying internal rotation) is not covered — its rotation is not visible in 2D.",
  },
  "doorway-pec-stretch": {
    slug: "doorway-pec-stretch",
    view: "side", posture: "standing", sided: true,
    parts: [W("SHOULDER"), W("ELBOW"), W("HIP"), { part: "NOSE", side: "any" }],
    scaleRef: "torso",
    signal: "elbow_behind", signalSide: "working", unit: "ratio",
    rangeDirection: "higher",
    wrongWayMessage: "Step forward through the doorway",
    holds: [
      rest("Stand in the doorway, forearm on the frame, elbow at shoulder height."),
      range("Step or lean forward until the chest stretches, and hold."),
    ],
    note: "Side-on, the stretched arm nearest the camera. The range hold sets the page's personal line (85% of it).",
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
