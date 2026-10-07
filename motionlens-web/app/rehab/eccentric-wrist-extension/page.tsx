"use client";
// W5 — Eccentric Wrist Extension (palm down) — tennis elbow (wrist extensors).
//
// Patient sits, forearm on the thigh, palm down, a light weight in the
// hand (or a FlexBar — Tyler twist (FlexBar)), side-on to the camera with that
// arm nearest it. The OTHER hand lifts the wrist up; then the patient
// lowers it SLOWLY on their own. The slow lowering is the exercise.
//
// Signal: signed wrist angle (computeWristFlexExtDeg, lib/rehab/
// poseMetrics; + up on screen). Calibration: rest = wrist held up,
// range = lowered. Timing: lib/rehab/loweringTimer — a rep counts only
// when the lowering from the upper line to the lower line takes at least
// MIN_LOWER_SEC; faster ones are counted as "too fast". Palm direction
// is not seen, so the camera cannot tell this from the flexion version.
// Reps only.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RehabCameraShell } from "@/components/rehab/mechanics/RehabCameraShell";
import {
  AutoFlowCompleteOverlay,
  AutoFlowCountdownCard,
  AutoFlowCountdownOverlay,
  AutoFlowFooter,
} from "@/components/rehab/mechanics/AutoFlowChrome";
import {
  SequenceNext,
  SequenceStrip,
} from "@/components/rehab/SequenceChrome";
import { useRehabSequence } from "@/lib/rehab/useSequence";
import { useRehabAutoFlow } from "@/lib/rehab/useAutoFlow";
import { useRehabCalibration } from "@/lib/rehab/calibration/useRehabCalibration";
import { RehabCalibrationOverlay } from "@/components/rehab/RehabCalibrationOverlay";
import { LiveModeLayout } from "@/components/live/LiveModeLayout";
import { computeWristFlexExtDeg } from "@/lib/rehab/poseMetrics";
import { bothEndsFrom } from "@/lib/rehab/bothEndsCounter";
import { createLoweringTimer } from "@/lib/rehab/loweringTimer";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "eccentric-wrist-extension";
const TITLE = "Eccentric Wrist Extension";

type Side = "left" | "right";

/** Ends and the dead band (degrees). */
const ENDS = { zoneShare: 0.3, minSpan: 20, defaultHigh: 20, defaultLow: -30 };
/** Upper / lower timing lines, as shares of the calibrated span from the
 *  lowered end. */
const UPPER_SHARE = 0.7;
const LOWER_SHARE = 0.3;
/** Turn-back (degrees) that ends a lowering at its lowest point. */
const FOLLOW_DEG = 3;
/** The lowering must take at least this long for the rep to count. */
const MIN_LOWER_SEC = 3;
/** Slow lowerings in the set. */
const TARGET_REPS = 10;
const POINTS_PER_REP = 3;

function makeLower(ends: { high: number; low: number }) {
  const span = ends.high - ends.low;
  return createLoweringTimer({
    top: ends.low + UPPER_SHARE * span,
    depth: ends.low + LOWER_SHARE * span,
    minSec: MIN_LOWER_SEC,
    direction: "down",
    // Time the WHOLE lowering, to the lowest point — not just to the
    // lower line (that would leave out the last part of the drop).
    followThrough: FOLLOW_DEG,
  });
}

