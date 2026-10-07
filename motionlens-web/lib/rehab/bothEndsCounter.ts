// Two-ended rep counter: a rep is reaching BOTH calibrated ends once
// (either order) — e.g. wrist up then down.
//
// lib/rehab/zoneCounter does the end-to-end tracking with a dead band in
// the middle. The first end reached is the first half of a rep; each
// arrival at the other end after it completes one. Same rule as the
// ankle pump counter, without the ankle's leg checks.

import { createZoneCounter } from "@/lib/rehab/zoneCounter";

export interface BothEndsConfig {
  zoneShare: number;
  /** Calibrated ends closer than this are not used. */
  minSpan: number;
  defaultHigh: number;
  defaultLow: number;
}

export function bothEndsFrom(high: unknown, low: unknown, cfg: BothEndsConfig): { high: number; low: number } {
  const ok = typeof high === "number" && typeof low === "number" && high - low >= cfg.minSpan;
  return ok ? { high: high as number, low: low as number } : { high: cfg.defaultHigh, low: cfg.defaultLow };
}

export function createBothEndsCounter(ends: { high: number; low: number }, cfg: BothEndsConfig) {
  const zc = createZoneCounter({ a: ends.low, b: ends.high, share: cfg.zoneShare });
  let half = 0;
  return {
    /** Returns true when this frame completes a rep. */
    step(v: number): boolean {
      const before = zc.home();
      const ev = zc.step(v, true);
      if (before === null && zc.home() !== null) { half = 1; return false; }
      if (!ev) return false;
      half += 1;
      if (half >= 2) { half = 0; return true; }
      return false;
    },
    /** 0 at the low end … 1 at the high end. */
    fraction(v: number): number | null {
      return zc.fraction(v);
    },
  };
}
