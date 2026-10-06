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
  Activity,
  Dumbbell,
  Footprints,
  Music,
  Spline,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";

/** @typedef {"knee" | "hip" | "back" | "shoulder" | "elbow" | "ankle" | "cervical"} RehabJoint */
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
  {
    slug: "standing-hamstring-curl",
    issues: ["K3", "K4", "K5"],
    code: "K7",
    joint: "knee",
    title: "Standing Hamstring Curl",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Standing, holding a chair, curl the heel toward the buttock and lower it — only the knee bends. Rep-Count on the knee angle, side-on camera. Counts reps.",
    patientBody:
      "Heel-to-buttock curls while standing. Counts reps.",
    icon: Dumbbell,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },  {
    slug: "heel-slides",
    issues: ["K1", "K3", "K4", "K9"],
    code: "K8",
    joint: "knee",
    title: "Heel Slides",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Lying on the back, floor-level side-on camera: slide the heel toward the buttock, bending the knee as far as is comfortable, pause, slide back out straight. Rep-Count on knee flexion against a personal bend line (85% of the calibrated range). Counts reps, one leg.",
    patientBody:
      "Lying down, slide the heel in and out. Counts reps.",
    icon: Activity,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },  {
    slug: "straight-leg-raise",
    issues: ["K1", "K2", "K3", "K9"],
    code: "K9",
    joint: "knee",
    title: "Straight Leg Raise",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Lying on the back, other knee bent, floor-level side-on camera: tighten the thigh and lift the straight leg to about the other knee's height, hold 2 s, lower slowly. Rep-Count on hip flexion against a personal up line (85% of the calibrated range); a bent knee does not count. Counts reps, one leg. Separate from the SLR assessment.",
    patientBody:
      "Lying down, lift the straight leg and hold 2 s. Counts reps.",
    icon: Activity,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },  {
    slug: "decline-squat",
    issues: ["K7"],
    code: "K10",
    joint: "knee",
    title: "Decline Squat",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Standing side-on on a decline board (or the floor), lower slowly on the chosen leg (3 s or more) to a personal depth line (85% of the calibrated bend), then stand back up with both legs. Counts only slow lowerings, timed on the knee angle. Counts reps, one leg.",
    patientBody:
      "Slow single-leg squat down, both legs back up. Counts slow reps.",
    icon: Activity,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },  {
    slug: "spanish-squat",
    issues: ["K7", "K11"],
    code: "K11",
    joint: "knee",
    title: "Spanish Squat",
    mechanic: "rep_count",
    publicBody:
      "Strap round the back of both knees, tied to something fixed: lean back and squat to a personal depth line (85% of the calibrated bend), hold 45 s, stand up. Side-on camera; a rep is one held squat, read from the clearer knee. Counts holds.",
    patientBody:
      "Strap-supported squat held 45 s. Counts holds.",
    icon: Activity,
    iconTone: "text-indigo-500",
    tone: "from-indigo-500/15 to-indigo-500/5",
  },  {
    slug: "quad-stretch",
    issues: ["K1", "K2", "K7", "K8", "K11"],
    code: "K12",
    joint: "knee",
    title: "Quad Stretch",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Standing side-on holding a chair: pull the chosen heel toward the buttock, knee pointing down, hold 30 s. A rep is one held stretch, read from knee flexion against a personal line (85% of the calibrated range); a knee lifted forward does not count. Counts holds, one leg.",
    patientBody:
      "Standing thigh stretch, heel to buttock, held 30 s. Counts holds.",
    icon: Activity,
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
  },  {
    slug: "hamstring-stretch",
    issues: ["H6", "K1", "K2"],
    code: "H7",
    joint: "hip",
    title: "Hamstring Stretch",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Lying on the back with a towel round the foot, floor-level side-on camera: pull the straight leg up until a stretch is felt behind the thigh, hold 30 s, lower. A rep is one held stretch, read from hip flexion against a personal stretch line (85% of the calibrated range); a bent knee does not count. Counts holds, one leg.",
    patientBody:
      "Lying down, towel-assisted leg stretch held 30 s. Counts holds.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
  },  {
    slug: "sit-to-stand",
    issues: ["H1", "H7", "H8"],
    code: "H11",
    joint: "hip",
    title: "Sit-to-Stand",
    mechanic: "rep_count",
    publicBody:
      "From a firm chair, side-on camera: stand up fully, then sit back down. A rep is a full stand (knee straight for half a second) from sitting, read from the knee angle of the clearer leg. Counts reps. Separate from the sit-to-stand assessment.",
    patientBody:
      "Stand up from a chair and sit back down. Counts reps.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
  },  {
    slug: "single-leg-bridge",
    issues: ["H3", "H6"],
    code: "H12",
    joint: "hip",
    title: "Single-Leg Bridge",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Lying on the back, floor-level side-on camera: chosen knee bent, foot flat, other leg held out straight; lift the hips, hold 2 s, lower. Rep-Count on the hip interior angle (shoulder–hip–knee), as on the bridge. Counts reps, one leg.",
    patientBody:
      "Bridge on one leg, hold 2 s. Counts reps.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
  },  {
    slug: "bridge-on-heels",
    issues: ["H6"],
    code: "H13",
    joint: "hip",
    title: "Bridge on Heels",
    mechanic: "rep_count",
    publicBody:
      "Lying on the back, heels on the floor further out than a normal bridge, toes up, floor-level side-on camera: lift the hips and hold 20 s (hamstring isometric). A rep is one held bridge, read from the hip interior angle of the clearer side; knees bent like a normal bridge do not count. Counts holds.",
    patientBody:
      "Bridge on the heels, held 20 s. Counts holds.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
  },  {
    slug: "quadruped-rock-back",
    issues: ["H3", "H4"],
    code: "H14",
    joint: "hip",
    title: "Quadruped Rock-Back",
    mechanic: "rep_count",
    publicBody:
      "On hands and knees, side-on camera: rock the hips back toward the heels with the back flat, pause, rock forward. Rep-Count on hip flexion of the clearer side against a personal rock-back line (85% of the calibrated range). Counts reps.",
    patientBody:
      "Rock back and forward on hands and knees. Counts reps.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
  },  {
    slug: "romanian-deadlift",
    issues: ["H6"],
    code: "H15",
    joint: "hip",
    title: "Romanian Deadlift",
    mechanic: "rep_count",
    publicBody:
      "Standing side-on, knees soft: hinge forward from the hips with the back flat until the hamstrings stretch, pause, stand tall. Rep-Count on trunk tilt (as hip hinge) against a personal hinge line (85% of the calibrated range); knees bent into a squat do not count. Counts reps.",
    patientBody:
      "Hip hinge forward with a flat back, stand tall. Counts reps.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
  },  {
    slug: "hip-flexor-stretch",
    issues: ["L1", "L5", "L6", "H5", "H9"],
    code: "H16",
    joint: "hip",
    title: "Hip Flexor Stretch",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Half-kneeling, side-on camera, the stretched side's knee down: keep the trunk upright and shift the hips forward until the front of the hip stretches, hold 30 s. A rep is one held stretch, read from the kneeling thigh's extension against a personal line (85% of the calibrated range); a forward trunk lean does not count. Counts holds, one side.",
    patientBody:
      "Half-kneeling hip flexor stretch, held 30 s. Counts holds.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
  },  {
    slug: "single-leg-balance",
    issues: ["H1", "H4", "H7", "H8", "K3", "K4", "K5", "K6", "K10", "A1", "A3", "A5", "A7", "A10"],
    code: "H17",
    joint: "hip",
    title: "Single-Leg Balance",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Facing the camera, chair within reach: stand on the chosen leg with the other foot lifted, balance 30 s. A rep is one held balance, read from the free ankle's height above the standing ankle; touching down breaks it. Counts holds, one leg. Separate from the single-leg stance assessment.",
    patientBody:
      "Balance on one leg for 30 s. Counts holds.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
  },  {
    slug: "nordic-hamstring-curl",
    issues: ["H6", "K3"],
    code: "H18",
    joint: "hip",
    title: "Nordic Hamstring Curl",
    mechanic: "rep_count",
    publicBody:
      "Kneeling side-on, heels held down: lean forward from the knees as slowly as possible (3 s or more) with the hips straight, catch with the hands, push back up. Counts only slow lowerings past a personal depth line (85% of the calibrated lean), timed on trunk tilt; bending at the hips does not count. Counts reps.",
    patientBody:
      "Slow forward lean from kneeling, hips straight. Counts slow reps.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
  },  {
    slug: "clamshell",
    issues: ["L7", "L9", "H1", "H2", "H3", "H4", "H10", "K2", "K8", "K10"],
    code: "H19",
    joint: "hip",
    title: "Clamshell",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Side-lying, knees bent and feet together, front of the body to a floor-level camera: open the top knee, pause, close. Rep-Count on the angle between the two thighs against a personal line (85% of the calibrated opening). Counts reps, one leg.",
    patientBody:
      "Side-lying knee openings, feet together. Counts reps.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
  },  {
    slug: "piriformis-stretch",
    issues: ["L3", "L7", "H10"],
    code: "H20",
    joint: "hip",
    title: "Piriformis / Figure-4 Stretch",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Lying on the back, floor-level side-on camera, chosen ankle crossed over the other knee: pull the bottom thigh toward the chest until the crossed hip stretches, hold 30 s. A rep is one held stretch, read from hip flexion against a personal line (85% of the calibrated pull). Counts holds, one side.",
    patientBody:
      "Lying figure-4 hip stretch, held 30 s. Counts holds.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
  },  {
    slug: "copenhagen-plank",
    issues: ["H5"],
    code: "H21",
    joint: "hip",
    title: "Copenhagen Adductor Plank",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Side plank with the top leg on a bench (knee easier, foot harder), front of the body to a floor-level camera: lift the hips into a straight shoulder–hip–top-knee line and hold 15 s. A rep is one held plank, read from the straightness of that line. Counts holds, one side.",
    patientBody:
      "Side plank with the top leg on a bench, held 15 s. Counts holds.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
  },  {
    slug: "supine-abduction-slide",
    issues: ["H7", "H8"],
    code: "H22",
    joint: "hip",
    title: "Supine Abduction Slides",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Lying on the back, feet toward a floor-level camera: slide the chosen leg out to the side along the floor, toes up, pause, slide back. Rep-Count on the gap between the knees against a personal line (85% of the calibrated slide). Counts reps, one leg.",
    patientBody:
      "Lying down, slide one leg out to the side and back. Counts reps.",
    icon: Activity,
    iconTone: "text-rose-500",
    tone: "from-rose-500/15 to-rose-500/5",
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
  },  {
    slug: "knee-to-chest",
    issues: ["L4", "L5", "L6"],
    code: "B7",
    joint: "back",
    title: "Knee-to-Chest Stretch",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Lying on the back, floor-level side-on camera: pull the chosen knee toward the chest with both hands, hold 20 s, let it down; the other leg stays flat. A rep is one held stretch, read from hip flexion against a personal line (85% of the calibrated range). Counts holds, one leg.",
    patientBody:
      "Lying down, hug one knee to the chest, hold 20 s. Counts holds.",
    icon: Activity,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },  {
    slug: "childs-pose",
    issues: ["L4", "L6"],
    code: "B8",
    joint: "back",
    title: "Child's Pose",
    mechanic: "rep_count",
    publicBody:
      "From hands and knees, side-on camera: sit back toward the heels, arms forward, chest down; hold 30 s, come back up. A rep is one held stretch, read from hip flexion of the clearer side against a personal fold line (85% of the calibrated range). Counts holds.",
    patientBody:
      "Sit back from hands and knees into child's pose, hold 30 s. Counts holds.",
    icon: Activity,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },  {
    slug: "mckenzie-press-up",
    issues: ["L1", "L2", "L3"],
    code: "B9",
    joint: "back",
    title: "McKenzie Press-up",
    mechanic: "rep_count",
    publicBody:
      "Lying face down, floor-level side-on camera: straighten the arms to press the chest up with the hips on the floor, pause, lower. Rep-Count on the trunk's angle from the floor against a personal line (85% of the calibrated range); hips lifted (a plank) do not count. Counts reps.",
    patientBody:
      "Face-down press-ups, hips on the floor. Counts reps.",
    icon: Activity,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },  {
    slug: "prone-thoracic-extension",
    issues: ["T1", "T3", "T4"],
    code: "B10",
    joint: "back",
    title: "Prone Thoracic Extension",
    mechanic: "rep_count",
    publicBody:
      "Lying face down, floor-level side-on camera, arms by the sides: lift the chest a little with the back muscles (no arm push), hold 3 s, lower. Rep-Count on the trunk's angle from the floor against a personal line (85% of the calibrated range); hips lifted do not count. Counts reps.",
    patientBody:
      "Face-down chest lifts, no arm push, hold 3 s. Counts reps.",
    icon: Activity,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },  {
    slug: "side-plank",
    issues: ["L1", "L5", "L7", "L8"],
    code: "B11",
    joint: "back",
    title: "Side Plank",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Lying on the side, front of the body to a floor-level camera, elbow under the shoulder: lift the hips into a straight shoulder–hip–knee line and hold 20 s. A rep is one held plank, read from the straightness of that line; lying flat does not count. Counts holds, one side.",
    patientBody:
      "Side plank on the forearm, held 20 s. Counts holds.",
    icon: Activity,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },  {
    slug: "dead-bug",
    issues: ["L1", "L5", "L7", "L8", "L9"],
    code: "B12",
    joint: "back",
    title: "Dead Bug",
    mechanic: "rep_count",
    publicBody:
      "Lying on the back, arms up, hips and knees at 90°, floor-level side-on camera: reach one leg out long (opposite arm overhead) with the low back flat, pause, return; alternate. Rep-Count on the more extended leg's hip angle against a personal reach line (85% of the calibrated reach). Counts reps, both legs.",
    patientBody:
      "Lying on the back, reach one leg out at a time. Counts reps.",
    icon: Activity,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },  {
    slug: "open-book",
    issues: ["T1", "T2", "T4"],
    code: "B13",
    joint: "back",
    title: "Open Book Rotation",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Side-lying, knees bent, front of the body to a floor-level camera: open the top arm up toward the ceiling and over, eyes on the hand, pause 2 s, close. Counts the arm sweeping up past a fixed height above the shoulder (the spine rotation itself is not measured in 2D). Counts reps, one side.",
    patientBody:
      "Side-lying upper-back rotation, arm opens like a book. Counts reps.",
    icon: Activity,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },  {
    slug: "thread-the-needle",
    issues: ["T1", "T2"],
    code: "B14",
    joint: "back",
    title: "Thread the Needle",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "On hands and knees, side-on camera, the moving arm nearest it: thread the hand under the other arm, then turn and open it up toward the ceiling, pause 2 s, thread back. Counts the arm opening up past a fixed height above the shoulder (the spine rotation itself is not measured in 2D). Counts reps, one arm.",
    patientBody:
      "Hands-and-knees upper-back rotation, arm threads under and opens up. Counts reps.",
    icon: Activity,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },  {
    slug: "seated-thoracic-extension",
    issues: ["S1", "S9", "T1"],
    code: "B15",
    joint: "back",
    title: "Seated Thoracic Extension",
    mechanic: "rep_count",
    publicBody:
      "Sitting tall on a chair, side-on camera, hands behind the head: arch the upper back backward over the chair back, hold 2 s, sit tall. Rep-Count on trunk tilt (as back extension) against a personal line (85% of the calibrated arch); leaning forward does not count. Counts reps.",
    patientBody:
      "Seated upper-back arches over the chair back. Counts reps.",
    icon: Activity,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },  {
    slug: "mcgill-curl-up",
    issues: ["L1", "L2", "L5", "L8"],
    code: "B16",
    joint: "back",
    title: "McGill Curl-Up",
    mechanic: "rep_count",
    publicBody:
      "Lying on the back, one knee bent, hands under the low back, floor-level side-on camera: lift the head and shoulders a little, neck straight, hold 8 s, lower. Rep-Count on the trunk's angle from the floor against a small personal line (85% of the calibrated lift). Counts reps.",
    patientBody:
      "Small head-and-shoulder lift on the back, held 8 s. Counts reps.",
    icon: Activity,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
  },  {
    slug: "sciatic-nerve-slider",
    issues: ["L3", "L8"],
    code: "B17",
    joint: "back",
    title: "Sciatic Nerve Slider",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Seated, side-on camera: straighten the chosen knee while looking up, bend it back while bringing the chin down. Rep-Count on knee straightness against a personal line (85% of the calibrated straightening); chin down with the knee straight (a tensioner) does not count. Counts reps, one leg.",
    patientBody:
      "Seated nerve glide: knee straight + look up, knee bent + chin down. Counts reps.",
    icon: Activity,
    iconTone: "text-teal-500",
    tone: "from-teal-500/15 to-teal-500/5",
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
    slug: "eccentric-biceps-curl",
    issues: ["S8"],
    code: "S7",
    joint: "shoulder",
    title: "Eccentric Biceps Curl",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Upper arm by the side, bend the elbow, then lower the hand slowly — at least 2 seconds — until the arm is straight. A light weight is optional. Rep-Count on the elbow angle with a lowering-time rule, side-on camera. Counts slow reps.",
    patientBody:
      "Slow-lowering biceps curls. Counts slow reps.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },  {
    slug: "wall-finger-walk",
    issues: ["S1", "S2", "S3", "S7", "S10"],
    code: "S8",
    joint: "shoulder",
    title: "Wall Finger Walk",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Facing a wall, side-on camera: walk the fingers up the wall as high as is comfortable, hold 3 s, walk back down. Rep-Count on shoulder flexion against a personal up line (85% of the calibrated range). Counts reps, one arm.",
    patientBody:
      "Finger-walk up the wall, hold 3 s, back down. Counts reps.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },  {
    slug: "wand-flexion",
    issues: ["S1", "S2", "S3", "S7", "S10"],
    code: "S9",
    joint: "shoulder",
    title: "Wand Shoulder Flexion (AAROM)",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Holding a stick in both hands, side-on camera: the good arm pushes the stick up, lifting the working arm forward and overhead; hold 2 s, lower. Rep-Count on the working arm's shoulder flexion against a personal up line (85% of the calibrated range). Counts reps, one arm.",
    patientBody:
      "Stick-assisted arm raises overhead, hold 2 s. Counts reps.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },  {
    slug: "table-slides",
    issues: ["S2", "S3", "S7", "S10"],
    code: "S10",
    joint: "shoulder",
    title: "Table Slides",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Seated beside a table, side-on camera, hand on a towel: slide the hand forward as far as is comfortable, pause 2 s, slide back. Rep-Count on shoulder flexion against a personal line (85% of the calibrated reach). Counts reps, one arm.",
    patientBody:
      "Slide the hand forward on a table, pause, slide back. Counts reps.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },  {
    slug: "rows",
    issues: ["S1", "S4", "S6", "S9", "T1", "T3"],
    code: "S11",
    joint: "shoulder",
    title: "Rows / Scapular Retraction",
    mechanic: "rep_count",
    publicBody:
      "Standing side-on, arms out front, with a resistance band or no equipment: pull the elbows back past the body, squeeze the shoulder blades, hold 2 s, arms forward. Rep-Count on elbow bend of the clearer arm against a personal line (85% of the calibrated pull); an elbow bent in front of the body does not count. Counts reps.",
    patientBody:
      "Rows (band optional), squeeze the shoulder blades 2 s. Counts reps.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },  {
    slug: "pulley-flexion",
    issues: ["S3", "S7", "S10"],
    code: "S12",
    joint: "shoulder",
    title: "Pulley-Assisted Flexion",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Seated under an over-door pulley, side-on camera: the good arm pulls the rope so the chosen arm rises forward and up; hold 2 s, lower. Rep-Count on the chosen arm's shoulder flexion against a personal up line (85% of the calibrated range). Counts reps, one arm.",
    patientBody:
      "Pulley-assisted arm raises, hold 2 s. Counts reps.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },  {
    slug: "side-lying-er",
    issues: ["S1", "S2", "S4"],
    code: "S13",
    joint: "shoulder",
    title: "Side-Lying External Rotation",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Side-lying, front of the body to a floor-level camera, top elbow bent 90° on the waist: rotate the hand up toward the ceiling, pause, lower. Rep-Count on the forearm's angle from straight down against a personal line (85% of the calibrated rotation); lifting the elbow does not count. Counts reps, one arm.",
    patientBody:
      "Side-lying shoulder rotations, elbow on the waist. Counts reps.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },  {
    slug: "cross-body-stretch",
    issues: ["S1", "S3", "S5"],
    code: "S14",
    joint: "shoulder",
    title: "Cross-Body Shoulder Stretch",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Facing the camera: pull the chosen arm across the chest with the other hand until the back of the shoulder stretches, hold 30 s. A rep is one held stretch, read from how far the elbow crosses toward the other shoulder against a personal line (85% of the calibrated range). Counts holds, one arm. (The sleeper stretch is not covered.)",
    patientBody:
      "Arm-across-the-chest shoulder stretch, held 30 s. Counts holds.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },  {
    slug: "serratus-wall-slide",
    issues: ["S1", "S4", "S6", "S9"],
    code: "S15",
    joint: "shoulder",
    title: "Serratus Wall Slide",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Facing a wall, side-on camera, forearms on the wall at shoulder height: slide the forearms up, shoulder blades moving forward and up, pause 2 s, slide down. Rep-Count on shoulder flexion against a personal line (85% of the calibrated slide). Counts reps.",
    patientBody:
      "Forearms-on-the-wall slides up and down. Counts reps.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },  {
    slug: "prone-ytw",
    issues: ["C1", "C2"],
    code: "S16",
    joint: "shoulder",
    title: "Prone Y-T-W",
    mechanic: "rep_count",
    publicBody:
      "Face down, floor-level side-on camera: lift both arms off the floor in the Y, T and W shapes, thumbs up, shoulder blades squeezed, hold 2 s, lower. Counts arm lifts past a fixed height held 2 s (the shape itself is not recognised). Counts reps.",
    patientBody:
      "Face-down arm lifts in Y, T and W shapes, hold 2 s. Counts reps.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },  {
    slug: "prone-iyt",
    issues: ["S1", "S4", "S9"],
    code: "S17",
    joint: "shoulder",
    title: "Prone I-Y-T",
    mechanic: "rep_count",
    publicBody:
      "Face down, floor-level side-on camera: lift both arms off the floor in the I, Y and T shapes, thumbs up, shoulder blades squeezed, hold 2 s, lower. Counts arm lifts past a fixed height held 2 s (the shape itself is not recognised). Counts reps.",
    patientBody:
      "Face-down arm lifts in I, Y and T shapes, hold 2 s. Counts reps.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },  {
    slug: "doorway-pec-stretch",
    issues: ["S1", "S9"],
    code: "S18",
    joint: "shoulder",
    title: "Doorway Pec Stretch",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "In a doorway, side-on camera, forearm on the frame with the elbow at shoulder height: step or lean forward until the chest stretches, hold 30 s. A rep is one held stretch, read from how far the elbow sits behind the shoulder against a personal line (85% of the calibrated lean). Counts holds, one arm.",
    patientBody:
      "Doorway chest stretch, held 30 s. Counts holds.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
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
  {
    slug: "heel-raises",
    issues: ["A1", "A2", "A3", "A4", "A5", "A6", "A9", "K1", "K3", "K9"],
    code: "A1",
    joint: "ankle",
    title: "Heel Raises",
    mechanic: "rep_count",
    publicBody:
      "Standing, holding a chair, rise onto the toes and lower the heels. Both feet together. Rep-Count on the foot's pitch against the patient's own flat foot, side-on camera. Counts reps.",
    patientBody:
      "Calf raises on both feet. Counts reps.",
    icon: Footprints,
    iconTone: "text-emerald-500",
    tone: "from-emerald-500/15 to-emerald-500/5",
  },
  {
    slug: "seated-soleus-raise",
    issues: ["A2", "A9"],
    code: "A2",
    joint: "ankle",
    title: "Seated Soleus Raise",
    mechanic: "rep_count",
    publicBody:
      "Seated, knees bent ~90°, lift both heels and lower them — the bent knee slackens the gastrocnemius so the soleus works. Same foot-pitch Rep-Count as Heel Raises, side-on camera. Counts reps.",
    patientBody:
      "Seated heel lifts for the soleus. Counts reps.",
    icon: Footprints,
    iconTone: "text-emerald-500",
    tone: "from-emerald-500/15 to-emerald-500/5",
  },
  {
    slug: "isometric-calf-hold",
    issues: ["A2", "A3", "A9"],
    code: "A3",
    joint: "ankle",
    title: "Isometric Calf Hold",
    mechanic: "rep_count",
    publicBody:
      "Standing, holding a chair, rise onto the toes and hold still for 10 s, then lower. Both feet together. A rep is one rise held 10 s, read from the foot's pitch against the patient's own flat foot, side-on camera. Counts holds.",
    patientBody:
      "Rise onto the toes and hold 10 s. Counts holds.",
    icon: Footprints,
    iconTone: "text-emerald-500",
    tone: "from-emerald-500/15 to-emerald-500/5",
  },
  {
    slug: "eccentric-heel-drops",
    issues: ["A2", "A3"],
    code: "A4",
    joint: "ankle",
    title: "Eccentric Heel Drops",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Standing side-on on a step edge, rise onto the toes with both legs, then lower the chosen heel slowly (3 s or more) to flat or below. Counts only slow lowerings, timed on the chosen foot's pitch against the patient's own flat foot. Counts reps, one leg.",
    patientBody:
      "Rise on both feet, lower slowly on one. Counts slow reps.",
    icon: Footprints,
    iconTone: "text-emerald-500",
    tone: "from-emerald-500/15 to-emerald-500/5",
  },
  {
    slug: "rathleff-heel-raise",
    issues: ["A4"],
    code: "A5",
    joint: "ankle",
    title: "Rathleff Heel Raise",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Single-leg heel raise with a rolled towel under the toes: rise, hold 2 s at the top, lower over 2 s or more. Side-on camera; a rep needs both the top hold and the slow lowering, read from the chosen foot's pitch against the patient's own resting foot. Counts reps, one leg.",
    patientBody:
      "One-leg heel raise, toes on a towel: hold at the top, lower slowly. Counts reps.",
    icon: Footprints,
    iconTone: "text-emerald-500",
    tone: "from-emerald-500/15 to-emerald-500/5",
  },  {
    slug: "calf-wall-stretch",
    issues: ["A2", "A4", "A5", "A7", "A9"],
    code: "A6",
    joint: "ankle",
    title: "Calf Wall Stretch",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Hands on a wall, chosen leg back with the heel down, side-on camera: lean in until the calf stretches, hold 30 s (knee straight = gastrocnemius, bent = soleus). A rep is one held stretch, read from the back shin's lean against a personal line (85% of the calibrated range); a lifted heel does not count. Counts holds, one leg.",
    patientBody:
      "Wall calf stretch, heel down, held 30 s. Counts holds.",
    icon: Footprints,
    iconTone: "text-emerald-500",
    tone: "from-emerald-500/15 to-emerald-500/5",
  },  {
    slug: "toe-raises",
    issues: ["A9"],
    code: "A7",
    joint: "ankle",
    title: "Toe Raises (Tibialis Anterior)",
    mechanic: "rep_count",
    publicBody:
      "Standing or sitting side-on, feet flat: keep the heels down and lift the toes and front of the feet toward the shins, pause, lower. Rep-Count on the foot's pitch below the patient's own flat foot (heel raises the other way). Counts reps.",
    patientBody:
      "Heels down, lift the toes up. Counts reps.",
    icon: Footprints,
    iconTone: "text-emerald-500",
    tone: "from-emerald-500/15 to-emerald-500/5",
  },  {
    slug: "star-excursion",
    issues: ["A1", "A10"],
    code: "A8",
    joint: "ankle",
    title: "Star Excursion Balance",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Standing on the chosen leg, facing the camera: reach the free foot as far as possible in different directions, touch lightly, return to the centre. Rep-Count on the distance between the ankles (share of leg length) against a personal line (85% of the calibrated reach); directions are not recognised. Counts reaches, one standing leg.",
    patientBody:
      "Stand on one leg and reach the other foot out in a star. Counts reaches.",
    icon: Footprints,
    iconTone: "text-emerald-500",
    tone: "from-emerald-500/15 to-emerald-500/5",
  },  {
    slug: "single-leg-hops",
    issues: ["A1", "A2", "A3", "A10"],
    code: "A9",
    joint: "ankle",
    title: "Single-Leg Hops",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Side-on camera, standing on the chosen leg with the other foot up: small hops on the spot, landing softly on the same leg. Counts each take-off and landing from the hopping ankle's rise above its standing height; the other foot touching down does not count. Counts reps, one leg. Separate from the single-leg hop test.",
    patientBody:
      "Small hops on one leg. Counts hops.",
    icon: Footprints,
    iconTone: "text-emerald-500",
    tone: "from-emerald-500/15 to-emerald-500/5",
  },




  {
    slug: "elbow-arom",
    issues: ["E3", "E4", "E7"],
    code: "E1",
    joint: "elbow",
    title: "Elbow AROM",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Upper arm by the side, bend the elbow to bring the hand toward the shoulder, then straighten it fully. Rep-Count on the elbow angle, side-on camera. Counts reps.",
    patientBody:
      "Elbow bend-and-straighten. Counts reps.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },  {
    slug: "triceps-extension",
    issues: ["E3", "E4", "E7"],
    code: "E2",
    joint: "elbow",
    title: "Overhead Triceps Extension",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Side-on, arm raised overhead with the elbow up: bend the elbow to lower the hand behind the head, then straighten. Rep-Count on elbow bend against a personal line (85% of the calibrated bend); a bend with the arm down does not count. Counts reps, one arm.",
    patientBody:
      "Overhead elbow bends and straightens. Counts reps.",
    icon: Dumbbell,
    iconTone: "text-amber-500",
    tone: "from-amber-500/15 to-amber-500/5",
  },

  {
    slug: "cervical-rotation",
    issues: ["C1", "C2", "C4", "C6"],
    code: "C1",
    joint: "cervical",
    title: "Cervical Rotation",
    mechanic: "rep_count",
    publicBody:
      "Seated facing the camera, turn the head to each side and back to centre. Rep-Count on head rotation (ear-width foreshortening against a facing-forward baseline). Counts reps, both sides.",
    patientBody:
      "Head turns side to side. Counts reps.",
    icon: Activity,
    iconTone: "text-sky-500",
    tone: "from-sky-500/15 to-sky-500/5",
  },
  {
    slug: "cervical-side-flexion",
    issues: ["C1", "C2", "C4", "C6"],
    code: "C2",
    joint: "cervical",
    title: "Cervical Side Flexion",
    mechanic: "rep_count",
    publicBody:
      "Seated facing the camera, tilt the head to bring each ear toward its shoulder and back upright, shoulders level. Rep-Count on the shoulder→ear line against the patient's own upright reading. Counts reps, both sides.",
    patientBody:
      "Ear-to-shoulder head tilts. Counts reps.",
    icon: Activity,
    iconTone: "text-sky-500",
    tone: "from-sky-500/15 to-sky-500/5",
  },
  {
    slug: "cervical-flexion-extension",
    issues: ["C1", "C2", "C4", "C6"],
    code: "C3",
    joint: "cervical",
    title: "Cervical Flexion / Extension",
    mechanic: "rep_count",
    publicBody:
      "Seated side-on, nod the chin down to the chest and tip the head back to look up, returning to neutral each time, back still. Rep-Count on head pitch (ear→nose line) against the patient's own neutral. Counts reps, both directions.",
    patientBody:
      "Chin-down and look-up nods. Counts reps.",
    icon: Activity,
    iconTone: "text-sky-500",
    tone: "from-sky-500/15 to-sky-500/5",
  },
  {
    slug: "upper-trap-levator-stretch",
    issues: ["C1", "C2", "C5", "C6"],
    code: "C4",
    joint: "cervical",
    title: "Upper Trapezius & Levator Stretch",
    mechanic: "rep_count",
    publicBody:
      "Seated facing the camera, tilt the ear toward the shoulder and hold the stretch on the opposite side of the neck, shoulders level. A rep is one stretch held for 20 s, read from the shoulder→ear line against the patient's own upright reading. Counts held stretches, both sides.",
    patientBody:
      "Ear-to-shoulder neck stretch, held 20 s each. Counts holds.",
    icon: Activity,
    iconTone: "text-sky-500",
    tone: "from-sky-500/15 to-sky-500/5",
  },
  {
    slug: "self-snag",
    issues: ["C1", "C2", "C5"],
    code: "C5",
    joint: "cervical",
    title: "Self-SNAG (Towel)",
    mechanic: "rep_count",
    needsSide: true,
    publicBody:
      "Seated facing the camera, towel round the neck: turn the head toward the chosen side while the opposite hand pulls the towel forward, hold 3 s at end range, back to centre. Rep-Count on head rotation toward that side against a facing-forward baseline. Counts reps, one side.",
    patientBody:
      "Towel-assisted head turns to one side, held 3 s. Counts reps.",
    icon: Activity,
    iconTone: "text-sky-500",
    tone: "from-sky-500/15 to-sky-500/5",
  },
];

