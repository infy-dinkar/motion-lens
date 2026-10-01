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
//
// `followThrough` (optional): the return may carry on PAST the rest end
// (a heel dropping below the step edge). The clock then keeps running
// to the furthest point reached, and the result is given once the value
// turns back by `followThrough` or stops moving for `settleMs`.

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
  followThrough?: number;
  settleMs?: number;
}): LoweringTimer {
  const settleMs = opts.settleMs ?? 400;
  let worked = false;
  /** Past the rest end, following the return to its furthest point. */
  let settling = false;
  let furthest = 0;
  let furthestMs = 0;
  /** Left the worked end since entering it: a re-entry is a new start. */
  let outside = false;
  /** Deepest value seen in the worked end, and when. */
  let extreme = 0;
  let startMs = 0;
  const inWorked = (v: number) => (opts.direction === "up" ? v < opts.depth : v > opts.top);
  const deeper = (v: number) => (opts.direction === "up" ? v <= extreme : v >= extreme);
  const atRest = (v: number) => (opts.direction === "up" ? v >= opts.top : v <= opts.depth);
  const beyond = (v: number, ref: number) => (opts.direction === "up" ? v - ref : ref - v);
  const finish = (endMs: number): LoweringResult => {
    const sec = (endMs - startMs) / 1000;
    return { sec, slow: sec >= opts.minSec };
  };
  return {
    step(value, nowMs) {
      if (settling) {
        // Still moving further (by more than noise): extend the clock.
        if (beyond(value, furthest) > 0.5) {
          furthest = value;
          furthestMs = nowMs;
          return null;
        }
        const turned = beyond(furthest, value) >= (opts.followThrough ?? 0);
        if (turned || nowMs - furthestMs >= settleMs || inWorked(value)) {
          settling = false;
          return finish(furthestMs);
        }
        return null;
      }
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
        worked = false;
        if (opts.followThrough !== undefined) {
          settling = true;
          furthest = value;
          furthestMs = nowMs;
          return null;
        }
        return finish(nowMs);
      }
      return null;
    },
    reset() {
      worked = false;
      settling = false;
    },
  };
}
