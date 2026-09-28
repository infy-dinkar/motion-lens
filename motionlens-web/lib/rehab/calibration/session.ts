// One exercise's calibration, start to finish.
//
// Walks the spec's holds in order. Each frame it asks readiness.ts
// whether the camera can see what it needs, reads the signal, decides
// whether anything blocks the hold, and feeds all of that to one
// HoldTracker. When a hold completes its recorded value is kept and the
// next hold begins; after the last, `done` flips and the summary is
// ready for metrics.calibration.
//
// Two rules that come from the plan rather than the mechanics:
//
//   • "Show your range" must actually show a range. A second hold that
//     reads within a few degrees of the first is the start pose held
//     twice, and it is blocked with its own message until the patient
//     moves. The delta is small on purpose — it proves movement, it
//     does not set a target.
//
//   • Nobody is locked out. A hold still incomplete after
//     START_ANYWAY_MS offers a way through; taking it records the hold
//     as skipped (value null) and moves on. The exercise runs either
//     way; the report says which holds were real.
//
// Deliberately framework-free — a plain class fed from the page's
// existing onFrame callback — so it can be benched with synthetic
// frames and reused unchanged in standalone and session flows.

import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import {
  HoldTracker,
  HOLD_MESSAGE,
  type HoldStatus,
} from "@/lib/rehab/calibration/holdTracker";
import {
  assessReadiness,
  type Check,
} from "@/lib/rehab/calibration/readiness";
import {
  readCalibSignal,
  type FrameSize,
  type Side,
} from "@/lib/rehab/calibration/signals";
import {
  START_ANYWAY_MS,
  type CalibrationSpec,
  type HoldSpec,
  type SignalUnit,
} from "@/lib/rehab/calibration/specs";

/** Smallest change from rest that counts as "moved" for a range hold.
 *  Proves movement; does not set a target. */
export const MIN_RANGE_DELTA: Record<SignalUnit, number> = {
  deg: 10,
  ratio: 0.04,
};

export interface HoldResult {
  id: HoldSpec["id"];
  value: number | null;
  skipped: boolean;
}

export interface SessionState {
  /** Index into spec.holds. Equals holds.length once done. */
  holdIndex: number;
  total: number;
  /** The hold in progress, or null once done. */
  hold: HoldSpec | null;
  /** 0..1 ring fill for the current hold. */
  progress: number;
  status: HoldStatus;
  /** The one line to show under the ring. */
  message: string;
  /** Non-blocking note (distance), or null. */
  warn: string | null;
  checks: Check[];
  /** Current hold has run longer than START_ANYWAY_MS without
   *  completing. */
  canStartAnyway: boolean;
  /** Time on the current hold, ms. */
  elapsedMs: number;
  /** Latest signal reading, for the debug overlay. */
  value: number | null;
  done: boolean;
  results: HoldResult[];
  /** Everything the current decision rests on. Debug overlay only. */
  debug: {
    rest: number | null;
    /** How far the reading must move from rest for a range hold. */
    minDelta: number;
    drift: number;
    viewRatio: number | null;
    facingDiff: number | null;
    scale: number | null;
  };
}

/** What lands in metrics.calibration. Additive; the report renderer
 *  ignores unknown keys, so nothing has to change for it to be saved. */
export interface CalibrationSummary {
  signal: string;
  unit: SignalUnit;
  view: CalibrationSpec["view"];
  rest: number | null;
  range: number | null;
  range_left?: number | null;
  range_right?: number | null;
  holds_passed: number;
  holds_total: number;
  skipped: boolean;
  scale_fraction: number | null;
  captured_at_ms: number;
}

type SignalReader = typeof readCalibSignal;

export class CalibrationSession {
  private tracker = new HoldTracker();
  private index = 0;
  private results: HoldResult[] = [];
  private holdStartMs: number | null = null;
  private lastState: SessionState;
  private lastScale: number | null = null;
  private lastRef = { nx: 0.5, ny: 0.5 };

  constructor(
    readonly spec: CalibrationSpec,
    readonly side: Side | null,
    private readonly readSignal: SignalReader = readCalibSignal,
  ) {
    this.lastState = this.snapshot(0, HOLD_MESSAGE.idle, null, [], false, 0, null);
  }

  get state(): SessionState {
    return this.lastState;
  }

  reset(): void {
    this.tracker.reset();
    this.index = 0;
    this.results = [];
    this.holdStartMs = null;
    this.lastScale = null;
    this.lastState = this.snapshot(0, HOLD_MESSAGE.idle, null, [], false, 0, null);
  }