/** Order in which joint sections render on the catalogue pages. */
export const JOINT_ORDER = ["knee", "hip", "back", "shoulder", "elbow", "ankle", "cervical"];

/** Display labels + brief clinical subtitles for the four groups. */
export const JOINT_META = {
  knee:     { label: "Knee",     subtitle: "Depth, control, and terminal-extension drills." },
  hip:      { label: "Hip",      subtitle: "Abduction, bridging, balance, and gait rhythm." },
  back:     { label: "Back",     subtitle: "Posture, extension, mobility, and core stability." },
  shoulder: { label: "Shoulder", subtitle: "Elevation, reach, rotation, and scapular control." },
  elbow:    { label: "Elbow", subtitle: "Elbow range of motion and arm strength." },
  ankle:    { label: "Ankle & Foot", subtitle: "Calf strength, ankle control, and balance." },
  cervical: { label: "Cervical", subtitle: "Neck range of motion and posture." },
};

/**
 * Group the flat catalog by joint, preserving JOINT_ORDER.
 * @param {RehabExerciseEntry[]} [exercises]
 * @returns {JointGroup[]}
 */
export function groupExercisesByJoint(exercises = visibleExercises()) {
  /** @type {Record<RehabJoint, RehabExerciseEntry[]>} */
  const byJoint = { knee: [], hip: [], back: [], shoulder: [], elbow: [], ankle: [], cervical: [] };
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
