// Lines for exercises that work toward a STRAIGHTER knee (lower
// flexion), in the patient's own flexion degrees. A knee rarely reads 0°
// on camera and a post-op knee may stop at 10–20°, so the target is
// what the patient reached in calibration, plus a small allowance —
// never a fixed "straight".
//
//   enter   — flexion at or below this starts the hold:
//             calibrated range + ALLOW, but always at least MARGIN
//             straighter than rest
//   release — flexion above this re-arms the next hold:
//             rest − MARGIN, at least GAP above enter

export interface FlexionLines {
  enter: number;
  release: number;
}

export const FLEXION_LINES = {
  allow: 3,
  margin: 3,
  gap: 4,
  /** Clamp for enter, degrees of flexion. */
  minEnter: 0,
  maxEnter: 30,
  defaultEnter: 10,
  defaultRelease: 20,
};

export function flexionLines(rest: unknown, range: unknown, cfg = FLEXION_LINES): FlexionLines {
  const r = typeof range === "number" && Number.isFinite(range) ? range : null;
  const s = typeof rest === "number" && Number.isFinite(rest) ? rest : null;
  if (r === null) return { enter: cfg.defaultEnter, release: cfg.defaultRelease };
  let enter = r + cfg.allow;
  if (s !== null) enter = Math.min(enter, s - cfg.margin);
  enter = Math.max(cfg.minEnter, Math.min(cfg.maxEnter, enter));
  const release = Math.max(enter + cfg.gap, s !== null ? s - cfg.margin : enter + cfg.gap);
  return { enter, release };
}