  /** The rest value once Hold 1 has recorded it, else null. */
  private restValue(): number | null {
    const r = this.results.find((x) => x.id === "rest");
    return r && r.value !== null ? r.value : null;
  }

  /**
   * Feed one frame. Call from the page's onFrame with the raw
   * keypoints and the video size.
   */
  feed(kp: LiveKeypoint[], frame: FrameSize, nowMs: number): SessionState {
    const hold = this.spec.holds[this.index];
    if (!hold) return this.lastState;
    if (this.holdStartMs === null) this.holdStartMs = nowMs;

    const ready = assessReadiness(this.spec, kp, frame, this.side);
    if (ready.scale !== null) this.lastScale = ready.scale;
    if (ready.ref) this.lastRef = ready.ref;

    const value = this.readSignal(
      this.spec.signal, kp, this.side, this.spec.signalSide, frame,
    );

    // Range holds must differ from rest by more than noise.
    let block = ready.block;
    if (block === null && hold.id !== "rest" && value !== null) {
      const rest = this.restValue();
      if (rest !== null && Math.abs(value - rest) < MIN_RANGE_DELTA[this.spec.unit]) {
        block = "Move further — show me your range";
      }
    }

    const recorded = this.tracker.feed(this.lastRef, value, block, nowMs);
    const elapsed = nowMs - this.holdStartMs;

    if (recorded !== null) {
      this.results.push({ id: hold.id, value: recorded, skipped: false });
      this.advance();
      const next = this.spec.holds[this.index] ?? null;
      this.lastState = this.snapshot(
        0,
        next ? HOLD_MESSAGE.idle : "Calibration complete",
        null,
        ready.checks,
        false,
        0,
        value,
      );
      return this.lastState;
    }

    const message =
      block ?? (this.tracker.blockReason || HOLD_MESSAGE[this.tracker.status]);
    this.lastState = this.snapshot(
      this.tracker.progress,
      message,
      ready.warn,
      ready.checks,
      elapsed >= START_ANYWAY_MS,
      elapsed,
      value,
      ready.debug,
    );
    return this.lastState;
  }

  /** "Start anyway": give up on the current hold and move on. */
  skipHold(): void {
    const hold = this.spec.holds[this.index];
    if (!hold) return;
    this.results.push({ id: hold.id, value: null, skipped: true });
    this.advance();
    const next = this.spec.holds[this.index] ?? null;
    this.lastState = this.snapshot(
      0,
      next ? HOLD_MESSAGE.idle : "Calibration complete",
      null,
      this.lastState.checks,
      false,
      0,
      this.lastState.value,
    );
  }

  private advance(): void {
    this.index += 1;
    this.tracker.reset();
    this.holdStartMs = null;
  }

  summary(nowMs: number): CalibrationSummary {
    const get = (id: HoldSpec["id"]) => {
      const r = this.results.find((x) => x.id === id);
      return r ? r.value : null;
    };
    const passed = this.results.filter((r) => !r.skipped).length;
    const out: CalibrationSummary = {
      signal: this.spec.signal,
      unit: this.spec.unit,
      view: this.spec.view,
      rest: get("rest"),
      range: get("range"),
      holds_passed: passed,
      holds_total: this.spec.holds.length,
      skipped: this.results.some((r) => r.skipped) || passed < this.spec.holds.length,
      scale_fraction: this.lastScale === null ? null : Math.round(this.lastScale * 1000) / 1000,
      captured_at_ms: nowMs,
    };
    if (this.spec.holds.some((h) => h.id === "range_left")) {
      out.range_left = get("range_left");
      out.range_right = get("range_right");
    }
    return out;
  }

  private snapshot(
    progress: number,
    message: string,
    warn: string | null,
    checks: Check[],
    canStartAnyway: boolean,
    elapsedMs: number,
    value: number | null,
    debug?: Partial<SessionState["debug"]>,
  ): SessionState {
    const hold = this.spec.holds[this.index] ?? null;
    return {
      debug: {
        rest: this.restValue(),
        minDelta: MIN_RANGE_DELTA[this.spec.unit],
        drift: this.tracker.lastDrift,
        viewRatio: debug?.viewRatio ?? null,
        facingDiff: debug?.facingDiff ?? null,
        scale: this.lastScale,
      },
      holdIndex: this.index,
      total: this.spec.holds.length,
      hold,
      progress,
      status: this.tracker.status,
      message,
      warn,
      checks,
      canStartAnyway,
      elapsedMs,
      value,
      done: hold === null,
      results: [...this.results],
    };
  }
}
