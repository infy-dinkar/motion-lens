// Lowering timer for eccentric exercises.
//
// An eccentric rep is judged by how SLOWLY the patient returns from the
// worked position. The shared rep engine has no tempo rule, so pages
// that need one time each return with this and count only the slow ones.
//
// Thresholds are in the same numbers the page feeds its rep engine
// (`top` = rest end, `depth` = worked end):
//   • "up"   — the return goes from below `depth` to at/above `top`
//              (elbow straightening in a curl, heel lowering in a raise)
//   • "down" — the return goes from above `top` to at/below `depth`
//              (knee bending in a decline squat)
// The clock starts at the deepest point reached in the worked end (the
// moment the return actually begins — timing only from the depth line
// would leave out the first part of the lowering and ask for a much
// slower rep than intended) and stops when the value reaches the rest
// end. Going deeper again moves the start.

export interface LoweringResult {
  /** Seconds the return took. */
  sec: number;
  /** True when it took at least minSec. */
  slow: boolean;
}

export interface LoweringTimer {
  /** Feed one reading; returns a result when a return completes. */
  step(value: number, nowMs: number): LoweringResult | null;
  reset(): void;
}

export function createLoweringTimer(opts: {
  top: number;
  depth: number;
  minSec: number;
  direction: "up" | "down";
}): LoweringTimer {
  let worked = false;
  /** Left the worked end since entering it: a re-entry is a new start. */
  let outside = false;
  /** Deepest value seen in the worked end, and when. */
  let extreme = 0;
  let startMs = 0;
  const inWorked = (v: number) => (opts.direction === "up" ? v < opts.depth : v > opts.top);
  const deeper = (v: number) => (opts.direction === "up" ? v <= extreme : v >= extreme);
  const atRest = (v: number) => (opts.direction === "up" ? v >= opts.top : v <= opts.depth);
  return {
    step(value, nowMs) {
      if (inWorked(value)) {
        if (!worked || outside || deeper(value)) {
          extreme = value;
          startMs = nowMs;
        }
        worked = true;
        outside = false;
        return null;
      }
      if (worked) outside = true;
      if (worked && atRest(value)) {
        const sec = (nowMs - startMs) / 1000;
        worked = false;
        return { sec, slow: sec >= opts.minSec };
      }
      return null;
    },
    reset() {
      worked = false;
    },
  };
}
