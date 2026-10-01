// Stretch-hold counter: a "rep" is one stretch held long enough.
//
// Fed an unsigned stretch magnitude (degrees) every frame:
//   rest     — magnitude below `enter`; waiting for the stretch.
//   holding  — magnitude ≥ enter; the hold clock runs. A dip below
//              `breakAt` for longer than `graceMs` breaks the hold
//              (counted as an attempt, not a rep).
//   done     — the hold reached `holdSec`; the rep is counted and the
//              counter waits for the return below `release` before the
//              next stretch can start.
//
// Pure and frame-rate independent (uses the caller's timestamps).

export type StretchHoldPhase = "rest" | "holding" | "done";

export type StretchHoldConfig = {
  /** Magnitude that starts a hold. */
  enter: number;
  /** Magnitude a hold may sag to without breaking. */
  breakAt: number;
  /** Magnitude that counts as back to neutral after a finished hold. */
  release: number;
  /** Seconds a hold must last to count. */
  holdSec: number;
  /** A dip below breakAt shorter than this is ignored. */
  graceMs: number;
};

export type StretchHoldEvent =
  | { type: "rep"; heldSec: number }
  | { type: "broken"; heldSec: number };

export type StretchHoldTimer = {
  step: (magnitude: number, nowMs: number) => StretchHoldEvent | null;
  phase: () => StretchHoldPhase;
  /** Seconds held in the hold in progress (0 when not holding). */
  heldSec: (nowMs: number) => number;
  reset: () => void;
};

export function createStretchHold(cfg: StretchHoldConfig): StretchHoldTimer {
  let phase: StretchHoldPhase = "rest";
  let startMs = 0;
  let dipSinceMs: number | null = null;

  return {
    step(mag, now) {
      if (phase === "rest") {
        if (mag >= cfg.enter) {
          phase = "holding";
          startMs = now;
          dipSinceMs = null;
        }
        return null;
      }
      if (phase === "holding") {
        if (mag < cfg.breakAt) {
          if (dipSinceMs === null) dipSinceMs = now;
          if (now - dipSinceMs > cfg.graceMs) {
            phase = "rest";
            return { type: "broken", heldSec: (dipSinceMs - startMs) / 1000 };
          }
        } else {
          dipSinceMs = null;
        }
        const held = (now - startMs) / 1000;
        // Never finish during a sag: the grace only forgives a dip, it
        // does not pay for the time spent in it.
        if (dipSinceMs === null && held >= cfg.holdSec) {
          phase = "done";
          return { type: "rep", heldSec: held };
        }
        return null;
      }
      // done: wait for the return to neutral.
      if (mag < cfg.release) phase = "rest";
      return null;
    },
    phase: () => phase,
    heldSec: (now) => (phase === "holding" ? (now - startMs) / 1000 : 0),
    reset() {
      phase = "rest";
      startMs = 0;
      dipSinceMs = null;
    },
  };
}
