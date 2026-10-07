// Side-to-side rep counter with two "home" zones and a dead band.
//
// The span between the two calibrated positions (a, b — either order)
// is split into: a home zone (`share` of the span from a), a dead band
// in the middle, and b's home zone. The counter remembers the last home
// zone the body was seen in; arriving in the OTHER home zone is a rep.
// The dead band is ignored, so hovering near the middle never counts and
// a missed frame mid-hop does not lose a rep. The first zone seen is the
// start, not a rep.
//
// Each trip also tracks a quality flag per frame (e.g. "other foot up");
// a trip where it held for less than `minGoodShare` of the frames is
// reported as "bad" instead of a rep.
//
// No calibration: pass a = b = null and the counter learns the span from
// the running min / max once it is at least `autoSpan` wide.

export type Zone = "a" | "b";
export type ZoneEvent = { type: "rep" | "bad"; to: Zone };

export interface ZoneCounterConfig {
  a: number | null;
  b: number | null;
  share?: number;
  minGoodShare?: number;
  autoSpan?: number;
}

export function createZoneCounter(cfg: ZoneCounterConfig) {
  const share = cfg.share ?? 0.3;
  const minGood = cfg.minGoodShare ?? 0.5;
  let lo = cfg.a !== null && cfg.b !== null ? Math.min(cfg.a, cfg.b) : null;
  let hi = cfg.a !== null && cfg.b !== null ? Math.max(cfg.a, cfg.b) : null;
  const auto = lo === null;
  let seenMin = Infinity, seenMax = -Infinity;
  let home: Zone | null = null;
  let tripFrames = 0, tripGood = 0;

  function zoneOf(v: number): Zone | null {
    if (lo === null || hi === null) return null;
    const span = hi - lo;
    if (v <= lo + share * span) return "a";
    if (v >= hi - share * span) return "b";
    return null;
  }

  return {
    step(v: number, good: boolean): ZoneEvent | null {
      if (auto) {
        seenMin = Math.min(seenMin, v);
        seenMax = Math.max(seenMax, v);
        if (seenMax - seenMin >= (cfg.autoSpan ?? 0.08)) { lo = seenMin; hi = seenMax; }
      }
      const z = zoneOf(v);
      if (home !== null && z !== home) {
        tripFrames += 1;
        if (good) tripGood += 1;
      }
      if (z === null) return null;
      if (home === null || z === home) {
        home = z;
        tripFrames = 0;
        tripGood = 0;
        return null;
      }
      const ok = tripFrames > 0 && tripGood / tripFrames >= minGood;
      home = z;
      tripFrames = 0;
      tripGood = 0;
      return { type: ok ? "rep" : "bad", to: z };
    },
    /** 0 at a's side … 1 at b's side, for a progress bar; null before a span exists. */
    fraction(v: number): number | null {
      if (lo === null || hi === null || hi - lo <= 0) return null;
      return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    },
    span(): { lo: number | null; hi: number | null } {
      return { lo, hi };
    },
    /** The zone the body was last seen in (null before the first). */
    home(): Zone | null {
      return home;
    },
  };
}
