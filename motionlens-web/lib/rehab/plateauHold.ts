// Plateau hold: "did the patient pause still at the top?"
//
// Time above a level is not enough — a slow rise and a slow lowering
// spend seconds above it without any pause. A plateau is a run of
// readings that stay within `band` of the reading that started it,
// while at or above `minLevel`. The longest plateau since the last
// reset is kept; `held()` is true once it reached `holdSec`.
//
// Pure and frame-rate independent (uses the caller's timestamps).

export type PlateauHoldConfig = {
  /** Readings below this never count as a pause at the top. */
  minLevel: number;
  /** How far a reading may drift from the plateau's start value. */
  band: number;
  /** Seconds the pause must last. */
  holdSec: number;
};

export type PlateauHold = {
  step: (value: number, nowMs: number) => void;
  /** Seconds in the current plateau (0 when not in one). */
  currentSec: (nowMs: number) => number;
  /** True once a plateau since the last reset reached holdSec. */
  held: () => boolean;
  reset: () => void;
};

export function createPlateauHold(cfg: PlateauHoldConfig): PlateauHold {
  let anchor: number | null = null;
  let startMs = 0;
  let done = false;

  return {
    step(value, now) {
      if (value < cfg.minLevel) {
        anchor = null;
        return;
      }
      if (anchor === null || Math.abs(value - anchor) > cfg.band) {
        anchor = value;
        startMs = now;
      }
      if ((now - startMs) / 1000 >= cfg.holdSec) done = true;
    },
    currentSec: (now) => (anchor === null ? 0 : (now - startMs) / 1000),
    held: () => done,
    reset() {
      anchor = null;
      done = false;
    },
  };
}
