// Wall finger walk: the personal "up" and "down" lines.
//
// The up line is a share of the highest shoulder flexion the patient
// showed in calibration, so a stiff shoulder still counts reps and the
// line rises as the range grows (on recalibration).

export const FINGER_WALK = {
  /** Share of the calibrated highest point that counts as "up". */
  UP_SHARE: 0.85,
  UP_MIN: 60,
  UP_MAX: 150,
  /** Used when calibration was skipped. */
  UP_DEFAULT: 90,
  /** "Down" = within this many degrees above the resting arm. */
  DOWN_ABOVE_REST: 20,
  DOWN_DEFAULT: 35,
  /** The top may sag this much without breaking the hold. */
  SAG: 8,
  HOLD_SEC: 3,
  GRACE_MS: 700,
};

/** The personal up / down lines from the calibration summary. */
export function fingerWalkLines(rest: unknown, range: unknown): { up: number; down: number } {
  const up = typeof range === "number" && range > 0
    ? Math.min(FINGER_WALK.UP_MAX, Math.max(FINGER_WALK.UP_MIN, range * FINGER_WALK.UP_SHARE))
    : FINGER_WALK.UP_DEFAULT;
  const downRaw = typeof rest === "number" ? rest + FINGER_WALK.DOWN_ABOVE_REST : FINGER_WALK.DOWN_DEFAULT;
  // Keep a clear gap between the two lines, but never below the resting
  // arm (else a full return never crosses it and only one rep counts).
  let down = Math.min(downRaw, up - 25);
  if (typeof rest === "number") down = Math.max(down, rest + 3);
  return { up, down };
}

