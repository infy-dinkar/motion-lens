"use client";
// C4 — Upper Trapezius & Levator Scapulae Stretch.
//
// Patient sits facing the camera, shoulders level and still, and tilts
// the head to bring one ear toward that shoulder, holding the stretch
// (felt on the OPPOSITE side of the neck) for HOLD_SEC, then returns to
// upright and stretches the other side. No side pick: both sides are
// worked in one set.
//
// Signal: same as cervical-side-flexion — computeNeckAngle
// ("lateral_flexion") minus the upright reading captured as the session
// goes live. Negative = tilt toward the patient's right, which
// stretches the LEFT side of the neck.
//
// Mechanic: lib/rehab/stretchHold — a rep is one stretch held for
// HOLD_SEC. A hold that sags back toward upright for more than a
// second is broken and only counted as an attempt.
//
// Reps only: saves the held stretches (as reps, plus per side), the
// broken attempts, the score, and the calibration.

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
import { computeNeckAngle } from "@/lib/biomech/neck-live";
import { createStretchHold } from "@/lib/rehab/stretchHold";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "upper-trap-levator-stretch";
const TITLE = "Upper Trapezius & Levator Stretch";

// Same tilt reading as cervical-side-flexion (its depth line is 18°).
const TRAP_STRETCH_CONFIG = {
  /** Tilt that starts the hold. */
  enter: 18,
  /** The hold may sag to here without breaking. */
  breakAt: 13,
  /** Back within 7° of upright before the next stretch. */
  release: 7,
  holdSec: 20,
  graceMs: 1000,
};
/** Held stretches in total: 3 each side. */
const TARGET_REPS = 6;
const POINTS_PER_HOLD = 10;

type Side = "left" | "right";

export default function UpperTrapLevatorStretchPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [phase, setPhase] = useState<"ready" | "active">("ready");
  const [tilt, setTilt] = useState<number>(0);
  const [held, setHeld] = useState(0);
  const [holdPhase, setHoldPhase] = useState<"rest" | "holding" | "done">("rest");
  const [counts, setCounts] = useState({ reps: 0, attempts: 0, left: 0, right: 0 });

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
  /** Upright reference tilt; captured as the session goes live. */
  const baselineRef = useRef<number | null>(null);
  const needBaselineRef = useRef(true);
  const lastKpRef = useRef<LiveKeypoint[] | null>(null);
  const timerRef = useRef(createStretchHold(TRAP_STRETCH_CONFIG));
  /** Side being stretched in the hold in progress. */
  const holdSideRef = useRef<Side | null>(null);
  const countsRef = useRef({ reps: 0, attempts: 0, left: 0, right: 0 });
  const bestStreakRef = useRef(0);
  const streakRef = useRef(0);

  const calibration = useRehabCalibration(SLUG, null, phase === "active");
  const calibSummaryRef = useRef(calibration.summary);
  calibSummaryRef.current = calibration.summary;

  const {
    phase: sessionPhase,
    countdown,
    skipCountdown,
    markComplete,
  } = useRehabAutoFlow(phase === "active", () => {
    sessionStartRef.current = performance.now();
    timerRef.current.reset();
    holdSideRef.current = null;
    countsRef.current = { reps: 0, attempts: 0, left: 0, right: 0 };
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setCounts(countsRef.current);
    setHeld(0);
    setHoldPhase("rest");
    // Patient sits upright after the countdown: that is the zero.
    const kp = lastKpRef.current;
    baselineRef.current = kp ? computeNeckAngle("lateral_flexion", kp) : null;
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
        baselineRef.current = computeNeckAngle("lateral_flexion", live);
        needBaselineRef.current = baselineRef.current === null;
        return;
      }
      const base = baselineRef.current;
      if (base === null) return;
      const raw = computeNeckAngle("lateral_flexion", live);
      if (raw === null) return;
      const t = raw - base;
      const now = performance.now();
      const timer = timerRef.current;
      const wasRest = timer.phase() === "rest";
      const ev = timer.step(Math.abs(t), now);
      // Tilt toward the patient's right (negative) stretches the left.
      if (wasRest && timer.phase() === "holding") {
        holdSideRef.current = t < 0 ? "left" : "right";
      }
      if (ev) {
        const c = { ...countsRef.current };
        if (ev.type === "rep") {
          c.reps += 1;
          const s = holdSideRef.current;
          if (s) c[s] += 1;
          streakRef.current += 1;
          bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
        } else {
          c.attempts += 1;
          streakRef.current = 0;
        }
        countsRef.current = c;
        setCounts(c);
        if (c.reps >= TARGET_REPS) markComplete();
      }
      setTilt(t);
      setHeld(timer.heldSec(now));
      setHoldPhase(timer.phase());
    },
    [phase, markComplete],
  );

  const buildRehabPayload = useCallback(() => {
    if (phase !== "active") return null;
    const { reps, attempts, left, right } = countsRef.current;
    const score = {
      points: reps * POINTS_PER_HOLD,
      streak: streakRef.current,
      bestStreak: bestStreakRef.current,
    };
    const interpretation = reps > 0
      ? `${reps} of ${TARGET_REPS} stretches held ${TRAP_STRETCH_CONFIG.holdSec} s (${left} left side, ${right} right side).`
      : "No stretch held long enough to count.";
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
        // Held stretches are the reps; every counted one is a good one.
        mechanic_state: { reps, goodReps: reps, brokenHolds: attempts },
        reps_by_side: { left, right },
        target_reps: TARGET_REPS,
        hold_sec: TRAP_STRETCH_CONFIG.holdSec,
        config: TRAP_STRETCH_CONFIG,
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [phase]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const tiltWord = Math.abs(tilt) < 4 ? "Upright" : tilt < 0 ? "Right" : "Left";
  const holdPct = Math.min(100, (held / TRAP_STRETCH_CONFIG.holdSec) * 100);
  const holdHint =
    holdPhase === "holding"
      ? `Hold… ${Math.max(0, TRAP_STRETCH_CONFIG.holdSec - held).toFixed(0)} s`
      : holdPhase === "done"
        ? "Done — come back to upright"
        : "Tilt your ear toward your shoulder";

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>C4 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Sit facing the camera, shoulders level and still. Tilt
                your ear toward one shoulder until you feel the stretch
                on the other side of your neck, and hold for{" "}
                {TRAP_STRETCH_CONFIG.holdSec} seconds. Back to upright,
                then the other side. Goal {TARGET_REPS} holds, both sides
                together.
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
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} holds`}
              onExit={() => setPhase("ready")}
              camera={(
                <RehabCameraShell onFrame={handleFrame} autoStart hideControls>
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      Head tilt · {tiltWord}
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {Math.abs(tilt).toFixed(0)}°
                    </p>
                    <p className="tabular text-[11px] text-zinc-300">
                      L {counts.left} · R {counts.right}
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
                      hint="Face the camera, head upright, shoulders level."
                    />
                  )}
                  {(sessionPhase === "live" || sessionPhase === "complete") && (
                    <div className="rounded-card border border-border bg-surface p-4">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                        Stretches held
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
                      <p className="tabular mt-3 text-xs text-muted">
                        Left side {counts.left} · Right side {counts.right}
                        {counts.attempts > 0 && ` · ${counts.attempts} let go early`}
                      </p>
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
                Sit upright as the countdown ends — that is the zero.
                Tilt the ear toward the shoulder and hold{" "}
                {TRAP_STRETCH_CONFIG.holdSec} s. Keep the shoulders level
                — the shoulder on the stretched side stays down.
              </li>
              <li>Target: {TARGET_REPS} holds, both sides together.</li>
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
        Sit facing the camera, shoulders level. Both sides are stretched
        in one set, so there is no side to pick.
      </p>
      <div className="mt-6">
        <Button onClick={onStart}>Begin</Button>
      </div>
    </div>
  );
}
