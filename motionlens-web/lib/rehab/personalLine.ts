// Personal "reached" / "back" lines from a calibration.
//
// For exercises where the patient's own range decides what counts:
// the "up" line is a share of the highest value shown in calibration
// (hold 2), kept within [min, max]; the "down" line sits a little
// above the resting value (hold 1). Defaults apply when calibration
// was skipped. A clear gap is kept between the two lines.

/** The "back" line stays at least this far above the resting value. */
const REST_MARGIN = 3;

export type PersonalLineConfig = {
  share: number;
  min: number;
  max: number;
  defaultUp: number;
  downAboveRest: number;
  defaultDown: number;
  minGap: number;
};

export function personalLines(
  rest: unknown,
  range: unknown,
  cfg: PersonalLineConfig,
): { up: number; down: number } {
  const up = typeof range === "number" && range > 0
    ? Math.min(cfg.max, Math.max(cfg.min, range * cfg.share))
    : cfg.defaultUp;
  const downRaw = typeof rest === "number" ? rest + cfg.downAboveRest : cfg.defaultDown;
  let down = Math.min(downRaw, up - cfg.minGap);
  // Never below the resting value: with a small range the gap rule could
  // push it there, and a patient who returns fully to rest would then
  // never cross it and only the first rep would ever count.
  if (typeof rest === "number") down = Math.max(down, rest + REST_MARGIN);
  return { up, down };
}
