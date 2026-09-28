// One calibration hold.
//
// Ported from the Games HoldTracker (lib/games/calibration.ts), which
// has been through several rounds on camera, with one change: it
// records a NUMBER rather than a point. A game hold measures where the
// wrist was; a rehab hold measures what the joint angle was.
//
// The behaviour that made the Games version work is kept exactly:
//
//   • Stillness is judged on a reference point in normalised frame
//     units, and the ring RESETS when it drifts — a new anchor, a new
//     three seconds.
//   • A blocked frame (body part out of view, wrong side, wrong pose)
//     PAUSES the ring rather than resetting it. Throwing progress away
//     when the arm leaves the top of the frame is what taught game
//     patients to lower the arm until the ring filled, and record the
//     wrong reach.
//   • The recorded value is the median of the last second of samples,
//     so a single bad frame cannot move it.
//   • Time is accumulated per frame and capped, so a backgrounded tab
//     cannot award three seconds of hold in one frame.
//
// This class knows nothing about exercises, body parts or signals. The
// caller decides what the reference point and the value are, and why a
// frame is blocked. See specs.ts for what each exercise feeds it.

import { HOLD_MS } from "@/lib/rehab/calibration/specs";

/** Reference-point drift (normalised frame units) that resets the ring.
 *  Same figure as the Games calibration: about 4 % of the frame. */
export const STILL_TOLERANCE = 0.04;
/** Window whose median becomes the recorded value. */
export const MEDIAN_WINDOW_MS = 1000;
/** Largest frame gap credited toward the hold. */
const MAX_FRAME_MS = 200;

export type HoldStatus = "idle" | "holding" | "drifted" | "blocked";

/** Fallback text per status. A blocked hold carries its own reason. */
export const HOLD_MESSAGE: Record<HoldStatus, string> = {
  idle: "Get into position to start the timer",
  holding: "Hold still…",
  drifted: "Hold still",
  blocked: "",
};

export interface RefPoint {
  nx: number;
  ny: number;
}

interface Sample {
  value: number;
  t: number;
}

export class HoldTracker {
  private samples: Sample[] = [];
  private anchor: RefPoint | null = null;
  /** Time actually spent holding. Accumulated rather than taken from a
   *  wall-clock start, so a pause stops the clock without losing the
   *  progress already earned. */
  private heldMs = 0;
  private lastFeedMs = 0;

  /** 0..1 ring fill. */
  progress = 0;
  /** True while the reference point is inside tolerance and the ring
   *  is filling. */
  holding = false;
  /** Why the ring is doing what it is doing — shown to the patient. */
  status: HoldStatus = "idle";
  /** The reason, when status is "blocked". */
  blockReason = "";

  constructor(private readonly holdMs: number = HOLD_MS) {}

  reset(): void {
    this.samples = [];
    this.anchor = null;
    this.heldMs = 0;
    this.lastFeedMs = 0;
    this.progress = 0;
    this.holding = false;
    this.status = "idle";
    this.blockReason = "";
  }

  /**
   * Feed one frame.
   *
   * @param ref    where the body part being held is, normalised 0..1
   * @param value  the signal reading this frame, or null when the
   *               helper could not compute one (treated as a block)
   * @param block  non-null to hold the ring, carrying the reason to
   *               show the patient; null to let it fill
   * @param nowMs  performance.now()
   * @returns the recorded value when the hold completes, else null
   */
  feed(
    ref: RefPoint,
    value: number | null,
    block: string | null,
    nowMs: number,
  ): number | null {
    const prev = this.lastFeedMs;
    this.lastFeedMs = nowMs;
    const dt = prev > 0 ? Math.max(0, Math.min(MAX_FRAME_MS, nowMs - prev)) : 0;

    // A frame with no reading is a block of its own: the joint is
    // there but the angle could not be computed, usually because one
    // of its landmarks dipped below the visibility floor.
    const reason = block ?? (value === null || !Number.isFinite(value)
      ? "Hold still — reading the joint"
      : null);
    if (reason !== null) {
      this.status = "blocked";
      this.blockReason = reason;
      this.holding = false;
      return null;
    }
    this.blockReason = "";
    const v = value as number;

    if (!this.anchor) {
      this.anchor = { nx: ref.nx, ny: ref.ny };
      this.heldMs = 0;
      this.samples = [{ value: v, t: nowMs }];
      this.progress = 0;
      this.holding = true;
      this.status = "holding";
      return null;
    }

    const drift = Math.hypot(ref.nx - this.anchor.nx, ref.ny - this.anchor.ny);
    if (drift > STILL_TOLERANCE) {
      // Moved too far — restart the ring from the new position.
      this.anchor = { nx: ref.nx, ny: ref.ny };
      this.heldMs = 0;
      this.samples = [{ value: v, t: nowMs }];
      this.progress = 0;
      this.holding = true;
      this.status = "drifted";
      return null;
    }

    this.samples.push({ value: v, t: nowMs });
    this.holding = true;
    this.status = "holding";
    this.heldMs += dt;
    this.progress = Math.min(1, this.heldMs / this.holdMs);

    if (this.heldMs < this.holdMs) return null;

    const cutoff = nowMs - MEDIAN_WINDOW_MS;
    const tail = this.samples.filter((s) => s.t >= cutoff);
    const use = tail.length > 0 ? tail : this.samples;
    const recorded = median(use.map((s) => s.value));
    this.reset();
    return recorded;
  }
}

export function median(values: number[]): number {
  const a = [...values].sort((p, q) => p - q);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
