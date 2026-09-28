// Is the camera actually seeing what this exercise needs?
//
// Judged every frame during a hold, from the spec alone: which body
// parts must be visible, which way the patient should face, which side
// should be nearest the camera, and roughly how far away they should
// stand. The result is a checklist for the overlay and, when something
// is wrong, ONE message — the patient can only act on one instruction,
// so the most fundamental problem wins (same ordering the Games setup
// uses: no view of the body, then cut off, then wrong way round, then
// wrong side, then distance).
//
// Blocking checks pause the hold. Distance only warns: a patient who
// is a little too far away can still be measured, and being told to
// step back when they cannot is the kind of instruction that makes a
// calibration fail the people it is for.
//
// Everything is body-relative — visibility scores, and lengths as
// fractions of the frame compared against ratios — so nothing here
// depends on body size or camera distance in absolute terms.

import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { LM_LIVE } from "@/lib/pose/landmarks-live";
import type {
  BodyPart,
  CalibrationSpec,
  PartReq,
  ScaleRef,
} from "@/lib/rehab/calibration/specs";
import type { RefPoint } from "@/lib/rehab/calibration/holdTracker";
import type { FrameSize, Side } from "@/lib/rehab/calibration/signals";

/** Below this a landmark is treated as not present. Games figure. */
export const VIS_FLOOR = 0.35;
/** Slack past the frame edge before a landmark counts as cut off.
 *  MediaPipe extrapolates joints it cannot see and still reports a
 *  passing score, so `visible` alone is not enough. Games figure. */
export const FRAME_SLACK = 0.05;

/**
 * View check: shoulder width divided by torso length.
 *
 * Facing the camera the shoulders are wide apart relative to the torso;
 * side-on they overlap and the ratio collapses toward zero. Between the
 * two bands the pose is ambiguous and the patient is asked to turn.
 * The same formula serves supine and quadruped, because both lengths
 * are measured in the image regardless of which way the trunk points.
 */
export const FRONTAL_MIN_RATIO = 0.45;
export const SIDE_MAX_RATIO = 0.35;

/** How much more visible the working side must be than the far side
 *  before we conclude the wrong side is toward the camera. Below this
 *  the evidence is too weak to block on. */
export const FACING_MARGIN = 0.1;

/** Distance bands per scale reference, as a fraction of the frame
 *  (heights against frame height, widths against frame width). FIRST
 *  CUT — to be tuned on camera in Phase 1. Warn only. */
export const DISTANCE_BAND: Record<ScaleRef, [number, number]> = {
  thigh: [0.1, 0.4],
  torso: [0.15, 0.5],
  shoulderWidth: [0.1, 0.4],
  hipWidth: [0.06, 0.3],
};

export type CheckId = "visible" | "inFrame" | "view" | "facing" | "distance";

export interface Check {
  id: CheckId;
  ok: boolean;
  /** Whether a failure pauses the hold (true) or only shows (false). */
  blocking: boolean;
  /** Empty when ok. */
  message: string;
}

export interface Readiness {
  checks: Check[];
  /** All blocking checks passed. */
  ok: boolean;
  /** The one instruction to show, or null when ok. */
  block: string | null;
  /** A non-blocking note (distance), or null. */
  warn: string | null;
  /** Where the required body parts are, normalised — the hold
   *  tracker's stillness reference. Null when none is visible. */
  ref: RefPoint | null;
  /** The scale reference as a fraction of the frame, for the debug
   *  overlay and the saved summary. */
  scale: number | null;
  /** The numbers each decision was made on. Debug overlay only. */
  debug: {
    viewRatio: number | null;
    /** Far-side minus working-side mean visibility; null when the
     *  facing check did not run. */
    facingDiff: number | null;
  };
}

// ── Landmark resolution ───────────────────────────────────────────

type LmKey = keyof typeof LM_LIVE;

function indexOf(part: BodyPart, side: Side): number {
  if (part === "NOSE") return LM_LIVE.NOSE;
  const key = `${side.toUpperCase()}_${part}` as LmKey;
  return LM_LIVE[key];
}

interface Resolved {
  part: BodyPart;
  /** Indices that must ALL pass (`all`) or of which ONE must (`any`). */
  indices: number[];
  mode: "all" | "any";
  /** Which side each index belongs to, for the facing check. */
  sides: Side[];
}

function resolve(req: PartReq, side: Side | null): Resolved {
  if (req.part === "NOSE") {
    return { part: req.part, indices: [LM_LIVE.NOSE], mode: "all", sides: ["left"] };
  }
  const L = indexOf(req.part, "left");
  const R = indexOf(req.part, "right");
  switch (req.side) {
    case "both":
      return { part: req.part, indices: [L, R], mode: "all", sides: ["left", "right"] };
    case "any":
      return { part: req.part, indices: [L, R], mode: "any", sides: ["left", "right"] };
    case "working":
      // A sided spec with no side yet reads like `any`, so the
      // checklist still works while the picker is up.
      if (side === null) return { part: req.part, indices: [L, R], mode: "any", sides: ["left", "right"] };
      return { part: req.part, indices: [indexOf(req.part, side)], mode: "all", sides: [side] };
    case "other": {
      if (side === null) return { part: req.part, indices: [L, R], mode: "any", sides: ["left", "right"] };
      const o: Side = side === "left" ? "right" : "left";
      return { part: req.part, indices: [indexOf(req.part, o)], mode: "all", sides: [o] };
    }
  }
}

