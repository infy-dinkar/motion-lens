"use client";
// The prescribed-session runner.
//
// One route for the whole session. The exercise is a mounted component
// swapped by `key`, exactly the way app/biomech/auto/run/page.tsx
// swaps LiveAssessment — and for exactly the same reason: moving
// between routes cost tens of seconds per exercise, in a production
// build as well as in dev, while a keyed remount is immediate.
//
// The runner deliberately renders NO chrome of its own. Each exercise
// component still brings its own Nav, Footer and layout, so a session
// looks identical to opening that exercise directly. All this page
// contributes is the queue position, which reaches the exercise
// through SequenceProvider instead of through the URL.
//
// The URL still carries the queue, the session id and the current
// index so a refresh resumes where it was; the index is written with
// history.replaceState rather than router.replace, because going
// through the router would reintroduce the navigation this page exists
// to avoid.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { stopAllCameras } from "@/hooks/useCamera";
import { exerciseComponent } from "@/lib/rehab/exerciseComponents";
import { SequenceProvider } from "@/lib/rehab/sequenceContext";
import {
  INDEX_PARAM,
  SEQUENCE_COUNTDOWN_SEC,
  SEQ_PARAM,
  SID_PARAM,
  decodeSequence,
  doneUrl,
  stashItem,
  titleOfSlug,
  type SequenceItem,
} from "@/lib/rehab/sequence";
import type { RehabSequence } from "@/lib/rehab/useSequence";

export default function RehabSessionRunPage() {
  return (
    <Suspense fallback={null}>
      <Runner />
    </Suspense>
  );
}

function Runner() {
  const params = useSearchParams();
  const router = useRouter();

  const seqRaw = params.get(SEQ_PARAM);
  const sidRaw = params.get(SID_PARAM);
  const rawPatientId = params.get("patientId");
  const patientId =
    rawPatientId && rawPatientId !== "undefined" && rawPatientId !== "null"
      ? rawPatientId
      : null;

  const steps = useMemo(() => decodeSequence(seqRaw), [seqRaw]);
  const sid = sidRaw && sidRaw.trim() ? sidRaw : null;

  // Read once. After this the index lives in React state — putting it
  // back through the router is what made the old arrangement slow.
  const [index, setIndex] = useState(() => {
    const n = Number(params.get(INDEX_PARAM));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  });

  const valid = steps.length > 0 && sid !== null && index < steps.length;

  // Keep the address bar in step so a refresh resumes here. replaceState
  // does not touch the router, so nothing re-renders and no navigation
  // is queued.
  useEffect(() => {
    if (!valid) return;
    const url = new URL(window.location.href);
    url.searchParams.set(INDEX_PARAM, String(index));
    // The state argument MUST be null: Next patches replaceState and
    // merges its own routing internals itself. Passing the previous
    // state back corrupts the entry, and a later Back restores the
    // wrong route.
    window.history.replaceState(null, "", url.toString());
  }, [index, valid]);


  const finish = useCallback(
    (stopped: boolean) => {
      if (!sid || !seqRaw) return;
      // The session really is over, so let go of fullscreen now rather
      // than after the layout's grace period — the done screen is a
      // page to read, not to stand in front of a camera for.
      stopAllCameras();
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      // replace, not push: the whole session occupies ONE history
      // entry, so Back from the done screen returns to wherever the
      // patient started rather than remounting the last exercise.
      router.replace(doneUrl({ patientId, seq: seqRaw, sid }, stopped));
    },
    [router, patientId, seqRaw, sid],
  );

  // The session as the exercise sees it. Memoised because SequenceNext
  // keeps a countdown alive across renders and depends on these
  // callbacks staying put.
  const step = valid ? steps[index] : null;
  const nextStep = valid && index + 1 < steps.length ? steps[index + 1] : null;

  const indexRef = useRef(index);
  indexRef.current = index;

  const stash = useCallback<RehabSequence["stash"]>(
    (payload) => {
      if (!sid || !step || !payload) return false;
      const item: SequenceItem = {
        slug: step.slug,
        // From the payload, not the queue: this records the side that
        // was actually worked, and the page can still change it.
        side:
          payload.side === "left" || payload.side === "right"
            ? payload.side
            : null,
        metrics: payload.metrics ?? {},
        observations: payload.observations ?? {},
      };
      return stashItem(sid, indexRef.current, item);
    },
    [sid, step],
  );

  const goNext = useCallback(() => {
    // Release the device before the swap so the incoming exercise is
    // not asking for a camera the outgoing one still holds.
    stopAllCameras();
    const i = indexRef.current;
    if (i + 1 >= steps.length) {
      finish(false);
      return;
    }
    // Fullscreen survives this on its own: the outgoing layout defers
    // its exit and the incoming one cancels it. See fullscreenPresence.
    setIndex(i + 1);
  }, [steps.length, finish]);

  const stop = useCallback(() => finish(true), [finish]);

  const sequence: RehabSequence = useMemo(
    () => ({
      inSequence: true,
      index,
      total: steps.length,
      side: step?.side ?? null,
      countdownSec: SEQUENCE_COUNTDOWN_SEC,
      nextTitle: nextStep
        ? nextStep.side
          ? `${titleOfSlug(nextStep.slug)} · ${nextStep.side === "left" ? "Left" : "Right"}`
          : titleOfSlug(nextStep.slug)
        : null,
      stash,
      // Nothing to prefetch: every exercise is already loaded.
      prefetchNext: () => {},
      goNext,
      stop,
    }),
    [index, steps.length, step, nextStep, stash, goNext, stop],
  );

  if (!valid || !step) return <BadLink patientId={patientId} />;

  const Exercise = exerciseComponent(step.slug);
  if (!Exercise) return <BadLink patientId={patientId} />;

  return (
    <SequenceProvider value={sequence}>
      {/* The key is what makes a switch a fresh exercise: same remount
          discipline biomech's auto runner uses, so no session state
          leaks from one exercise into the next. It includes the side,
          because an exercise prescribed on both sides occupies two
          consecutive steps with the same slug. */}
      <div key={`${index}:${step.slug}:${step.side ?? ""}`}>
        <Exercise />
      </div>
    </SequenceProvider>
  );
}

/** A hand-edited, stale, or half-copied session link. */
function BadLink({ patientId }: { patientId: string | null }) {
  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <h1 className="text-3xl font-semibold tracking-tight">
            This session link is no longer valid
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-4 max-w-xl text-muted">
            Start the session again from the patient&apos;s rehab page.
          </p>
          <div className="mt-8">
            <Button
              onClick={() => {
                window.location.href = patientId
                  ? `/dashboard/patients/${patientId}/rehab`
                  : "/rehab";
              }}
            >
              {patientId ? "Back to rehab" : "Back to catalogue"}
            </Button>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
