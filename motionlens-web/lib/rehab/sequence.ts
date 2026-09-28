// Prescribed-session sequencing — the data half.
//
// A "sequence" is the doctor's prescribed exercise list played one
// after another, the way Biomechanics Auto Mode plays a queue of
// movements. The arrangement is deliberately different from
// lib/biomech/autoModeCatalog.ts in two ways, and both differences
// come from the same fact: a rehab exercise is a PAGE, not a mounted
// component.
//
//   • The queue rides in the URL of each exercise page rather than in
//     one runner page's URL, because the runner never owns the screen
//     — the exercise page does. Every page reads the same three
//     params and knows where it sits in the list.
//
//   • The finished payloads are stashed in sessionStorage instead of a
//     ref, because a ref does not survive a route change. They are
//     collected at the end into ONE combined report.
//
// SIDE IS PER STEP, not per session. A left-knee exercise and a
// right-shoulder exercise belong in the same prescription, so there is
// no one side for the sitting. Where the doctor set one it rides in
// the queue and the exercise skips its picker; where they did not, the
// picker appears exactly as it does outside a session.

import { findExercise, needsSide } from "@/lib/rehab/exerciseCatalog";
import type { RehabSide } from "@/lib/rehab/prescriptions";

/**
 * Get-ready countdown once an exercise opens inside a session.
 *
 * Longer than the 3 s a standalone visit uses, because in a session
 * nobody tapped anything: the exercise opened by itself and the
 * patient may still have to get onto the floor or up against a wall
 * before the first rep should count. With SEQUENCE_GAP_SEC before it,
 * this is the full gap between one exercise finishing and the next
 * one scoring. Space / Escape and the Skip button both cut it short.
 */
export const SEQUENCE_COUNTDOWN_SEC = 10;

/**
 * Seconds between "Session complete" and the next exercise opening.
 *
 * The real pause is longer than this number: at zero the router moves
 * to the next exercise, which remounts the page and restarts the
 * camera, and the screen holds on the finished exercise while that
 * happens. So the counter is set below the gap actually wanted —
 * matching Biomechanics Auto Mode, which lands in the same place for
 * the same reason.
 */
export const SEQUENCE_GAP_SEC = 8;

/** Query parameter names, in one place so the pages and the done
 *  screen cannot drift apart. */
export const SEQ_PARAM = "seq";
export const INDEX_PARAM = "i";
export const SID_PARAM = "sid";
export const STOPPED_PARAM = "stopped";

/** One stashed exercise result, waiting to be folded into the
 *  combined report. Mirrors the per-exercise payload each page
 *  already builds — nothing is reshaped on the way in, so a sequence
 *  item and a standalone save carry identical `metrics`. */
export interface SequenceItem {
  slug: string;
  side: "left" | "right" | null;
  metrics: Record<string, unknown>;
  observations: Record<string, unknown>;
}

// ── The queue in the URL ──────────────────────────────────────────

/**
 * One exercise in the queue.
 *
 * A one-sided exercise prescribed on both sides appears TWICE, once
 * per side — the session has no picker, so a single step could only
 * ever train one of them. `side` null means the page asks, which is
 * what a bilateral exercise and a pre-sides prescription both produce.
 */
export interface SequenceStep {
  slug: string;
  side: RehabSide | null;
}

/** Slugs are `[a-z-]+` and sides are two known words, so `;` between
 *  steps and `:` before a side need no escaping. */
export function encodeSequence(steps: SequenceStep[]): string {
  return steps
    .map((s) => (s.side ? `${s.slug}:${s.side}` : s.slug))
    .join(";");
}

/**
 * Decode, dropping anything the catalogue does not know.
 *
 * A hand-edited or stale URL must not be able to send a patient to a
 * route that does not exist, or to start an exercise on a side it does
 * not have, so both halves are checked against the catalogue rather
 * than trusted.
 */
