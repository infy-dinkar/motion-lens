// Shared source of truth for the 23 rehab exercises.
//
// Consumed by:
//   • app/rehab/page.tsx                              (public catalogue)
//   • app/dashboard/patients/[id]/rehab/page.tsx      (doctor-flow launcher)
//   • lib/rehab/progressionLadders.js                 (level ladders per slug)
//   • components/rehab/RehabProgressDashboard.tsx     (grouping in aggregates)
//
// This file is JS (not TS) per the client's stack preference. Consumers
// are TS/TSX and can still import cleanly because tsconfig has
// `allowJs: true`. Adding a new exercise = one new entry here, not a
// coordinated update across four files.

import {
  Dumbbell,
  Footprints,
  Music,
  Spline,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";

/** @typedef {"knee" | "hip" | "back" | "shoulder"} RehabJoint */
/** @typedef {"rep_count" | "hold_in_zone" | "target_reach" | "trace" | "weight_shift" | "match_pose" | "metronome"} MechanicId */

/**
 * @typedef {object} RehabExerciseEntry
 * @property {string} slug
 * @property {string} code
 * @property {RehabJoint} joint
 * @property {string} title
 * @property {MechanicId} mechanic
 * @property {boolean} [hidden]  Kept in the catalogue (the page, its
 *   route and saved reports all still work) but not offered: no card,
 *   not in the prescription editor, never recommended, and dropped
 *   from saved prescriptions. See visibleExercises().
 * @property {string[]} [issues]  Issue codes this exercise is used for
 *   (lib/rehab/issueCodes.js) — from the physio PDF, or researched where
 *   the exercise is not in it. Shown on cards; drives the issue filter.
 * @property {boolean} [needsSide]  True when the exercise is worked one
 *   side at a time and the page asks which. Drives the Left/Right
 *   choice in the prescription editor, and whether a prescribed
 *   session can skip the picker. Absent = bilateral / not sided.
 * @property {string} publicBody
 * @property {string} patientBody
 * @property {import("lucide-react").LucideIcon} icon
 * @property {string} iconTone
 * @property {string} tone
 */

/**
 * @typedef {object} JointMeta
 * @property {string} label
 * @property {string} subtitle
 */

/**
 * @typedef {object} JointGroup
 * @property {RehabJoint} joint
 * @property {JointMeta} meta
 * @property {RehabExerciseEntry[]} items
 */

/** All 23 rehab exercises. Order matters for the public catalogue's
 *  reading flow — grouping is done at render time in each consumer.
 *  @type {RehabExerciseEntry[]} */
export const REHAB_EXERCISES = [
  // ── KNEE ───────────────────────────────────────────────────────
  {
    slug: "squat",
    issues: ["K1", "K2", "K3", "K4", "K9", "H1"],
    code: "K1",
    joint: "knee",
    title: "Controlled Squat",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Quality-gated squat rep counter. Each rep checked against depth (70° knee angle), amplitude (50° excursion), and starting position. Shallow reps flagged transparently. Powered by the Rep-Count mechanic.",
    patientBody:
      "Quality-gated squat rep counter — depth 70° knee angle, amplitude 50°, knee-angle signal. Powered by the Rep-Count mechanic. Side picker before recording.",
    icon: Dumbbell,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },
  {
    slug: "mini-squat",
    issues: ["K1", "K2", "K4", "K5", "H1", "H3", "H4"],
    code: "K2",
    joint: "knee",
    title: "Mini-Squat",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Shallow partial squat — lower intensity than K1. Descend only to ~40° knee flexion, return. Same Rep-Count engine with looser depth gate + smaller amplitude + higher target (12 reps) — suits early-stage / deconditioned patients.",
    patientBody:
      "Shallow partial-squat rep counter. Rep-Count mechanic; looser depth gate + higher target for early-stage patients.",
    icon: Dumbbell,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },
  {
    slug: "knee-extension",
    issues: ["K1", "K2", "K3", "K9", "K10"],
    code: "K3",
    joint: "knee",
    title: "Terminal Knee Extension",
    mechanic: "target_reach",
    needsSide: true,
    publicBody:
      "Active terminal-extension drill — cursor.y is the shared knee extension angle. Top targets target the last 0–27° (post-op terminal band). Target-Reach mechanic.",
    patientBody:
      "Terminal-extension drill — knee-extension angle drives the cursor. Target-Reach mechanic.",
    icon: Target,
    iconTone: "text-cyan-500",
    tone: "from-cyan-500/15 to-cyan-500/5",
  },
  {
    slug: "step-up",
    issues: ["H1", "H7", "H8", "K1", "K2", "K3", "K4", "K9"],
    code: "K4",
    joint: "knee",
    title: "Step-Up Control",
    mechanic: "rep_count",
    needsSide: true,
    hidden: true,
    publicBody:
      "Stepping-leg knee control on a low platform. Patient steps up reaching full extension, lowers under control. The same Rep-Count engine K1 uses gates depth and amplitude.",
    patientBody:
      "Step-up rep counter. Rep-Count mechanic; depth + amplitude gates.",
    icon: Dumbbell,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },
  {
    slug: "wall-sit",
    issues: ["K2", "K3", "K7"],
    code: "K5",
    joint: "knee",
    title: "Wall Sit",
    mechanic: "hold_in_zone",
    needsSide: true,
    publicBody:
      "Isometric wall-sit hold at 80°–100° knee flexion. The in-zone timer accumulates as long as the knee stays inside the band; drift out and it pauses. Hold-in-Zone mechanic. 30 s target.",
    patientBody:
      "Isometric hold at 80°–100° knee flexion. 30 s target. Hold-in-Zone mechanic.",
    icon: Timer,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },
  {
    slug: "single-leg-squat",
    issues: ["K2", "K3", "K8", "K10", "H2"],
    code: "K6",
    joint: "knee",
    title: "Single-Leg Squat",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Unipedal squat — patient stands on the working leg, performs a controlled descent, returns to standing. Reduced amplitude vs the bilateral squat, fewer reps, higher points per rep. Rep-Count mechanic.",
    patientBody:
      "Single-leg squat rep counter. Rep-Count mechanic.",
    icon: Dumbbell,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },

  // ── HIP ────────────────────────────────────────────────────────
  {
    slug: "pelvic-hold",
    issues: ["H1", "H2", "H4", "H7", "L7", "K8"],
    code: "H1",
    joint: "hip",
    title: "Pelvic-Level Hold",
    mechanic: "hold_in_zone",
    needsSide: true,
    publicBody:
      "Trendelenburg retraining — single-leg stance holding the pelvis level (±5° band). Hip drop pauses the timer. 25 s cumulative target. Hold-in-Zone mechanic.",
    patientBody:
      "Trendelenburg retraining — single-leg stance with pelvis level (±5° band). 25 s target. Hold-in-Zone mechanic.",
    icon: Timer,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },
  {
    slug: "hip-abduction",
    issues: ["H1", "H2", "H7", "H8", "K2", "K8", "K10"],
    code: "H2",
    joint: "hip",
    title: "Hip Abduction",
    mechanic: "target_reach",
    needsSide: true,
    publicBody:
      "Standing hip abduction to target — patient lifts the working leg to the side. Cursor.y = the shared hip abduction angle: more lift ⇒ higher targets. Target-Reach mechanic.",
    patientBody:
      "Standing hip abduction — leg lift drives the cursor. Target-Reach mechanic.",
    icon: Target,
    iconTone: "text-cyan-500",
    tone: "from-cyan-500/15 to-cyan-500/5",
  },
  {
    slug: "weight-shift",
    issues: ["H1", "H7", "H8", "K3", "K9", "A5"],
    code: "H3",
    joint: "hip",
    title: "Weight-Shift Balance",
    mechanic: "weight_shift",
    publicBody:
      "Static-standing weight shift capturing 4 lateral zones (±0.4, ±0.8 LoS). Step-out pauses dwell — Weight-Shift mechanic.",
    patientBody:
      "Weight-shift game — capture lateral zones without stepping. Weight-Shift mechanic.",
    icon: Sparkles,
    iconTone: "text-pink-500",
    tone: "from-pink-500/15 to-pink-500/5",
  },
  {
    slug: "bridge",
    issues: ["L1", "L4", "L5", "L6", "L7", "L8", "L9", "H1", "H2", "H3", "H4", "H6", "H7", "H8"],
    code: "H4",
    joint: "hip",
    title: "Bridge",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Supine glute bridge — lift hips toward a straight shoulder-hip-knee line, hold briefly, lower under control. Each cycle = one rep. Rep-Count mechanic.",
    patientBody:
      "Supine glute bridge — Rep-Count mechanic.",
    icon: Dumbbell,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },
  {
    slug: "marching",
    issues: ["H7", "H8", "K1", "K9", "C7"],
    code: "H5",
    joint: "hip",
    title: "Marching",
    mechanic: "metronome",
    publicBody:
      "Cadence-paced marching in place — each knee lift is graded against a steady visual beat (perfect / good / miss). Patient internalises a steady, symmetric gait cadence. Metronome mechanic.",
    patientBody:
      "Cadence-paced marching — knee lifts scored on-beat. Metronome mechanic.",
    icon: Music,
    iconTone: "text-fuchsia-500",
    tone: "from-fuchsia-500/15 to-fuchsia-500/5",
  },
  {
    slug: "lateral-step",
    issues: ["H1", "H2", "H3", "H4", "K2", "K8", "K10"],
    code: "H6",
    joint: "hip",
    title: "Lateral Step",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Side-stepping drill in a maintained quarter-squat stance — patient steps sideways with the working leg, lands in a controlled load, returns to start. Rep-Count mechanic; tight amplitude gate matches the shallower ROM.",
    patientBody:
      "Lateral side-step rep counter. Rep-Count mechanic.",
    icon: Dumbbell,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },

  // ── BACK ───────────────────────────────────────────────────────
  {
    slug: "posture-hold",
    issues: ["C1", "C2", "C3", "C4", "C5", "T1", "T3", "T4", "J1", "J4"],
    code: "B1",
    joint: "back",
    title: "Posture Hold",
    mechanic: "hold_in_zone",
    needsSide: true,
    publicBody:
      "Forward-head reset — patient sits or stands lateral to the camera, holds ear stacked above the shoulder. Drift more than 12° forward pauses the timer. 20 s cumulative target. Hold-in-Zone mechanic.",
    patientBody:
      "Forward-head posture reset. 20 s cumulative target. Hold-in-Zone mechanic.",
    icon: Timer,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },
  {
    slug: "back-extension",
    issues: ["L1", "L2", "L3", "T1"],
    code: "B2",
    joint: "back",
    title: "Back Extension",
    mechanic: "rep_count",
    publicBody:
      "Standing or prone back-extension rep counter. Patient arches the trunk gently backward through a small controlled range, returns to neutral. Each extension-and-return = one rep. Rep-Count mechanic.",
    patientBody:
      "Small-range back-extension rep counter. Rep-Count mechanic.",
    icon: Dumbbell,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },
  {
    slug: "side-bend",
    issues: ["L1", "L6", "T2"],
    code: "B3",
    joint: "back",
    title: "Side Bend",
    mechanic: "target_reach",
    publicBody:
      "Lateral trunk-flexion drill — patient bends to either side to drive a cursor onto spawning targets. Cursor x is signed lateral flexion, cursor y rises with magnitude. Target-Reach mechanic.",
    patientBody:
      "Lateral trunk-flexion to targets. Target-Reach mechanic.",
    icon: Target,
    iconTone: "text-cyan-500",
    tone: "from-cyan-500/15 to-cyan-500/5",
  },
  {
    slug: "bird-dog",
    issues: ["L1", "L2", "L5", "L6", "L7", "L8"],
    code: "B4",
    joint: "back",
    title: "Bird-Dog",
    mechanic: "match_pose",
    needsSide: true,
    publicBody:
      "Core-stability + posterior-chain coordination drill — quadruped position, extend ONE arm forward + the OPPOSITE leg backward, hold a horizontal arm-trunk-leg line. Three joint angles tracked; aggregate ≥ 70 % for ≥ 4 s. Match-Pose mechanic.",
    patientBody:
      "Bird-dog pose match — arm + leg + trunk targets. Match-Pose mechanic.",
    icon: Spline,
    iconTone: "text-lime-500",
    tone: "from-lime-500/15 to-lime-500/5",
  },
  {
    slug: "hip-hinge",
    issues: ["L1", "L8"],
    code: "B5",
    joint: "back",
    title: "Hip Hinge",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Posterior-chain pattern training — patient hinges forward at the hips with a FLAT back, returns to upright. Each cycle = one rep. Rep-Count mechanic.",
    patientBody:
      "Flat-back hinge — Rep-Count mechanic. Trunk-tilt drives reps.",
    icon: Dumbbell,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },
  {
    slug: "cat-cow",
    issues: ["T1", "T2", "T4", "L1", "L6"],
    code: "B6",
    joint: "back",
    title: "Cat-Cow",
    mechanic: "trace",
    publicBody:
      "Gentle spinal-mobility drill from quadruped position — alternate between CAT (round the back) and COW (arch the back) following a slow vertical pacer. Trace mechanic.",
    patientBody:
      "Cat-cow spinal mobility — vertical pacer. Trace mechanic.",
    icon: Spline,
    iconTone: "text-lime-500",
    tone: "from-lime-500/15 to-lime-500/5",
  },

  // ── SHOULDER ───────────────────────────────────────────────────
  {
    slug: "shoulder-raise",
    issues: ["S1", "S2", "S7"],
    code: "S1",
    joint: "shoulder",
    title: "Shoulder Raise",
    mechanic: "target_reach",
    needsSide: true,
    publicBody:
      "Active shoulder abduction to target. Cursor.y is the shared shoulder-elevation angle — patient raises arm to hit higher targets. Target-Reach mechanic.",
    patientBody:
      "Shoulder abduction to targets. Target-Reach mechanic.",
    icon: Target,
    iconTone: "text-cyan-500",
    tone: "from-cyan-500/15 to-cyan-500/5",
  },
  {
    slug: "wall-clock",
    issues: ["S1", "S2", "S3", "S7", "S10"],
    code: "S2",
    joint: "shoulder",
    title: "Wall-Clock Reach",
    mechanic: "target_reach",
    needsSide: true,
    publicBody:
      "Kinesphere-style wall-reach drill — targets spawn at 12 clock positions and the wrist-relative-to-shoulder vector drives the cursor. Target-Reach mechanic.",
    patientBody:
      "Wall-clock reach game. Target-Reach mechanic — wrist drives the cursor.",
    icon: Target,
    iconTone: "text-cyan-500",
    tone: "from-cyan-500/15 to-cyan-500/5",
  },
  {
    slug: "wall-slide",
    issues: ["T1", "T4"],
    code: "S4",
    joint: "shoulder",
    title: "Wall Slide",
    mechanic: "hold_in_zone",
    needsSide: true,
    publicBody:
      "Overhead-reach hold — back-to-wall, slide working arm up to the 140°–160° shoulder flexion band. 20 s cumulative target. Hold-in-Zone mechanic.",
    patientBody:
      "Overhead-reach hold at 140°–160° shoulder flexion. Hold-in-Zone mechanic.",
    icon: Timer,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },
  {
    slug: "external-rotation",
    issues: ["S1", "S2", "S4", "S5", "S7", "S8"],
    code: "S5",
    joint: "shoulder",
    title: "External Rotation (trend)",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Elbow-at-side external rotation rep counter using a forearm-position proxy. Trend-only reading — coarser than a true clinical ER goniometer but useful for tracking session-to-session improvement.",
    patientBody:
      "Elbow-at-side external rotation rep counter (proxy). Rep-Count mechanic.",
    icon: Dumbbell,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },
  {
    slug: "scapular-set",
    issues: ["C1", "C2", "C3", "S1", "S4", "S6", "S9"],
    code: "S6",
    joint: "shoulder",
    title: "Scapular Set (coarse)",
    mechanic: "rep_count",
    hidden: true,
    publicBody:
      "Scapular retraction rep counter using shoulder-width narrowing as a coarse proxy. Auto-calibrates the neutral baseline, then counts retract → release cycles. Rep-Count mechanic — trend-only.",
    patientBody:
      "Scapular retraction rep counter (coarse proxy). Rep-Count mechanic.",
    icon: Dumbbell,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },
];

/** Order in which joint sections render on the catalogue pages. */
export const JOINT_ORDER = ["knee", "hip", "back", "shoulder"];

/** Display labels + brief clinical subtitles for the four groups. */
export const JOINT_META = {
  knee:     { label: "Knee",     subtitle: "Depth, control, and terminal-extension drills." },
  hip:      { label: "Hip",      subtitle: "Abduction, bridging, balance, and gait rhythm." },
  back:     { label: "Back",     subtitle: "Posture, extension, mobility, and core stability." },
  shoulder: { label: "Shoulder", subtitle: "Elevation, reach, rotation, and scapular control." },
};

/**
 * Group the flat catalog by joint, preserving JOINT_ORDER.
 * @param {RehabExerciseEntry[]} [exercises]
 * @returns {JointGroup[]}
 */
export function groupExercisesByJoint(exercises = visibleExercises()) {
  /** @type {Record<RehabJoint, RehabExerciseEntry[]>} */
  const byJoint = { knee: [], hip: [], back: [], shoulder: [] };
  for (const ex of exercises) byJoint[ex.joint]?.push(ex);
  return JOINT_ORDER.map((joint) => ({
    joint: /** @type {RehabJoint} */ (joint),
    meta: JOINT_META[joint],
    items: byJoint[joint],
  }));
}

/**
 * Slug → exercise lookup.
 * @param {string} slug
 * @returns {RehabExerciseEntry | null}
 */
export function findExercise(slug) {
  return REHAB_EXERCISES.find((e) => e.slug === slug) ?? null;
}

/**
 * The exercises that are offered: everything not marked `hidden`.
 * Cards, the prescription editor and the recommender use this;
 * findExercise() still knows every slug so pages and old reports work.
 * @returns {RehabExerciseEntry[]}
 */
export function visibleExercises() {
  return REHAB_EXERCISES.filter((e) => !e.hidden);
}

/**
 * Is this slug offered? False for hidden and for unknown slugs.
 * @param {string} slug
 * @returns {boolean}
 */
export function isOffered(slug) {
  const ex = findExercise(slug);
  return ex !== null && !ex.hidden;
}

/** Slug → joint lookup (used by RehabProgressDashboard for grouping). */
/**
 * Does this exercise ask which side to work?
 *
 * Unknown slugs answer false: a retired exercise cannot be run, so it
 * cannot need a side either.
 *
 * @param {string} slug
 * @returns {boolean}
 */
export function needsSide(slug) {
  return findExercise(slug)?.needsSide === true;
}

export function jointOfSlug(slug) {
  const ex = findExercise(slug);
  return ex ? ex.joint : null;
}
