"use client";
// C5 — Self-SNAG, cervical rotation (towel).
//
// Patient sits facing the camera with a towel round the back of the
// neck, one end in each hand. Turning the head toward the picked side,
// the hand on the other side pulls its end forward to glide the neck;
// the end-range turn is held HOLD_SEC, then the head comes back to
// centre. Worked one side at a time: the side is the direction of the
// turn (usually the stiff or painful one).
//
// Signal: computeNeckRotationFromBaseline (same as cervical-rotation),
// facing-forward baseline captured as the session goes live. Negative
// = toward the patient's right (raw frame); only the turn toward the
// picked side counts.
//
// Mechanic: lib/rehab/stretchHold — a rep is a turn of at least
// `enter`° held HOLD_SEC, then back to centre. A turn let go before the
// hold ends is only an attempt.
//
// Reps only: saves the reps, the early let-gos, the score, and the
// calibration.

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
import {
  captureNeckRotationBaseline,
  computeNeckRotationFromBaseline,
  type NeckRotationCalibration,
} from "@/lib/biomech/neck-live";
import { createStretchHold } from "@/lib/rehab/stretchHold";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "self-snag";
const TITLE = "Self-SNAG (Towel)";

type Side = "left" | "right";

// Same rotation reading as cervical-rotation (its depth line is 40°).
const SNAG_CONFIG = {
  /** Turn that starts the end-range hold. */
  enter: 40,
  /** The hold may ease back to here without breaking. */
  breakAt: 32,
  /** Back within 10° of centre before the next turn. */
  release: 10,
  holdSec: 3,
  graceMs: 500,
};
const TARGET_REPS = 6;
const POINTS_PER_REP = 8;

export default function SelfSnagPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [side, setSide] = useState<Side | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [held, setHeld] = useState(0);
  const [holdPhase, setHoldPhase] = useState<"rest" | "holding" | "done">("rest");
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
  /** Facing-forward reference; captured as the session goes live. */
  const baselineRef = useRef<NeckRotationCalibration | null>(null);
  const needBaselineRef = useRef(true);
  const lastKpRef = useRef<LiveKeypoint[] | null>(null);
  const timerRef = useRef(createStretchHold(SNAG_CONFIG));
  const countsRef = useRef({ reps: 0, attempts: 0 });
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);

  // The calibration signal is the unsigned rotation; the side goes in
  // so the self-snag pose gate can block a turn the wrong way.
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
    timerRef.current.reset();
    countsRef.current = { reps: 0, attempts: 0 };
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setCounts(countsRef.current);
    setHeld(0);
    setHoldPhase("rest");
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
      if (!side) return;
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
      // Raw (unmirrored) frame: a turn to the patient's right reads
      // negative. Only the picked side counts.
      const toward = side === "right" ? -rot : rot;
      const now = performance.now();
      const timer = timerRef.current;
      const ev = timer.step(Math.max(0, toward), now);
      if (ev) {
        const c = { ...countsRef.current };
        if (ev.type === "rep") {
          c.reps += 1;
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
      setRotation(rot);
      setHeld(timer.heldSec(now));
      setHoldPhase(timer.phase());
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
      ? `${reps} of ${TARGET_REPS} self-SNAG turns to the ${side}, each held ${SNAG_CONFIG.holdSec} s.`
      : `No self-SNAG turns to the ${side} counted.`;
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
        mechanic_state: { reps, goodReps: reps, brokenHolds: attempts },
        target_reps: TARGET_REPS,
        hold_sec: SNAG_CONFIG.holdSec,
        config: SNAG_CONFIG,
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [side]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const sideWord = side === "left" ? "Left" : "Right";
  const toward = side === "right" ? -rotation : rotation;
  const holdPct = Math.min(100, (held / SNAG_CONFIG.holdSec) * 100);
  const holdHint =
    holdPhase === "holding"
      ? `Hold… ${Math.max(0, SNAG_CONFIG.holdSec - held).toFixed(0)} s`
      : holdPhase === "done"
        ? "Good — back to centre"
        : `Turn your head to the ${side ?? ""}`;

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>C5 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Sit facing the camera with a towel round the back of your
                neck, one end in each hand. Turn your head to the chosen
                side while the other hand pulls its end of the towel
                forward. Hold the turn {SNAG_CONFIG.holdSec} seconds, then
                back to centre. Goal {TARGET_REPS} reps.
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
              title={`${TITLE} · Turn ${sideWord}`}
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} reps`}
              onExit={() => setSide(null)}
              camera={(
                <RehabCameraShell onFrame={handleFrame} autoStart hideControls>
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      Turn to the {side}
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {Math.max(0, toward).toFixed(0)}°
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
                      Turn {sideWord}
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
                      hint="Face the camera, look straight ahead, towel in both hands."
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
                          {counts.attempts} let go early
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
                Camera at face height, ~1.5–2 m away, <strong>facing
                the patient</strong>.
              </li>
              <li>
                Patient sits upright facing the camera. Head, both ears
                and both shoulders in frame. Towel round the back of the
                neck, below the ears; hands low, clear of the face.
              </li>
              <li>
                Look straight ahead as the countdown ends — that is the
                zero. Turn to the chosen side, hold{" "}
                {SNAG_CONFIG.holdSec} s, back to centre for a rep. Turns
                to the other side are not counted.
              </li>
              <li>Target: {TARGET_REPS} reps on the chosen side.</li>
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
        Choose the side to turn to
      </h2>
      <p className="mt-2 text-sm text-muted">
        Pick the direction that is stiff or painful. Sit facing the
        camera with the towel round your neck.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => onPick("left")}>Turn left</Button>
        <Button onClick={() => onPick("right")}>Turn right</Button>
      </div>
    </div>
  );
}
