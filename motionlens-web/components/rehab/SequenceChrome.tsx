"use client";
// Prescribed-session chrome — the two pieces an exercise page renders
// while it is part of a sequence.
//
//   <SequenceStrip />   a header band: where we are, what is next,
//                       and the way out
//   <SequenceNext />    replaces the page's normal footer once the
//                       exercise is complete: records the result and
//                       counts down to the next exercise
//
// Deliberately the only place the sequence writes anything. The
// exercise page hands over its own buildRehabPayload and otherwise
// carries on as it always has.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  SkipForward,
  Square,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { SEQUENCE_GAP_SEC } from "@/lib/rehab/sequence";
import type { RehabSequence } from "@/lib/rehab/useSequence";
import type { ReportCreatePayload } from "@/lib/reports";

/** Header band. Shown from the moment the exercise opens, so the
 *  patient can see the session has a shape and an end. */
export function SequenceStrip({ seq }: { seq: RehabSequence }) {
  if (!seq.inSequence) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/30 bg-accent/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          Prescribed session
        </span>
        <span className="text-sm text-foreground">
          Exercise {seq.index + 1} of {seq.total}
        </span>
        {seq.nextTitle && (
          <span className="hidden text-xs text-muted sm:inline">
            · next: {seq.nextTitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Dots total={seq.total} index={seq.index} />
        <Button variant="ghost" size="sm" onClick={seq.stop}>
          <Square className="h-3.5 w-3.5" />
          End session
        </Button>
      </div>
    </div>
  );
}

function Dots({ total, index }: { total: number; index: number }) {
  // Above a dozen exercises the dots stop being readable and start
  // being a texture, so the count carries it instead.
  if (total > 12) return null;
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < index
              ? "w-1.5 bg-accent/50"
              : i === index
                ? "w-5 bg-accent"
                : "w-1.5 bg-border"
          }`}
        />
      ))}
    </span>
  );
}

/**
 * Post-exercise card: stash the result, then move on.
 *
 * The stash fires exactly once on mount — the same one-shot discipline
 * AutoSaveToast uses, and for the same reason: React re-invokes mount
 * effects in dev, and the page can re-render for a dozen unrelated
 * reasons while this card is on screen.
 */
export function SequenceNext({
  seq,
  buildPayload,
}: {
  seq: RehabSequence;
  buildPayload: () => ReportCreatePayload | null;
}) {
  const [left, setLeft] = useState(SEQUENCE_GAP_SEC);
  const [paused, setPaused] = useState(false);
  const [stashed, setStashed] = useState<"ok" | "failed" | null>(null);
  // Set the instant the push is issued. The outgoing page stays
  // mounted until the next route is ready, so without this the card
  // would sit on "in 0s" for however long that takes.
  const [navigating, setNavigating] = useState(false);

  const firedRef = useRef(false);
  // buildPayload is rebuilt on every render of the exercise page (it
  // closes over the session refs), so it is read through a ref rather
  // than depended on — same arrangement AutoSaveToast uses.
  const buildRef = useRef(buildPayload);
  buildRef.current = buildPayload;

  // `seq` itself IS stable (useRehabSequence memoises it), so the
  // effects below can depend on it directly.
  const { stash, goNext, prefetchNext } = seq;

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setStashed(stash(buildRef.current()) ? "ok" : "failed");
  }, [stash]);

  // Warm the next route for the whole length of the countdown, so the
  // transition is not also a fetch.
  useEffect(() => {
    prefetchNext();
  }, [prefetchNext]);

  const leave = useCallback(() => {
    setNavigating(true);
    goNext();
  }, [goNext]);

  // Tick. Advancing happens from the tick rather than from a separate
  // effect so there is exactly one place that can leave on a timer.
  useEffect(() => {
    if (paused || navigating) return;
    if (left <= 0) {
      leave();
      return;
    }
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left, paused, navigating, leave]);

  const skipNow = useCallback(() => {
    setPaused(true);
    leave();
  }, [leave]);

  const last = seq.nextTitle === null;

  return (
    <div className="rounded-card border border-emerald-500/40 bg-emerald-500/5 p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Exercise {seq.index + 1} of {seq.total} complete
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            {navigating && (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin text-accent" />
            )}
            {navigating
              ? last
                ? "Finishing the session…"
                : `Opening ${seq.nextTitle}…`
              : last
                ? paused
                  ? "Finishing the session."
                  : `Finishing the session in ${left}s — the full report saves at the end.`
                : paused
                  ? `Paused. Next: ${seq.nextTitle}.`
                  : `Next: ${seq.nextTitle} in ${left}s.`}
          </p>
        </div>
      </div>

      {stashed === "failed" && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          This browser blocked session storage, so this exercise will be
          missing from the combined report. The rest of the session is
          unaffected.
        </p>
      )}

      <div
        className={`mt-3 flex flex-wrap gap-2 ${navigating ? "pointer-events-none opacity-40" : ""}`}
      >
        <Button variant="secondary" size="sm" onClick={skipNow}>
          <SkipForward className="h-3.5 w-3.5" />
          {last ? "Finish now" : "Next now"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? (
            <>
              <Play className="h-3.5 w-3.5" />
              Resume
            </>
          ) : (
            <>
              <Pause className="h-3.5 w-3.5" />
              Pause
            </>
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={seq.stop}>
          <Square className="h-3.5 w-3.5" />
          End session
        </Button>
      </div>
    </div>
  );
}
