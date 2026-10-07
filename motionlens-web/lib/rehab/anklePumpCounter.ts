// Ankle pump counting: toes up (dorsiflexion) ↔ toes down
// (plantarflexion), one pump = both ends reached once.
//
// Ends come from the calibration (signed ankle angle, + up / − down;
// lib/rehab/ankleMetrics). lib/rehab/zoneCounter does the end-to-end
// counting with a dead band in the middle. A pump is touching both ends
// once — up then down, or down then up: the first end reached counts as
// the first half, every clean arrival at the other end after it
// completes a pump, and a bad arrival starts the pair again.
//
// A frame is good when only the ankle moved, as in the assessment's
// compensation checks: the knee angle within KNEE_MOVE_MAX of its
// baseline and the leg not lifted more than LEG_LIFT_MAX thigh lengths.
// The baseline is the mean of the first BASELINE_FRAMES frames once
// counting starts (the patient sits still for the countdown).

import { createZoneCounter } from "@/lib/rehab/zoneCounter";

export const ANKLE_PUMP = {
  zoneShare: 0.3,
  /** Calibrated ends closer than this (degrees) are not used. */
  minSpan: 10,
  defaultUp: 10,
  defaultDown: -25,
  kneeMoveMax: 15,
  legLiftMax: 0.1,
  baselineFrames: 10,
};

export interface PumpFrame {
  /** Signed ankle angle, + up / − down. */
  ankle: number;
  /** Interior knee angle, or null when not seen. */
  knee: number | null;
  /** Hip/knee mid-point y and thigh length, or null when not seen. */
  leg: { y: number; thigh: number } | null;
}

export type PumpEvent =
  | { type: "pump" }
  | { type: "bad"; reason: "knee" | "lift" | "both" };

export function anklePumpEnds(up: unknown, down: unknown, cfg = ANKLE_PUMP): { up: number; down: number } {
  const ok = typeof up === "number" && typeof down === "number" && up - down >= cfg.minSpan;
  return ok ? { up: up as number, down: down as number } : { up: cfg.defaultUp, down: cfg.defaultDown };
}

export function createAnklePumpCounter(ends: { up: number; down: number }, cfg = ANKLE_PUMP) {
  const zc = createZoneCounter({ a: ends.down, b: ends.up, share: cfg.zoneShare });
  const kneeS: number[] = [];
  const legS: number[] = [];
  const thighS: number[] = [];
  let kneeBase: number | null = null;
  let legBase: number | null = null;
  let thighBase: number | null = null;
  let pairGood = 0;
  let tripKnee = false;
  let tripLift = false;
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  let last = { kneeMoved: false, legLifted: false };

  return {
    /** Is this frame clean (only the ankle moving)? Feeds the baseline —
     *  call once per frame (step calls it). */
    check(f: PumpFrame): { kneeMoved: boolean; legLifted: boolean } {
      if (f.knee !== null && kneeBase === null) {
        kneeS.push(f.knee);
        if (kneeS.length >= cfg.baselineFrames) kneeBase = mean(kneeS);
      }
      if (f.leg !== null && legBase === null) {
        legS.push(f.leg.y);
        thighS.push(f.leg.thigh);
        if (legS.length >= cfg.baselineFrames) { legBase = mean(legS); thighBase = mean(thighS); }
      }
      const kneeMoved = f.knee !== null && kneeBase !== null && Math.abs(f.knee - kneeBase) > cfg.kneeMoveMax;
      // Image y grows downward: lifting the leg makes y smaller.
      const legLifted = f.leg !== null && legBase !== null && thighBase !== null
        && (legBase - f.leg.y) / thighBase > cfg.legLiftMax;
      return { kneeMoved, legLifted };
    },
    step(f: PumpFrame): PumpEvent | null {
      const { kneeMoved, legLifted } = this.check(f);
      last = { kneeMoved, legLifted };
      tripKnee = tripKnee || kneeMoved;
      tripLift = tripLift || legLifted;
      const before = zc.home();
      const ev = zc.step(f.ankle, !kneeMoved && !legLifted);
      // First end reached: the first half of a pump, if clean.
      if (before === null && zc.home() !== null) {
        pairGood = kneeMoved || legLifted ? 0 : 1;
        return null;
      }
      if (!ev) return null;
      const knee = tripKnee, lift = tripLift;
      tripKnee = false;
      tripLift = false;
      if (ev.type === "bad") {
        pairGood = 0;
        return { type: "bad", reason: knee && lift ? "both" : knee ? "knee" : "lift" };
      }
      pairGood += 1;
      if (pairGood >= 2) { pairGood = 0; return { type: "pump" }; }
      return null;
    },
    /** The clean-frame check from the last step. */
    lastCheck(): { kneeMoved: boolean; legLifted: boolean } {
      return last;
    },
    /** 0 at the down end … 1 at the up end. */
    fraction(ankle: number): number | null {
      return zc.fraction(ankle);
    },
  };
}
