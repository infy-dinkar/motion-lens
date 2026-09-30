"use client";
// E1 — Elbow AROM (flexion–extension).
//
// Patient sits (or stands) side-on, test arm nearest the camera, upper
// arm hanging by the side. Bends the elbow, bringing the hand toward
// the shoulder, then straightens it fully. The upper arm stays down;
// only the elbow moves.
//
// Mechanic: Rep-Count, same direction convention as the squats — the
// signal is the elbow INTERIOR angle (shoulder–elbow–wrist): HIGH with
// the arm straight (the rep "top"), LOW with the elbow bent ("depth").
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
import { computeElbowInteriorDeg } from "@/lib/rehab/poseMetrics";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { LM_LIVE } from "@/lib/pose/landmarks-live";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import type { RepCountState, Score } from "@/lib/rehab/gameState";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

type Side = "left" | "right";

const SLUG = "elbow-arom";
const TITLE = "Elbow AROM";

// Elbow interior angle: ~170–180° with the arm straight, ~40–50° fully
// bent. A rep = straight (≥ top) → bent (< depth) → straight.
const ELBOW_AROM_CONFIG = {
  // Arm back to (near) straight.
  topThreshold: 150,
  // Elbow bent past a right angle.
  depthThreshold: 90,
  // A real rep moves 80°+; under 50° is flagged shallow.
  minAmplitude: 50,
  maxJerk: null as number | null,
  pointsPerRep: 10,
};
const TARGET_REPS = 10;

export default function ElbowAromPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [side, setSide] = useState<Side | null>(null);
  const [interior, setInterior] = useState<number>(180);

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
  const snapshotRef = useRef<{ state: RepCountState; score: Score } | null>(
    null,
  );

  useEffect(() => {
    snapshotRef.current = null;
    if (side !== null) sessionStartRef.current = performance.now();
  }, [side]);

  // Two short holds before the countdown: arm straight, then elbow
  // bent. Recorded under metrics.calibration.
  const calibration = useRehabCalibration(SLUG, side, side !== null);

  const {
    phase: sessionPhase,
    countdown,
    skipCountdown,
    markComplete,
  } = useRehabAutoFlow(side !== null, () => {
    snapshotRef.current = null;
    sessionStartRef.current = performance.now();
  }, seq.countdownSec, calibration);
  const calibSummaryRef = useRef(calibration.summary);
  calibSummaryRef.current = calibration.summary;

  const handleFrame = useCallback(
    (kp: Keypoint[], video: HTMLVideoElement) => {
      calibration.feed(kp as unknown as LiveKeypoint[], video);
      if (!side) return;
      const angle = computeElbowInteriorDeg(kp as unknown as LiveKeypoint[], side);
      if (angle !== null) setInterior(angle);
    },
    [side],
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
    if (!side) return null;
    const snap = snapshotRef.current;
    const state = snap?.state ?? null;
    const score = snap?.score ?? { points: 0, streak: 0, bestStreak: 0 };
    const reps = state?.reps ?? 0;
    const interpretation = reps > 0
      ? `${reps} of ${TARGET_REPS} elbow flexion–extension rep${reps === 1 ? "" : "s"} completed (${side} arm).`
      : `No elbow flexion–extension reps counted (${side} arm).`;
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
        mechanic_state: state,
        target_reps: TARGET_REPS,
        config: ELBOW_AROM_CONFIG,
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
              <Badge>E1 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Sit side-on, test arm nearest the camera, upper arm by
                your side. Bend the elbow to bring your hand toward your
                shoulder, then straighten it fully. Only the elbow moves.
                Goal {TARGET_REPS} reps.
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
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} reps`}
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
                      min: ELBOW_AROM_CONFIG.depthThreshold,
                      max: ELBOW_AROM_CONFIG.topThreshold,
                    },
                  }}
                >
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      {side === "left" ? "L" : "R"} elbow
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {interior.toFixed(0)}°
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
                      <RepCountShell
                        signal={interior}
                        signalLabel="Elbow angle (°)"
                        targetReps={TARGET_REPS}
                        config={ELBOW_AROM_CONFIG}
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
                must stay in frame.
              </li>
              <li>
                Bend the elbow until it is past a right angle (angle
                below {ELBOW_AROM_CONFIG.depthThreshold}°), then
                straighten until the arm is straight again (above{" "}
                {ELBOW_AROM_CONFIG.topThreshold}°). That is one rep.
              </li>
              <li>
                Keep the upper arm by your side — the shoulder does not
                lift.
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
