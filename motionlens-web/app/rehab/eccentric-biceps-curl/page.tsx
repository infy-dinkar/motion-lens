"use client";
// S7 — Eccentric Biceps Curl.
//
// Patient sits or stands side-on, test arm nearest the camera, upper
// arm by the side (a light weight or a water bottle is optional).
// Bends the elbow to bring the hand up, then LOWERS IT SLOWLY until the
// arm is straight. The slow lowering is the exercise.
//
// Signal: the elbow interior angle (shoulder–elbow–wrist), same as
// Elbow AROM. HIGH with the arm straight, LOW with the elbow bent.
//
// Tempo: a rep counts only when the lowering — from leaving the bent
// position (angle rising past depth) to reaching straight (past top) —
// takes at least MIN_LOWER_SEC. The shared rep engine has no tempo
// rule, so the page times each lowering itself; the engine's own count
// is kept as "attempted".
//
// Reps only: saves the slow reps (as mechanic_state.reps), the
// attempted reps, the score, and the calibration.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RehabCameraShell } from "@/components/rehab/mechanics/RehabCameraShell";
import { RepCountShell } from "@/components/rehab/mechanics/RepCountShell";
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
import { computeElbowInteriorDeg } from "@/lib/rehab/poseMetrics";
import { createLoweringTimer } from "@/lib/rehab/loweringTimer";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { LM_LIVE } from "@/lib/pose/landmarks-live";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import type { RepCountState, Score } from "@/lib/rehab/gameState";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

type Side = "left" | "right";

const SLUG = "eccentric-biceps-curl";
const TITLE = "Eccentric Biceps Curl";

const ECCENTRIC_CURL_CONFIG = {
  // Arm back to (near) straight.
  topThreshold: 150,
  // Elbow bent past a right angle.
  depthThreshold: 90,
  minAmplitude: 50,
  maxJerk: null as number | null,
  pointsPerRep: 10,
};
const TARGET_REPS = 10;
/** The lowering must take at least this long for the rep to count. */
const MIN_LOWER_SEC = 2;

type Tempo = { kind: "idle" } | { kind: "slow"; sec: number } | { kind: "fast"; sec: number };

