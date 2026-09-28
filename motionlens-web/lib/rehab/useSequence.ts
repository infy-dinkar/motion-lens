"use client";
// useRehabSequence — the per-page view of a prescribed session.
//
// Every exercise page calls this hook. Outside a session it reports
// `inSequence: false` and the page behaves exactly as it does today —
// that is the whole point of the arrangement. Inside one it tells the
// page where it sits in the queue and hands it the two actions the
// chrome needs: record this result, and move on.
//
// The session state arrives through context, supplied by the runner at
// app/rehab/auto/run. It used to come from the URL, with one route per
// exercise, and that had to go: a route change cost tens of seconds on
// the finished exercise before the next one appeared, in a production
// build as well as in dev. The runner keeps one route and swaps the
// exercise by `key`, the way Biomechanics Auto Mode always has.
//
// What this hook deliberately does NOT do:
//
//   • It does not start the session. Each exercise keeps its own gate.
//     Where the prescription set a side the page seeds its own state
//     from `side` and never renders the picker; where it did not, the
//     picker appears exactly as it does outside a session.
//
//   • It does not save anything. Results are stashed; the combined
//     report is written once, on the done screen.
//
//   • It does not touch the exercise's phase machine. `markComplete`
//     still comes from useRehabAutoFlow exactly as before; the page
//     just renders different chrome once it fires.

import type { RehabSide } from "@/lib/rehab/prescriptions";
import { useSequenceContext } from "@/lib/rehab/sequenceContext";

export interface RehabSequence {
  /** False on a normal standalone visit — the page renders its usual
   *  chrome and saves its own report. */
  inSequence: boolean;
  /** 0-based position in the queue. */
  index: number;
  total: number;
  /**
   * The side this exercise was prescribed on, or null when the doctor
   * left it open. Null is also what a bilateral exercise reports, and
   * what everything reports outside a session — in all three cases the
   * page shows its own picker, exactly as it always has.
   */
  side: RehabSide | null;
  /**
   * Get-ready countdown to hand to useRehabAutoFlow.
   *
   * Undefined outside a session, which leaves that hook on its own 3 s
   * default — so a standalone visit is untouched.
   */
  countdownSec: number | undefined;
  /** Name of the exercise after this one, side included, or null on
   *  the last. */
  nextTitle: string | null;
  /**
   * Record this exercise's result.
   *
   * Takes the page's own buildRehabPayload output so the stashed
   * metrics are byte-for-byte what a standalone save would have filed.
   * Returns false if session storage refused the write.
   */
  stash: (payload: {
    side?: "left" | "right";
    movement?: string;
    metrics?: Record<string, unknown>;
    observations?: Record<string, unknown>;
  } | null) => boolean;
  /**
   * Warm whatever comes next.
   *
   * A no-op now that the runner has every exercise loaded already —
   * kept so the chrome does not have to know how the runner is built.
   */
  prefetchNext: () => void;
  /** Move to the next exercise, or to the done screen after the last. */
  goNext: () => void;
  /** End the session here. Whatever is already stashed still gets
   *  saved — a patient who stops after four of five did four
   *  exercises. */
  stop: () => void;
}

/** What an exercise opened on its own sees. */
const IDLE: RehabSequence = {
  inSequence: false,
  index: 0,
  total: 0,
  side: null,
  countdownSec: undefined,
  nextTitle: null,
  stash: () => false,
  prefetchNext: () => {},
  goNext: () => {},
  stop: () => {},
};

export function useRehabSequence(): RehabSequence {
  // No provider above means this exercise was opened directly, which
  // is every visit from the catalogue or from a patient's card.
  return useSequenceContext() ?? IDLE;
}