export default function EccentricWristExtensionPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [side, setSide] = useState<Side | null>(null);
  const [bar, setBar] = useState<number | null>(null);
  const [angle, setAngle] = useState(0);
  const [lastFast, setLastFast] = useState(false);
  const [counts, setCounts] = useState({ reps: 0, attempts: 0 });

  const { patient, isDoctorFlow } = usePatientContext();
  const seq = useRehabSequence();

  // A prescribed session supplies the side, so the picker is skipped.
  // Applied ONCE: if the patient exits, the picker comes back.
  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (seq.side && !autoStarted) {
      setAutoStarted(true);
      setSide(seq.side);
    }
  }, [seq.side, autoStarted]);

  const sessionStartRef = useRef<number>(performance.now());
  const endsRef = useRef(bothEndsFrom(null, null, ENDS));
  const lowerRef = useRef(makeLower(bothEndsFrom(null, null, ENDS)));
  const countsRef = useRef({ reps: 0, attempts: 0 });
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);

  // Side-on and sided: calibration records the held-up and lowered ends.
  const calibration = useRehabCalibration(SLUG, side, side !== null);
  const calibSummaryRef = useRef(calibration.summary);
  calibSummaryRef.current = calibration.summary;

  const {
    phase: sessionPhase,
    countdown,
    skipCountdown,
    markComplete,
  } = useRehabAutoFlow(side !== null, () => {
    sessionStartRef.current = performance.now();
    // Ends from this calibration (defaults when skipped or too close):
    // rest = held up, range = lowered.
    const summary = calibSummaryRef.current();
    endsRef.current = bothEndsFrom(summary?.rest, summary?.range, ENDS);
    lowerRef.current = makeLower(endsRef.current);
    countsRef.current = { reps: 0, attempts: 0 };
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setCounts(countsRef.current);
    setBar(null);
    setLastFast(false);
  }, seq.countdownSec, calibration);
  const phaseRef = useRef(sessionPhase);
  phaseRef.current = sessionPhase;

  const handleFrame = useCallback(
    (kp: Keypoint[], video: HTMLVideoElement) => {
      const live = kp as unknown as LiveKeypoint[];
      calibration.feed(live, video);
      if (!side) return;
      const wrist = computeWristFlexExtDeg(live, side);
      if (wrist === null) return;
      setAngle(wrist);
      if (phaseRef.current !== "live") return;
      const { high, low } = endsRef.current;
      setBar(high > low ? Math.max(0, Math.min(1, (wrist - low) / (high - low))) : null);
      const done = lowerRef.current.step(wrist, performance.now());
      if (done) {
        const c = { ...countsRef.current };
        if (done.slow) {
          c.reps += 1;
          streakRef.current += 1;
          bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
        } else {
          c.attempts += 1;
          streakRef.current = 0;
        }
        setLastFast(!done.slow);
        countsRef.current = c;
        setCounts(c);
        if (c.reps >= TARGET_REPS) markComplete();
      }
    },
    [side, markComplete],
  );

  const buildRehabPayload = useCallback(() => {
    if (!side) return null;
    const { reps, attempts } = countsRef.current;
    const score = {
      points: reps * POINTS_PER_REP,
      streak: streakRef.current,
      bestStreak: bestStreakRef.current,
    };
    const interpretation = reps > 0
      ? `${reps} of ${TARGET_REPS} slow eccentric wrist extensions (${side} wrist)`
        + (attempts > 0 ? `; ${attempts} lowered too fast.` : ".")
      : `No slow eccentric wrist extensions counted (${side} wrist).`;
    return {
      module: "rehab" as const,
      movement: SLUG,
      side,
      metrics: {
        calibration: calibSummaryRef.current(),
        exercise_slug: SLUG,
        mechanic_id: "rep_count",
        started_at_ms: sessionStartRef.current,
        duration_sec: elapsedSecondsSince(sessionStartRef.current),
        score,
        mechanic_state: { reps, goodReps: reps, tooFast: attempts },
        target_reps: TARGET_REPS,
        config: { ...ENDS, upperShare: UPPER_SHARE, lowerShare: LOWER_SHARE, minLowerSec: MIN_LOWER_SEC, followThroughDeg: FOLLOW_DEG },
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [side]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const sideWord = side === "left" ? "Left" : "Right";
  const holdPct = bar === null ? 50 : bar * 100;
  const holdHint = lastFast
    ? `Too fast — lower over ${MIN_LOWER_SEC} seconds`
    : bar !== null && bar > 0.5
      ? `Now lower it slowly — ${MIN_LOWER_SEC} seconds`
      : "Lift the wrist up with the other hand";

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>W5 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Sit with the forearm on your thigh, <strong>palm down</strong>,
                a light weight in the hand (or a FlexBar — Tyler twist (FlexBar)),
                side-on to the camera with that arm nearest it. Lift the
                wrist up with the other hand, then lower it slowly on its
                own over {MIN_LOWER_SEC} seconds. Goal {TARGET_REPS} slow lowerings.
              </p>
              {isDoctorFlow && patient && (
                <p className="mt-3 text-xs text-muted">
                  Connected to{" "}
                  <span className="font-semibold text-foreground">
                    {patient.name}
                  </span>
                  &apos;s record.
                </p>
              )}
            </div>
            <Link href="/rehab">
              <Button variant="ghost" size="sm">← Catalogue</Button>
            </Link>
          </div>

          <SequenceStrip seq={seq} />

          {!side && (autoStarted || !seq.side) ? (
            <SidePicker onPick={setSide} image={image} />
          ) : null}

          {side && (
            <LiveModeLayout
              title={`${TITLE} · ${sideWord} wrist`}
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} reps`}
              onExit={() => setSide(null)}
              camera={(
                <RehabCameraShell onFrame={handleFrame} autoStart hideControls>
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      {side === "left" ? "L" : "R"} wrist
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {angle >= 0 ? "+" : "−"}{Math.abs(angle).toFixed(0)}°
                    </p>
                    <p className="tabular text-[11px] text-zinc-300">
                      {counts.reps} slow
                    </p>
                  </div>
                  {sessionPhase === "calibrate" && calibration.state && (
                    <RehabCalibrationOverlay
                      state={calibration.state}
                      onStartAnyway={calibration.startAnyway}
                    />
                  )}
                  {sessionPhase === "countdown" && countdown !== null && (
                    <AutoFlowCountdownOverlay countdown={countdown} />
                  )}
                  {sessionPhase === "complete" && <AutoFlowCompleteOverlay />}
                </RehabCameraShell>
              )}
              sidebar={(
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-400/40">
                      {sideWord} wrist
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setSide(null)}>
                      Change side
                    </Button>
                  </div>
                  {image && (
                    <div className="overflow-hidden rounded-md border border-border bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image} alt={`${TITLE} reference`} loading="lazy" className="block w-full object-contain" style={{ maxHeight: 140 }} />
                      <p className="border-t border-border bg-surface px-2 py-1 text-center text-[10px] uppercase tracking-[0.12em] text-muted">Reference form</p>
                    </div>
                  )}
                  {sessionPhase === "countdown" && countdown !== null && (
                    <AutoFlowCountdownCard
                      countdown={countdown}
                      onSkip={skipCountdown}
                      hint="Forearm on the thigh, palm down, weight in the hand."
                    />
                  )}
                  {(sessionPhase === "live" || sessionPhase === "complete") && (
                    <div className="rounded-card border border-border bg-surface p-4">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                        Reps
                      </p>
                      <p className="tabular mt-1 text-4xl font-semibold">
                        {counts.reps}
                        <span className="text-lg text-muted"> / {TARGET_REPS}</span>
                      </p>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-accent transition-[width] duration-200"
                          style={{ width: `${holdPct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm font-medium">{holdHint}</p>
                      {counts.attempts > 0 && (
                        <p className="tabular mt-3 text-xs text-muted">
                          {counts.attempts} lowered too fast
                        </p>
                      )}
                    </div>
                  )}
                  <div className="no-pdf">
                    {seq.inSequence ? (
                      sessionPhase === "complete" && (
                        <SequenceNext seq={seq} buildPayload={buildRehabPayload} />
                      )
                    ) : (
                      <AutoFlowFooter
                        complete={sessionPhase === "complete"}
                        buildPayload={buildRehabPayload}
                      />
                    )}
                  </div>
                </>
              )}
            />
          )}

          <div className="mt-16 rounded-card border border-border bg-surface p-5 text-sm text-muted">
            <p className="font-semibold text-foreground">Camera setup</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                Camera at thigh height, ~1–1.5 m away, <strong>side-on, the
                chosen arm nearest the camera</strong>.
              </li>
              <li>
                Elbow to fingertips in frame and large; good light. A light
                dumbbell, a water bottle, or a FlexBar.
              </li>
              <li>
                Calibration: palm down, the other hand lifts the wrist up —
                hold; then let it down all the way — hold. Live: each slow
                lowering (at least {MIN_LOWER_SEC} s) is one rep; a faster
                one is shown as &ldquo;too fast&rdquo; and does not count.
              </li>
              <li>Target: {TARGET_REPS} reps with the chosen wrist.</li>
            </ul>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}

function SidePicker({ onPick, image }: { onPick: (s: Side) => void; image?: string }) {
  return (
    <div className="mt-10 max-w-xl">
      {image && (
        <div className="mb-6 mx-auto max-w-md overflow-hidden rounded-md border border-border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="block w-full object-contain"
            style={{ maxHeight: 240 }}
          />
        </div>
      )}
      <h2 className="text-2xl font-semibold tracking-tight">
        Choose the wrist
      </h2>
      <p className="mt-2 text-sm text-muted">
        Pick the wrist to move. Sit with that arm nearest the camera.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => onPick("left")}>Left wrist</Button>
        <Button onClick={() => onPick("right")}>Right wrist</Button>
      </div>
    </div>
  );
}