export function decodeSequence(encoded: string | null): SequenceStep[] {
  if (!encoded) return [];
  const out: SequenceStep[] = [];
  // Keyed by slug AND side: "squat:left" and "squat:right" are two
  // legitimate steps, but the same pair twice is a mistake.
  const seen = new Set<string>();
  for (const raw of encoded.split(";")) {
    const [slugRaw, sideRaw] = raw.trim().split(":");
    const slug = (slugRaw ?? "").trim();
    if (!slug) continue;
    if (!findExercise(slug)) continue;
    // A side on a bilateral exercise would be meaningless, and the
    // page has no state to put it in — drop it rather than carry it.
    const side: RehabSide | null =
      needsSide(slug) && (sideRaw === "left" || sideRaw === "right")
        ? sideRaw
        : null;
    const key = `${slug}:${side ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ slug, side });
  }
  return out;
}

/** Display title for a slug, falling back to a humanised slug so the
 *  chrome never renders an empty label. */
export function titleOfSlug(slug: string): string {
  const ex = findExercise(slug);
  if (ex?.title) return ex.title as string;
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * A fresh session id.
 *
 * Scopes the sessionStorage stash so two prescribed sessions open in
 * two tabs cannot pour their results into each other's combined
 * report. Not a security token — `Math.random` is fine.
 */
export function newSequenceId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

interface UrlParts {
  patientId: string | null;
  seq: string;
  sid: string;
}

/**
 * URL of the runner, which hosts the whole session.
 *
 * There is no per-exercise URL any more: every exercise runs inside
 * this one route, swapped by `key`. `index` rides along only so a
 * refresh resumes in the right place — the runner keeps the live
 * position in React state.
 */
export function runnerUrl(
  { patientId, seq, sid }: UrlParts,
  index = 0,
): string {
  const q = new URLSearchParams();
  if (patientId) q.set("patientId", patientId);
  q.set(SEQ_PARAM, seq);
  q.set(INDEX_PARAM, String(index));
  q.set(SID_PARAM, sid);
  return `/rehab/auto/run?${q.toString()}`;
}

/** URL of the done screen, which is where the combined save happens. */
export function doneUrl(
  { patientId, seq, sid }: UrlParts,
  stopped = false,
): string {
  const q = new URLSearchParams();
  if (patientId) q.set("patientId", patientId);
  q.set(SEQ_PARAM, seq);
  q.set(SID_PARAM, sid);
  if (stopped) q.set(STOPPED_PARAM, "1");
  return `/rehab/auto/done?${q.toString()}`;
}

// ── The stash ─────────────────────────────────────────────────────
//
// sessionStorage, not localStorage: a prescribed session is a single
// sitting, and a stash that outlived the tab would be a way to file a
// week-old exercise into today's report.
//
// Every accessor is wrapped, because storage throws rather than
// returning null in a private window and in some embedded webviews. A
// failed stash must not break the exercise the patient just finished
// — it costs that exercise its row in the combined report, and the
// done screen says so.

const STASH_PREFIX = "motionlens.rehabseq:";

function stashKey(sid: string): string {
  return STASH_PREFIX + sid;
}

type StashMap = Record<string, SequenceItem>;

function readMap(sid: string): StashMap {
  try {
    const raw = window.sessionStorage.getItem(stashKey(sid));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as StashMap;
  } catch {
    return {};
  }
}

/**
 * Record one finished exercise.
 *
 * Keyed by INDEX rather than appended, so a patient who re-does an
 * exercise by going back replaces that row instead of filing it
 * twice.
 *
 * @returns true when the write actually landed.
 */
export function stashItem(
  sid: string,
  index: number,
  item: SequenceItem,
): boolean {
  try {
    const map = readMap(sid);
    map[String(index)] = item;
    window.sessionStorage.setItem(stashKey(sid), JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

/**
 * Everything stashed so far, in queue order, each carrying the queue
 * index it came from.
 *
 * The index matters now that one exercise can occupy two steps: the
 * done screen has to be able to say which of "Squat · Left" and
 * "Squat · Right" was completed, and the slug alone cannot.
 *
 * Gaps — a skipped or abandoned exercise — simply do not appear.
 */
export function readStash(sid: string): StashedItem[] {
  const map = readMap(sid);
  return Object.keys(map)
    .map((k) => ({ index: Number(k), ...map[k] }))
    .filter((e) => Number.isFinite(e.index) && typeof e.slug === "string")
    .sort((a, b) => a.index - b.index);
}

/** A stashed item plus the queue position it was recorded at. */
export type StashedItem = SequenceItem & { index: number };

/** Drop the stash. Called once the combined report is safely saved —
 *  never before, or a failed save would lose the whole session. */
export function clearStash(sid: string): void {
  try {
    window.sessionStorage.removeItem(stashKey(sid));
  } catch {
    // Nothing to do: the stash is session-scoped and will go with the
    // tab anyway.
  }
}
