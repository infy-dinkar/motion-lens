"use client";
// K7 — Standing Hamstring Curl.
//
// Patient stands side-on, holding a chair or wall for balance, and
// curls the test-side heel toward the buttock, then lowers it. The
// thigh stays pointing down; only the knee bends.
//
// Mechanic: Rep-Count (lib/rehab/mechanics.ts repCountStep), same
// direction convention as the squats — the signal is the knee
// INTERIOR angle (180 − flexion), HIGH with the leg straight (the rep
// "top") and LOW with the knee curled (the rep "depth"). The knee
// helper is unsigned, so a heel curling BACKWARD reads the same as a
// knee bending forward.
//
// Reps only: the session saves the rep count (score + rep state) and
// the calibration, nothing else — no peak angle, no skeleton frame.
//
// NO biomech file modified — computeKneeAngle imported as-is.

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
import { computeKneeAngle } from "@/lib/biomech/knee-live";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { LM_LIVE } from "@/lib/pose/landmarks-live";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import type { RepCountState, Score } from "@/lib/rehab/gameState";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

type Side = "left" | "right";

const SLUG = "standing-hamstring-curl";
const TITLE = "Standing Hamstring Curl";

// Knee interior angle: ~175° standing straight, ~90° with the heel up
// behind. A rep = straight (≥ top) → curled (< depth) → straight.
const HAMSTRING_CURL_CONFIG = {
  // Leg back to straight.
  topThreshold: 160,
  // Knee curled to at least ~70° of flexion.
  depthThreshold: 110,
  // A real curl moves ~60–90°; under 40° is a knee wiggle, flagged shallow.
  minAmplitude: 40,
  maxJerk: null as number | null,
  pointsPerRep: 10,
};
const TARGET_REPS = 10;

export default function StandingHamstringCurlPage() {
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
  // Prescribed-session position, or an inert object on a normal
  // standalone visit.
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

  // Two short holds before the countdown: stand straight, then curl
  // the heel up. Recorded under metrics.calibration.
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
      const flexion = computeKneeAngle(
        "flexion_extension",
        kp as unknown as LiveKeypoint[],
        side,
      );
      if (flexion !== null) setInterior(180 - flexion);
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
      ? `${reps} of ${TARGET_REPS} standing hamstring curl rep${reps === 1 ? "" : "s"} completed (${side} leg).`
      : `No standing hamstring curl reps counted (${side} leg).`;
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
        config: HAMSTRING_CURL_CONFIG,
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
              <Badge>K7 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Stand side-on holding a chair for balance. Curl the
                heel of the test leg up toward the buttock, then lower
                it. Keep the thigh pointing down — only the knee bends.
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
              title={`${TITLE} · ${side === "left" ? "Left" : "Right"} leg`}
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} reps`}
              onExit={() => setSide(null)}
              camera={(
                <RehabCameraShell
                  onFrame={handleFrame}
                  autoStart
                  hideControls
                  angleArc={{
                    vertex: side === "left" ? LM_LIVE.LEFT_KNEE : LM_LIVE.RIGHT_KNEE,
                    armA: side === "left" ? LM_LIVE.LEFT_HIP : LM_LIVE.RIGHT_HIP,
                    armB: side === "left" ? LM_LIVE.LEFT_ANKLE : LM_LIVE.RIGHT_ANKLE,
                    currentDeg: interior,
                    band: {
                      min: HAMSTRING_CURL_CONFIG.depthThreshold,
                      max: HAMSTRING_CURL_CONFIG.topThreshold,
                    },
                  }}
                >
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      {side === "left" ? "L" : "R"} knee
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
                      {side === "left" ? "Left" : "Right"} leg
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
                      hint="Side-on to the camera, holding a chair, leg straight."
                    />
                  )}
                  {(sessionPhase === "live" || sessionPhase === "complete") && (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <RepCountShell
                        signal={interior}
                        signalLabel="Knee angle (°)"
                        signalDisplayName="knee_interior"
                        targetReps={TARGET_REPS}
                        config={HAMSTRING_CURL_CONFIG}
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
                Camera at hip height, ~2 m away, perpendicular to the
                body — <strong>lateral view</strong>.
              </li>
              <li>
                Patient stands side-on with the <strong>test leg nearest
                the camera</strong>, holding a chair or wall for balance.
                Test-side hip, knee and ankle must stay in frame.
              </li>
              <li>
                Curl the heel toward the buttock until the knee is bent
                past ~70° (angle below {HAMSTRING_CURL_CONFIG.depthThreshold}°),
                then lower until the leg is straight again (above{" "}
                {HAMSTRING_CURL_CONFIG.topThreshold}°). That is one rep.
              </li>
              <li>
                Keep the thigh pointing down and the trunk upright — the
                hip does not move.
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
        Choose the test leg
      </h2>
      <p className="mt-2 text-sm text-muted">
        Pick the leg that will curl. Stand with that leg nearest the
        camera.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => onPick("left")}>Left leg</Button>
        <Button onClick={() => onPick("right")}>Right leg</Button>
      </div>
    </div>
  );
}