function score(kp: LiveKeypoint[], i: number): number {
  return kp[i]?.score ?? 0;
}

function present(kp: LiveKeypoint[], i: number): boolean {
  return score(kp, i) >= VIS_FLOOR;
}

function inFrame(kp: LiveKeypoint[], i: number, f: FrameSize): boolean {
  const p = kp[i];
  if (!p) return false;
  const nx = p.x / f.w;
  const ny = p.y / f.h;
  return nx >= -FRAME_SLACK && nx <= 1 + FRAME_SLACK && ny >= -FRAME_SLACK && ny <= 1 + FRAME_SLACK;
}

function humanPart(part: BodyPart): string {
  return part === "NOSE" ? "head" : part.toLowerCase();
}

function listParts(parts: BodyPart[]): string {
  const names = Array.from(new Set(parts.map(humanPart)));
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function dist(kp: LiveKeypoint[], a: number, b: number): number | null {
  const p = kp[a];
  const q = kp[b];
  if (!p || !q || !present(kp, a) || !present(kp, b)) return null;
  return Math.hypot(p.x - q.x, p.y - q.y);
}

function mid(kp: LiveKeypoint[], a: number, b: number): { x: number; y: number } | null {
  const p = kp[a];
  const q = kp[b];
  if (!p || !q) return null;
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

// ── The assessment ────────────────────────────────────────────────

export function assessReadiness(
  spec: CalibrationSpec,
  kp: LiveKeypoint[],
  frame: FrameSize,
  side: Side | null,
): Readiness {
  const checks: Check[] = [];
  const resolved = spec.parts.map((r) => resolve(r, side));

  // 1. Visible.
  const missing: BodyPart[] = [];
  for (const r of resolved) {
    const seen = r.indices.filter((i) => present(kp, i));
    const ok = r.mode === "all" ? seen.length === r.indices.length : seen.length > 0;
    if (!ok) missing.push(r.part);
  }
  checks.push({
    id: "visible",
    ok: missing.length === 0,
    blocking: true,
    message: missing.length
      ? `Step into view — we need your ${listParts(missing)}`
      : "",
  });

  // 2. In frame — of the parts that ARE detected.
  const cut: BodyPart[] = [];
  for (const r of resolved) {
    for (const i of r.indices) {
      if (present(kp, i) && !inFrame(kp, i, frame)) cut.push(r.part);
    }
  }
  checks.push({
    id: "inFrame",
    ok: cut.length === 0,
    blocking: true,
    message: cut.length ? `Move back — your ${listParts(cut)} is cut off` : "",
  });

  // 3. View. Needs both shoulders; torso needs at least one hip.
  const LS = LM_LIVE.LEFT_SHOULDER;
  const RS = LM_LIVE.RIGHT_SHOULDER;
  const LH = LM_LIVE.LEFT_HIP;
  const RH = LM_LIVE.RIGHT_HIP;
  const shoulderW = dist(kp, LS, RS);
  const torsoL = (() => {
    const sm = present(kp, LS) && present(kp, RS) ? mid(kp, LS, RS) : null;
    const hm = present(kp, LH) && present(kp, RH)
      ? mid(kp, LH, RH)
      : present(kp, LH) ? kp[LH] : present(kp, RH) ? kp[RH] : null;
    if (!sm || !hm) return null;
    return Math.hypot(sm.x - hm.x, sm.y - hm.y);
  })();
  const viewRatio = shoulderW !== null && torsoL !== null && torsoL > 1 ? shoulderW / torsoL : null;
  let viewOk = true;
  let viewMsg = "";
  if (spec.view === "frontal" && (!present(kp, LS) || !present(kp, RS))) {
    // Facing the camera, both shoulders are in plain view. One of them
    // dropping below the floor is what a side-on patient looks like —
    // and it also makes the ratio below uncomputable, so without this
    // a side-on patient would pass a frontal check by default.
    viewOk = false;
    viewMsg = "Turn to face the camera";
  } else if (spec.view !== "either" && viewRatio !== null) {
    if (spec.view === "frontal" && viewRatio < FRONTAL_MIN_RATIO) {
      viewOk = false;
      viewMsg = "Turn to face the camera";
    } else if (spec.view === "side" && viewRatio > SIDE_MAX_RATIO) {
      viewOk = false;
      viewMsg = spec.posture === "supine"
        ? "Lie so your side is toward the camera"
        : spec.posture === "quadruped"
          ? "Set up so your side is toward the camera"
          : "Turn so your side faces the camera";
    }
  }
  checks.push({ id: "view", ok: viewOk, blocking: true, message: viewMsg });

  // 4. Facing — side-on AND sided AND a side to judge.
  //
  //    Two kinds of evidence. The strong one: the working limb is
  //    below the visibility floor while the SAME limb on the other
  //    side is plainly there. To the visibility check that looks like
  //    "leg out of view" — but the patient's leg is right in front of
  //    the camera, just the wrong one, and "step into view" would be
  //    the least helpful thing to say. So this case is diagnosed here
  //    and reported ahead of the visibility failure.
  //
  //    The weak one, when both sides pass the floor: the far side is
  //    CLEARLY more visible than the working side. Only blocks past a
  //    margin, because the evidence is soft.
  let facingOk = true;
  let facingMsg = "";
  let swapped = false;
  let facingDiff: number | null = null;
  if (spec.view === "side" && spec.sided && side !== null) {
    const o: Side = side === "left" ? "right" : "left";
    const limb = spec.parts.some((p) => p.part === "KNEE" || p.part === "ANKLE") ? "leg" : "side";
    const turn = `Turn around — your ${side.toUpperCase()} ${limb} should be nearest the camera`;

    const workingReqs = spec.parts.filter((p) => p.side === "working" && p.part !== "NOSE");
    const missingWorking = workingReqs.filter((p) => !present(kp, indexOf(p.part, side)));
    swapped =
      missingWorking.length > 0
      && missingWorking.every((p) => present(kp, indexOf(p.part, o)));

    if (swapped) {
      facingOk = false;
      facingMsg = turn;
    } else if (viewOk) {
      let mine = 0;
      let theirs = 0;
      let n = 0;
      for (const r of spec.parts) {
        if (r.part === "NOSE" || r.side === "both" || r.side === "any") continue;
        const want: Side = r.side === "working" ? side : o;
        const far: Side = want === "left" ? "right" : "left";
        mine += score(kp, indexOf(r.part, want));
        theirs += score(kp, indexOf(r.part, far));
        n += 1;
      }
      if (n > 0) facingDiff = (theirs - mine) / n;
      if (n > 0 && (theirs - mine) / n >= FACING_MARGIN) {
        facingOk = false;
        facingMsg = turn;
      }
    }
  }
  checks.push({ id: "facing", ok: facingOk, blocking: true, message: facingMsg });

  // 5. Distance — warn only.
  const scale = scaleFraction(spec.scaleRef, kp, frame, side);
  let distOk = true;
  let distMsg = "";
  if (scale !== null) {
    const [lo, hi] = DISTANCE_BAND[spec.scaleRef];
    if (scale < lo) { distOk = false; distMsg = "Come a little closer to the camera"; }
    else if (scale > hi) { distOk = false; distMsg = "Step back from the camera"; }
  }
  checks.push({ id: "distance", ok: distOk, blocking: false, message: distMsg });

  // Reference point: centroid of the detected required parts.
  let sx = 0;
  let sy = 0;
  let cnt = 0;
  for (const r of resolved) {
    for (const i of r.indices) {
      if (!present(kp, i)) continue;
      sx += kp[i].x / frame.w;
      sy += kp[i].y / frame.h;
      cnt += 1;
    }
  }
  const ref = cnt > 0 ? { nx: sx / cnt, ny: sy / cnt } : null;

  // The checklist stays in its natural order; only the ONE message the
  // patient acts on is reprioritised. A wrong-side swap is reported
  // ahead of the visibility failure it causes (see check 4).
  const firstBlock =
    (swapped ? checks.find((c) => c.id === "facing") : null)
    ?? checks.find((c) => c.blocking && !c.ok)
    ?? null;
  const firstWarn = checks.find((c) => !c.blocking && !c.ok) ?? null;
  return {
    checks,
    ok: firstBlock === null,
    block: firstBlock ? firstBlock.message : null,
    warn: firstWarn ? firstWarn.message : null,
    ref,
    scale,
    debug: { viewRatio, facingDiff },
  };
}

/** The spec's scale reference as a fraction of the frame. */
function scaleFraction(
  ref: ScaleRef,
  kp: LiveKeypoint[],
  f: FrameSize,
  side: Side | null,
): number | null {
  if (f.w <= 0 || f.h <= 0) return null;
  const tryBoth = (a: (s: Side) => number | null): number | null => {
    if (side !== null) return a(side) ?? a(side === "left" ? "right" : "left");
    return a("left") ?? a("right");
  };
  switch (ref) {
    case "thigh": {
      const px = tryBoth((s) => dist(kp, indexOf("HIP", s), indexOf("KNEE", s)));
      return px === null ? null : px / f.h;
    }
    case "torso": {
      const px = tryBoth((s) => dist(kp, indexOf("SHOULDER", s), indexOf("HIP", s)));
      return px === null ? null : px / f.h;
    }
    case "shoulderWidth": {
      const px = dist(kp, LM_LIVE.LEFT_SHOULDER, LM_LIVE.RIGHT_SHOULDER);
      return px === null ? null : px / f.w;
    }
    case "hipWidth": {
      const px = dist(kp, LM_LIVE.LEFT_HIP, LM_LIVE.RIGHT_HIP);
      return px === null ? null : px / f.w;
    }
  }
}
