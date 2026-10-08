"use client";
// C7 — Gaze Stability (head turns with the eyes fixed).
//
// Patient sits facing the camera, eyes on a target at eye level, and
// turns the head left and right while keeping the eyes on the target.
// Each turn to a side and back is one count; TARGET_REPS turns = half
// left, half right. No side pick.
//
// Signal and counting as cervical rotation (C1), with smaller turns
// (at least 25°). Where the eyes look is not seen. Reps only.

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
import {
  captureNeckRotationBaseline,
  computeNeckRotationFromBaseline,
  type NeckRotationCalibration,
} from "@/lib/biomech/neck-live";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import type { RepCountState, Score } from "@/lib/rehab/gameState";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "gaze-stability";
const TITLE = "Gaze Stability";

// Engine signal = 180 − |rotation|. A rep = facing forward (≥ top) →
// turned (< depth) → forward again.
const CERVICAL_ROTATION_CONFIG = {
  // Back to facing forward: within 10° of centre.
  topThreshold: 170,
  // Turned at least 25° to either side.
  depthThreshold: 155,
  // Under 15° of movement is a glance, flagged shallow.
  minAmplitude: 15,
  maxJerk: null as number | null,
  pointsPerRep: 8,
};
/** Head turns in total: 10 left-right pairs. */
const TARGET_REPS = 20;

