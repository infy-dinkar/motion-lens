"use client";
// A1 — Heel Raises (calf raise).
//
// Patient stands side-on to the camera, holding a chair or wall, and
// rises onto the toes, then lowers. Both feet together — no side pick.
//
// Signal: foot pitch (computeHeelLiftDeg) — the heel→toe line's angle
// above horizontal, from the side. ~0–10° flat, higher with the heel
// up. It is measured against the patient's own flat-foot reading from
// calibration (hold 1), so camera height and foot shape drop out.
//
// Mechanic: Rep-Count, same convention as the squats: HIGH at the rep
// "top" (flat), LOW at "depth" (heel up). The engine is fed
// 180 − lift, so a flat foot reads ~180.
//
// Reps only: the session saves the rep count (score + rep state) and
// the calibration, nothing else.

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
import { computeHeelLiftDeg } from "@/lib/rehab/poseMetrics";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import type { RepCountState, Score } from "@/lib/rehab/gameState";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "heel-raises";
const TITLE = "Heel Raises";

// Engine signal = 180 − (heel lift above the patient's flat foot), so
// flat reads ~180. A rep = flat (≥ top) → heel up (< depth) → flat.
const HEEL_RAISE_CONFIG = {
  // Heel back down: within 4° of the flat-foot reading.
  topThreshold: 176,
  // Heel up: at least 10° of foot pitch above flat.
  depthThreshold: 170,
  // Under 7° of movement is a wobble, flagged shallow.
  minAmplitude: 7,
  maxJerk: null as number | null,
  pointsPerRep: 8,
};
const TARGET_REPS = 15;
/** EMA weight for the foot-pitch reading — foot landmarks jitter. */
const SMOOTH = 0.4;

export default function HeelRaisesPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [phase, setPhase] = useState<"ready" | "active">("ready");
  const [lift, setLift] = useState<number>(0);

  const { patient, isDoctorFlow } = usePatientContext();
  const seq = useRehabSequence();

  // Inside a prescribed session nothing needs tapping: the exercise
  // opens itself. Applied ONCE — exiting brings the gate back.
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
  /** Flat-foot pitch from calibration (hold 1); 0 when it was skipped. */
  const baselineRef = useRef<number>(0);
  const smoothRef = useRef<number | null>(null);

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
    // The patient's own flat foot is the zero for every rep.
    const rest = calibSummaryRef.current()?.rest;
    baselineRef.current = typeof rest === "number" ? rest : 0;
  }, seq.countdownSec, calibration);

  const handleFrame = useCallback(
    (kp: Keypoint[], video: HTMLVideoElement) => {
      calibration.feed(kp as unknown as LiveKeypoint[], video);
      if (phase !== "active") return;
      const pitch = computeHeelLiftDeg(kp as unknown as LiveKeypoint[]);
      if (pitch === null) return;
      const prev = smoothRef.current;
      const s = prev === null ? pitch : prev * (1 - SMOOTH) + pitch * SMOOTH;
      smoothRef.current = s;
      setLift(Math.max(0, s - baselineRef.current));
    },
    [phase],
  );

  const handleSnapshot = useCallback(
    (state: RepCountState, score: Score) => {
      snapshotRef.current = { state, score };
      if (state.reps >= TARGET_REPS) markComplete();
    },
    [markComplete],
  );

  // Reps only — the rep count, the score it earned, and calibration.
  const buildRehabPayload = useCallback(() => {
    if (phase !== "active") return null;
    const snap = snapshotRef.current;
    const state = snap?.state ?? null;
    const score = snap?.score ?? { points: 0, streak: 0, bestStreak: 0 };
    const reps = state?.reps ?? 0;
    const interpretation = reps > 0
      ? `${reps} of ${TARGET_REPS} heel raise rep${reps === 1 ? "" : "s"} completed.`
      : "No heel raise reps counted.";
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
        target_reps: TARGET_REPS,
        config: HEEL_RAISE_CONFIG,
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [phase]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>A1 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Stand side-on holding a chair for balance. Rise up onto
                your toes, then lower your heels back down. Both feet
                together. Goal {TARGET_REPS} reps.
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
                      Heel lift
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {lift.toFixed(0)}°
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
                      hint="Side-on to the camera, holding a chair, feet flat."
                    />
                  )}
                  {(sessionPhase === "live" || sessionPhase === "complete") && (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <RepCountShell
                        signal={180 - lift}
                        signalLabel="Heel (180° = flat)"
                        targetReps={TARGET_REPS}
                        config={HEEL_RAISE_CONFIG}
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
                Camera ~2 m away, <strong>side-on</strong> to the patient,
                placed low (knee height or below) so the feet are clear.
              </li>
              <li>
                Whole body in frame, especially both feet — heel and toes.
                Hold a chair or wall for balance.
              </li>
              <li>
                Rise onto the toes until the heel is well off the floor,
                then lower until the heel touches down. That is one rep.
              </li>
              <li>Target: {TARGET_REPS} reps.</li>
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
        Stand side-on to the camera, holding a chair, feet flat. Both
        feet work together, so there is no side to pick.
      </p>
      <div className="mt-6">
        <Button onClick={onStart}>Begin</Button>
      </div>
    </div>
  );
}