export default function EccentricBicepsCurlPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [side, setSide] = useState<Side | null>(null);
  const [interior, setInterior] = useState<number>(180);
  const [slowReps, setSlowReps] = useState(0);
  const [tempo, setTempo] = useState<Tempo>({ kind: "idle" });

  const { patient, isDoctorFlow } = usePatientContext();
  const seq = useRehabSequence();

  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (seq.side && !autoStarted) {
      setAutoStarted(true);
      setSide(seq.side);
    }
  }, [seq.side, autoStarted]);

  const sessionStartRef = useRef<number>(performance.now());
  const snapshotRef = useRef<{ state: RepCountState; score: Score } | null>(
    null,
  );
  // Times each lowering: from leaving the bent position (angle rising
  // past depth) to reaching straight (past top).
  const lowerRef = useRef(createLoweringTimer({
    top: ECCENTRIC_CURL_CONFIG.topThreshold,
    depth: ECCENTRIC_CURL_CONFIG.depthThreshold,
    minSec: MIN_LOWER_SEC,
    direction: "up",
  }));
  const slowRepsRef = useRef(0);

  const resetTempo = useCallback(() => {
    lowerRef.current.reset();
    slowRepsRef.current = 0;
    setSlowReps(0);
    setTempo({ kind: "idle" });
  }, []);

  useEffect(() => {
    snapshotRef.current = null;
    resetTempo();
    if (side !== null) sessionStartRef.current = performance.now();
  }, [side, resetTempo]);

  const calibration = useRehabCalibration(SLUG, side, side !== null);

  const {
    phase: sessionPhase,
    countdown,
    skipCountdown,
    markComplete,
  } = useRehabAutoFlow(side !== null, () => {
    snapshotRef.current = null;
    resetTempo();
    sessionStartRef.current = performance.now();
  }, seq.countdownSec, calibration);
  const calibSummaryRef = useRef(calibration.summary);
  calibSummaryRef.current = calibration.summary;
  const phaseRef = useRef(sessionPhase);
  phaseRef.current = sessionPhase;

  const handleFrame = useCallback(
    (kp: Keypoint[], video: HTMLVideoElement) => {
      calibration.feed(kp as unknown as LiveKeypoint[], video);
      if (!side) return;
      const angle = computeElbowInteriorDeg(kp as unknown as LiveKeypoint[], side);
      if (angle === null) return;
      setInterior(angle);
      if (phaseRef.current !== "live") return;

      const done = lowerRef.current.step(angle, performance.now());
      if (done) {
        if (done.slow) {
          slowRepsRef.current += 1;
          setSlowReps(slowRepsRef.current);
          setTempo({ kind: "slow", sec: done.sec });
          if (slowRepsRef.current >= TARGET_REPS) markComplete();
        } else {
          setTempo({ kind: "fast", sec: done.sec });
        }
      }
    },
    [side, markComplete],
  );

  const handleSnapshot = useCallback(
    (state: RepCountState, score: Score) => {
      snapshotRef.current = { state, score };
    },
    [],
  );

  // Reps only: the slow reps are the reps; attempted reps kept beside.
  const buildRehabPayload = useCallback(() => {
    if (!side) return null;
    const snap = snapshotRef.current;
    const state = snap?.state ?? null;
    const score = snap?.score ?? { points: 0, streak: 0, bestStreak: 0 };
    const slow = slowRepsRef.current;
    const attempted = state?.reps ?? 0;
    const interpretation = slow > 0
      ? `${slow} of ${TARGET_REPS} slow eccentric curl rep${slow === 1 ? "" : "s"} (${side} arm)`
        + (attempted > slow ? `; ${attempted - slow} lowered too fast.` : ".")
      : `No slow eccentric curl reps counted (${side} arm).`;
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
        mechanic_state: state
          ? { ...state, reps: slow, goodReps: Math.min(state.goodReps, slow) }
          : null,
        eccentric: { attempted_reps: attempted, min_lower_sec: MIN_LOWER_SEC },
        target_reps: TARGET_REPS,
        config: ECCENTRIC_CURL_CONFIG,
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [side]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>S7 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Sit side-on, test arm nearest the camera, upper arm by
                your side. Bend the elbow to bring your hand up, then
                lower it slowly — at least {MIN_LOWER_SEC} seconds — until
                the arm is straight. Goal {TARGET_REPS} slow reps.
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
              title={`${TITLE} · ${side === "left" ? "Left" : "Right"} arm`}
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} slow reps`}
              onExit={() => setSide(null)}
              camera={(
                <RehabCameraShell
                  onFrame={handleFrame}
                  autoStart
                  hideControls
                  angleArc={{
                    vertex: side === "left" ? LM_LIVE.LEFT_ELBOW : LM_LIVE.RIGHT_ELBOW,
                    armA: side === "left" ? LM_LIVE.LEFT_SHOULDER : LM_LIVE.RIGHT_SHOULDER,
                    armB: side === "left" ? LM_LIVE.LEFT_WRIST : LM_LIVE.RIGHT_WRIST,
                    currentDeg: interior,
                    band: {
                      min: ECCENTRIC_CURL_CONFIG.depthThreshold,
                      max: ECCENTRIC_CURL_CONFIG.topThreshold,
                    },
                  }}
                >
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      Slow reps
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {slowReps} / {TARGET_REPS}
                    </p>
                    {tempo.kind !== "idle" && (
                      <p className={`mt-0.5 text-[11px] font-semibold ${tempo.kind === "slow" ? "text-emerald-300" : "text-amber-300"}`}>
                        {tempo.kind === "slow"
                          ? `Good — ${tempo.sec.toFixed(1)} s`
                          : `Lower slowly — ${tempo.sec.toFixed(1)} s`}
                      </p>
                    )}
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
                      {side === "left" ? "Left" : "Right"} arm
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
                      hint="Side-on to the camera, arm straight down by your side."
                    />
                  )}
                  {(sessionPhase === "live" || sessionPhase === "complete") && (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <p className="mb-2 text-xs text-muted">
                        Attempted reps below; only reps lowered over{" "}
                        {MIN_LOWER_SEC} s count toward the goal.
                      </p>
                      <RepCountShell
                        signal={interior}
                        signalLabel="Elbow angle (°)"
                        config={ECCENTRIC_CURL_CONFIG}
                        onSnapshot={handleSnapshot}
                        compact
                      />
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
                Camera at shoulder height, ~2 m away, perpendicular to
                the body — <strong>lateral view</strong>.
              </li>
              <li>
                Patient sits or stands side-on with the <strong>test arm
                nearest the camera</strong>. Shoulder, elbow and wrist
                must stay in frame. A light weight is optional.
              </li>
              <li>
                Bend the elbow past a right angle, then lower the hand
                slowly until the arm is straight — the lowering must take
                at least {MIN_LOWER_SEC} seconds for the rep to count.
              </li>
              <li>
                Keep the upper arm by your side — the shoulder does not
                lift.
              </li>
              <li>Target: {TARGET_REPS} slow reps.</li>
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
        Choose the test arm
      </h2>
      <p className="mt-2 text-sm text-muted">
        Pick the arm that will move. Sit with that arm nearest the
        camera.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => onPick("left")}>Left arm</Button>
        <Button onClick={() => onPick("right")}>Right arm</Button>
      </div>
    </div>
  );
}
