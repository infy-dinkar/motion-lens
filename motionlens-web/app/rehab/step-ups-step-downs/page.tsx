"use client";
// K18 — Step-ups / Step-downs.
//
// Patient stands side-on to the camera beside a low step. Part 1 —
// STEP-UPS: step up with the chosen leg, stand tall, step down; PER_PART
// times. Part 2 — STEP-DOWNS: standing on the step on the chosen leg,
// lower the other foot to tap the floor and come back up; PER_PART
// times. Separate from the original Step-Up Control (K4), which is
// untouched.
//
// Signal: hip height as a share of the frame (computeHipMidY, lib/rehab/
// poseMetrics; up = higher) — so the body must really go up onto the
// step, not just bend a knee. Calibration: rest = on the floor, range =
// on the step. Counting: lib/rehab/bothEndsCounter — reaching both ends
// is one rep in either part (a step-down's heel tap drops the hip near
// the floor height). Reps only.

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
import { computeHipMidY } from "@/lib/rehab/poseMetrics";
import { bothEndsFrom, createBothEndsCounter } from "@/lib/rehab/bothEndsCounter";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "step-ups-step-downs";
const TITLE = "Step-ups / Step-downs";

type Side = "left" | "right";

/** Ends and the dead band (degrees). */
const ENDS = { zoneShare: 0.3, minSpan: 3, defaultHigh: 58, defaultLow: 50 };
/** Reps per part: step-ups, then step-downs. */
const PER_PART = 10;
const TARGET_REPS = PER_PART * 2;
const POINTS_PER_REP = 3;

export default function StepUpsStepDownsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [side, setSide] = useState<Side | null>(null);
  const [bar, setBar] = useState<number | null>(null);

  const [part, setPart] = useState<"up" | "down">("up");
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
  const counterRef = useRef(createBothEndsCounter(bothEndsFrom(null, null, ENDS), ENDS));
  /** Between the parts: after the last step-up the patient steps down to
   *  the floor ("floor"), then back up onto the step ("step"); the
   *  step-downs are counted from there. null = counting. */
  const awaitRef = useRef<null | "floor" | "step">(null);
  const countsRef = useRef({ reps: 0, attempts: 0 });
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);

  // Side-on and sided: calibration records the floor and step heights.
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
    // range = on the step, rest = on the floor.
    const summary = calibSummaryRef.current();
    endsRef.current = bothEndsFrom(summary?.range, summary?.rest, ENDS);
    counterRef.current = createBothEndsCounter(endsRef.current, ENDS);
    awaitRef.current = null;
    countsRef.current = { reps: 0, attempts: 0 };
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setCounts(countsRef.current);
    setBar(null);
    setPart("up");
  }, seq.countdownSec, calibration);
  const phaseRef = useRef(sessionPhase);
  phaseRef.current = sessionPhase;

  const handleFrame = useCallback(
    (kp: Keypoint[], video: HTMLVideoElement) => {
      const live = kp as unknown as LiveKeypoint[];
      calibration.feed(live, video);
      if (!side) return;
      const y = computeHipMidY(live);
      const h = video.videoHeight;
      if (y === null || !h) return;
      // Frame units ×100, up = higher (as the calibration's hip_mid_y_norm).
      const hipH = (1 - y / h) * 100;
      if (phaseRef.current !== "live") return;
      if (awaitRef.current !== null) {
        // Off the step and back onto it to start the step-downs is not a
        // rep: start a fresh count once the hip is back up at step height.
        const { high, low } = endsRef.current;
        const band = ENDS.zoneShare * (high - low);
        if (awaitRef.current === "floor") {
          if (hipH <= low + band) awaitRef.current = "step";
          return;
        }
        if (hipH < high - band) return;
        counterRef.current = createBothEndsCounter(endsRef.current, ENDS);
        awaitRef.current = null;
      }
      const counter = counterRef.current;
      const rep = counter.step(hipH);
      setBar(counter.fraction(hipH));
      if (rep) {
        const c = { ...countsRef.current };
        c.reps += 1;
        streakRef.current += 1;
        bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
        countsRef.current = c;
        setCounts(c);
        if (c.reps >= TARGET_REPS) markComplete();
        else if (c.reps === PER_PART) {
          setPart("down");
          awaitRef.current = "floor";
        }
      }
    },
    [side, markComplete],
  );

  const buildRehabPayload = useCallback(() => {
    if (!side) return null;
    const { reps } = countsRef.current;
    const score = {
      points: reps * POINTS_PER_REP,
      streak: streakRef.current,
      bestStreak: bestStreakRef.current,
    };
    const interpretation = reps > 0
      ? `${Math.min(reps, PER_PART)} of ${PER_PART} step-ups and ${Math.max(0, reps - PER_PART)} of ${PER_PART} step-downs (${side} leg).`
      : `No step-ups counted (${side} leg).`;
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
        mechanic_state: { reps, goodReps: reps, stepUps: Math.min(reps, PER_PART), stepDowns: Math.max(0, reps - PER_PART) },
        target_reps: TARGET_REPS,
        config: { ...ENDS, perPart: PER_PART },
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [side]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const sideWord = side === "left" ? "Left" : "Right";
  const holdPct = bar === null ? 50 : bar * 100;
  const holdHint = part === "up"
    ? (bar !== null && bar > 0.5 ? "Step back down" : "STEP-UPS: step up with the chosen leg, stand tall")
    : (bar !== null && bar > 0.5 ? "STEP-DOWNS: lower the other foot to tap the floor" : "Come back up onto the step");

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>K18 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Stand side-on to the camera beside a low step. First{" "}
                <strong>{PER_PART} step-ups</strong>: up with the chosen leg,
                stand tall, step down. Then <strong>{PER_PART} step-downs</strong>:
                on the step on the chosen leg, lower the other foot to tap
                the floor and come back up. Hold a rail if you need it.
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
              title={`${TITLE} · ${sideWord} leg`}
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} reps`}
              onExit={() => setSide(null)}
              camera={(
                <RehabCameraShell onFrame={handleFrame} autoStart hideControls>
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      {part === "up" ? "Step-ups" : "Step-downs"}
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {part === "up" ? counts.reps : counts.reps - PER_PART}
                    </p>
                    <p className="tabular text-[11px] text-zinc-300">
                      of {PER_PART}
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
                      {sideWord} leg
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
                      hint="On the floor beside the step."
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
                Camera at hip height, ~2.5–3 m away, <strong>side-on</strong>,
                and kept still — the hip height is read from the frame.
              </li>
              <li>
                Head to feet and the step in frame, on the floor and on the
                step.
              </li>
              <li>
                Calibration: on the floor — hold; on the step — hold. Live:
                {" "}{PER_PART} step-ups, then {PER_PART} step-downs; each
                down-and-up is one rep.
              </li>
              <li>Target: {PER_PART} + {PER_PART} reps with the chosen leg.</li>
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
        Choose the stepping leg
      </h2>
      <p className="mt-2 text-sm text-muted">
        Pick the leg that steps up (and stands on the step for the
        step-downs). Stand side-on to the camera.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => onPick("left")}>Left leg</Button>
        <Button onClick={() => onPick("right")}>Right leg</Button>
      </div>
    </div>
  );
}
