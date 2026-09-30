"use client";
// C3 — Cervical Flexion / Extension (AROM).
//
// Patient sits side-on to the camera, back still, and nods the chin
// down toward the chest (flexion), back to neutral, then tips the head
// back to look up (extension), back to neutral. Each movement either
// way and back is one rep. No side pick.
//
// Signal: head pitch from lib/biomech/neck-live —
// computeNeckAngle("flexion_extension"): the ear→nose line against
// horizontal, signed (positive = chin down / flexion, negative = head
// back / extension), the same for either facing direction. The
// neutral reading is captured as the session goes live, right after
// calibration and the countdown, and subtracted.
//
// Mechanic: Rep-Count on 180 − |pitch|, so neutral reads ~180 (the rep
// "top") and a nod either way reads low (the rep "depth").
//
// Reps only: saves the reps (plus how many were flexion / extension),
// the score, and the calibration.

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
import { computeNeckAngle } from "@/lib/biomech/neck-live";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import type { RepCountState, Score } from "@/lib/rehab/gameState";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "cervical-flexion-extension";
const TITLE = "Cervical Flexion / Extension";

// Engine signal = 180 − |pitch|. A rep = neutral (≥ top) → nodded
// either way (< depth) → neutral again.
const CERVICAL_FLEX_EXT_CONFIG = {
  // Back to neutral: within 8° of the neutral reading.
  topThreshold: 172,
  // At least 25° down or up.
  depthThreshold: 155,
  // Under 15° of movement is a small nod, flagged shallow.
  minAmplitude: 15,
  maxJerk: null as number | null,
  pointsPerRep: 8,
};
/** Reps in total, both sides together (5 each way). */
const TARGET_REPS = 10;

export default function CervicalFlexionExtensionPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [phase, setPhase] = useState<"ready" | "active">("ready");
  const [tilt, setTilt] = useState<number>(0);
  const [bySide, setBySide] = useState({ flexion: 0, extension: 0 });

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
  /** Neutral reference pitch; captured as the session goes live. */
  const baselineRef = useRef<number | null>(null);
  const needBaselineRef = useRef(true);
  const lastKpRef = useRef<LiveKeypoint[] | null>(null);
  /** Direction of the deepest nod in the rep in progress. */
  const repSideRef = useRef<{ side: "flexion" | "extension" | null; peak: number }>({ side: null, peak: 0 });
  const bySideRef = useRef({ flexion: 0, extension: 0 });
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
    bySideRef.current = { flexion: 0, extension: 0 };
    lastRepsRef.current = 0;
    setBySide({ flexion: 0, extension: 0 });
    // Patient looks straight ahead after the countdown: that is the zero.
    const kp = lastKpRef.current;
    baselineRef.current = kp ? computeNeckAngle("flexion_extension", kp) : null;
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
        baselineRef.current = computeNeckAngle("flexion_extension", live);
        needBaselineRef.current = baselineRef.current === null;
        return;
      }
      const base = baselineRef.current;
      if (base === null) return;
      const raw = computeNeckAngle("flexion_extension", live);
      if (raw === null) return;
      const t = raw - base;
      setTilt(t);
      // Remember which way the rep in progress nodded furthest.
      const mag = Math.abs(t);
      if (mag > repSideRef.current.peak) {
        // Positive = chin down (flexion), negative = head back (extension).
        repSideRef.current = { side: t >= 0 ? "flexion" : "extension", peak: mag };
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
    const { flexion, extension } = bySideRef.current;
    const interpretation = reps > 0
      ? `${reps} of ${TARGET_REPS} cervical flexion / extension reps (${flexion} flexion, ${extension} extension).`
      : "No cervical flexion / extension reps counted.";
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
        reps_by_direction: { flexion, extension },
        target_reps: TARGET_REPS,
        config: CERVICAL_FLEX_EXT_CONFIG,
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [phase]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const turnWord = Math.abs(tilt) < 4 ? "Neutral" : tilt > 0 ? "Flexion" : "Extension";

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>C3 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Sit side-on to the camera, back still. Nod your chin
                down toward your chest, back to neutral, then tip your
                head back to look up, back to neutral. Goal{" "}
                {TARGET_REPS} reps, both directions together.
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
                      Head · {turnWord}
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {Math.abs(tilt).toFixed(0)}°
                    </p>
                    <p className="tabular text-[11px] text-zinc-300">
                      Flex {bySide.flexion} · Ext {bySide.extension}
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
                      hint="Side-on to the camera, looking straight ahead."
                    />
                  )}
                  {(sessionPhase === "live" || sessionPhase === "complete") && (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <RepCountShell
                        signal={180 - Math.abs(tilt)}
                        signalLabel="Head (180° = neutral)"
                        targetReps={TARGET_REPS}
                        config={CERVICAL_FLEX_EXT_CONFIG}
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
                Camera at face height, ~1.5–2 m away, <strong>side-on
                to the patient</strong>.
              </li>
              <li>
                Patient sits upright side-on. Head, ear, nose and
                shoulders in frame, down to the hips. Hair clear of the
                ear.
              </li>
              <li>
                Look straight ahead as the countdown ends — that is the
                zero. Nod at least 25° down or up and back to neutral
                for a rep. Keep the back still — only the head moves.
              </li>
              <li>Target: {TARGET_REPS} reps, both directions together.</li>
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
        Sit side-on to the camera, looking straight ahead. Both
        directions are worked in one set, so there is no side to pick.
      </p>
      <div className="mt-6">
        <Button onClick={onStart}>Begin</Button>
      </div>
    </div>
  );
}