export default function GazeStabilityPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [phase, setPhase] = useState<"ready" | "active">("ready");
  const [rotation, setRotation] = useState<number>(0);
  const [bySide, setBySide] = useState({ left: 0, right: 0 });

  const { patient, isDoctorFlow } = usePatientContext();
  const seq = useRehabSequence();

  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (seq.inSequence && !autoStarted) {
      setAutoStarted(true);
      setPhase("active");
    }
  }, [seq.inSequence, autoStarted]);

  const sessionStartRef = useRef<number>(performance.now());
  const snapshotRef = useRef<{ state: RepCountState; score: Score } | null>(
    null,
  );
  /** Facing-forward reference; captured as the session goes live. */
  const baselineRef = useRef<NeckRotationCalibration | null>(null);
  const needBaselineRef = useRef(true);
  const lastKpRef = useRef<LiveKeypoint[] | null>(null);
  /** Side of the deepest turn in the rep in progress. */
  const repSideRef = useRef<{ side: "left" | "right" | null; peak: number }>({ side: null, peak: 0 });
  const bySideRef = useRef({ left: 0, right: 0 });
  const lastRepsRef = useRef(0);

  const calibration = useRehabCalibration(SLUG, null, phase === "active");
  const calibSummaryRef = useRef(calibration.summary);
  calibSummaryRef.current = calibration.summary;

  const {
    phase: sessionPhase,
    countdown,
    skipCountdown,
    markComplete,
  } = useRehabAutoFlow(phase === "active", () => {
    snapshotRef.current = null;
    sessionStartRef.current = performance.now();
    repSideRef.current = { side: null, peak: 0 };
    bySideRef.current = { left: 0, right: 0 };
    lastRepsRef.current = 0;
    setBySide({ left: 0, right: 0 });
    // Patient faces forward after the countdown: that is the zero.
    const kp = lastKpRef.current;
    baselineRef.current = kp ? captureNeckRotationBaseline(kp) : null;
    needBaselineRef.current = baselineRef.current === null;
  }, seq.countdownSec, calibration);
  const phaseRef = useRef(sessionPhase);
  phaseRef.current = sessionPhase;

  const handleFrame = useCallback(
    (kp: Keypoint[], video: HTMLVideoElement) => {
      const live = kp as unknown as LiveKeypoint[];
      calibration.feed(live, video);
      if (phase !== "active") return;
      lastKpRef.current = live;
      if (phaseRef.current !== "live") return;
      if (needBaselineRef.current) {
        baselineRef.current = captureNeckRotationBaseline(live);
        needBaselineRef.current = baselineRef.current === null;
        return;
      }
      const base = baselineRef.current;
      if (!base) return;
      const rot = computeNeckRotationFromBaseline(live, base);
      if (rot === null) return;
      setRotation(rot);
      // Remember which way the rep in progress turned furthest.
      const mag = Math.abs(rot);
      if (mag > repSideRef.current.peak) {
        // Raw (unmirrored) frame: the nose moving to image-left reads
        // negative, and image-left is the patient's right.
        repSideRef.current = { side: rot < 0 ? "right" : "left", peak: mag };
      }
    },
    [phase],
  );

  const handleSnapshot = useCallback(
    (state: RepCountState, score: Score) => {
      snapshotRef.current = { state, score };
      if (state.reps > lastRepsRef.current) {
        const s = repSideRef.current.side;
        if (s) {
          bySideRef.current = { ...bySideRef.current, [s]: bySideRef.current[s] + 1 };
          setBySide(bySideRef.current);
        }
        repSideRef.current = { side: null, peak: 0 };
        lastRepsRef.current = state.reps;
      }
      if (state.reps >= TARGET_REPS) markComplete();
    },
    [markComplete],
  );

  const buildRehabPayload = useCallback(() => {
    if (phase !== "active") return null;
    const snap = snapshotRef.current;
    const state = snap?.state ?? null;
    const score = snap?.score ?? { points: 0, streak: 0, bestStreak: 0 };
    const reps = state?.reps ?? 0;
    const { left, right } = bySideRef.current;
    const interpretation = reps > 0
      ? `${reps} of ${TARGET_REPS} gaze-stability head turns (${left} left, ${right} right).`
      : "No gaze-stability head turns counted.";
    return {
      module: "rehab" as const,
      movement: SLUG,
      metrics: {
        calibration: calibSummaryRef.current(),
        exercise_slug: SLUG,
        mechanic_id: "rep_count",
        started_at_ms: sessionStartRef.current,
        duration_sec: elapsedSecondsSince(sessionStartRef.current),
        score,
        mechanic_state: state,
        reps_by_side: { left, right },
        target_reps: TARGET_REPS,
        config: CERVICAL_ROTATION_CONFIG,
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [phase]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const turnWord = Math.abs(rotation) < 5 ? "Centre" : rotation < 0 ? "Right" : "Left";

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>C7 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Sit facing the camera with a target (a sticker or a card) at
                eye level just above it. Keep your eyes on the target and
                turn your head left and right, smoothly. Goal{" "}
                {TARGET_REPS} turns (10 each way pair).
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

          {phase === "ready" && (autoStarted || !seq.inSequence) ? (
            <ReadyGate onStart={() => setPhase("active")} image={image} />
          ) : null}

          {phase === "active" && (
            <LiveModeLayout
              title={TITLE}
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} reps`}
              onExit={() => setPhase("ready")}
              camera={(
                <RehabCameraShell onFrame={handleFrame} autoStart hideControls>
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      Head turn · {turnWord}
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {Math.abs(rotation).toFixed(0)}°
                    </p>
                    <p className="tabular text-[11px] text-zinc-300">
                      L {bySide.left} · R {bySide.right}
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
                      hint="Face the camera and look straight ahead."
                    />
                  )}
                  {(sessionPhase === "live" || sessionPhase === "complete") && (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <RepCountShell
                        signal={180 - Math.abs(rotation)}
                        signalLabel="Head (180° = facing forward)"
                        targetReps={TARGET_REPS}
                        config={CERVICAL_ROTATION_CONFIG}
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
                Camera at face height, ~1.5–2 m away, <strong>facing
                the patient</strong>.
              </li>
              <li>
                Patient sits upright facing the camera. Head, both ears
                and both shoulders in frame. Hair clear of the ears.
              </li>
              <li>
                Look at the target as the countdown ends — that is the zero.
                Turn at least 25° to a side and back for a count, eyes on
                the target. Where the eyes look is not seen.
              </li>
              <li>Target: {TARGET_REPS} turns, both sides together.</li>
            </ul>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}

function ReadyGate({ onStart, image }: { onStart: () => void; image?: string }) {
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
        Ready when you are
      </h2>
      <p className="mt-2 text-sm text-muted">
        Sit facing the camera, eyes on a target at eye level. Both sides
        are worked in one set, so there is no side to pick.
      </p>
      <div className="mt-6">
        <Button onClick={onStart}>Begin</Button>
      </div>
    </div>
  );
}
