"use client";
// H13 — Bridge on Heels (hamstring isometric).
//
// Patient lies on the back, side-on to a floor-level camera, both heels
// on the floor further out than for a normal bridge (knees only a
// little bent), toes up. Lifts the hips and HOLDS HOLD_SEC, then
// lowers and rests. Both legs together — no side pick.
//
// Signal: hip INTERIOR angle (180 − computeHipAngle "flexion",
// lib/biomech/hip-live), as on the bridge page, of whichever side the
// camera sees more clearly. Knee check: with the heels out, the knee is
// bent at most KNEE_BENT_MAX; a frame with the knee bent more reads as
// "not up" (that is a normal bridge), so it does not hold.
//
// Mechanic: lib/rehab/stretchHold — hips up past CONFIG.up, hold
// HOLD_SEC, back down below CONFIG.down before the next hold.
//
// Reps only: saves the held bridges, the early let-gos, the score, and
// the calibration.

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
import { computeKneeAngle } from "@/lib/biomech/knee-live";
import { computeHipAngle } from "@/lib/biomech/hip-live";
import { LM_LIVE } from "@/lib/pose/landmarks-live";
import { createStretchHold } from "@/lib/rehab/stretchHold";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "bridge-on-heels";
const TITLE = "Bridge on Heels";

/** Hip interior angle (shoulder–hip–knee), as on the bridge page. */
const CONFIG = {
  up: 155,
  sag: 147,
  down: 145,
  holdSec: 20,
  graceMs: 1000,
  /** Heels out: the knee bent no more than this. */
  kneeBentMax: 65,
};
const HOLD_SEC = CONFIG.holdSec;
const TARGET_REPS = 5;
const POINTS_PER_REP = 10;
/** EMA weight for the hip reading. */
const SMOOTH = 0.4;

/** Hip interior + knee bend of the side seen more clearly. */
function bestSide(kp: LiveKeypoint[]): { hip: number; knee: number } | null {
  let best: { hip: number; knee: number; score: number } | null = null;
  for (const side of ["left", "right"] as const) {
    const flex = computeHipAngle("flexion", kp, side);
    const knee = computeKneeAngle("flexion", kp, side);
    if (flex === null || knee === null) continue;
    const ids = side === "left"
      ? [LM_LIVE.LEFT_SHOULDER, LM_LIVE.LEFT_HIP, LM_LIVE.LEFT_KNEE, LM_LIVE.LEFT_ANKLE]
      : [LM_LIVE.RIGHT_SHOULDER, LM_LIVE.RIGHT_HIP, LM_LIVE.RIGHT_KNEE, LM_LIVE.RIGHT_ANKLE];
    const score = Math.min(...ids.map((i) => kp[i]?.score ?? 0));
    if (!best || score > best.score) best = { hip: 180 - flex, knee, score };
  }
  return best ? { hip: best.hip, knee: best.knee } : null;
}

function makeTimer() {
  return createStretchHold({
    enter: CONFIG.up,
    breakAt: CONFIG.sag,
    release: CONFIG.down,
    holdSec: HOLD_SEC,
    graceMs: CONFIG.graceMs,
  });
}

export default function BridgeOnHeelsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [phase, setPhase] = useState<"ready" | "active">("ready");
  const [hipAngle, setHipAngle] = useState<number>(120);
  const [kneeTooBent, setKneeTooBent] = useState(false);
  const [held, setHeld] = useState(0);
  const [holdPhase, setHoldPhase] = useState<"rest" | "holding" | "done">("rest");
  const [counts, setCounts] = useState({ reps: 0, attempts: 0 });

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
  const smoothRef = useRef<number | null>(null);
  const timerRef = useRef(makeTimer());
  const countsRef = useRef({ reps: 0, attempts: 0 });
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);

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
    timerRef.current = makeTimer();
    countsRef.current = { reps: 0, attempts: 0 };
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setCounts(countsRef.current);
    setHeld(0);
    setHoldPhase("rest");
  }, seq.countdownSec, calibration);
  const phaseRef = useRef(sessionPhase);
  phaseRef.current = sessionPhase;

  const handleFrame = useCallback(
    (kp: Keypoint[], video: HTMLVideoElement) => {
      calibration.feed(kp as unknown as LiveKeypoint[], video);
      if (phase !== "active") return;
      const read = bestSide(kp as unknown as LiveKeypoint[]);
      if (read === null) return;
      const prev = smoothRef.current;
      const s = prev === null ? read.hip : prev * (1 - SMOOTH) + read.hip * SMOOTH;
      smoothRef.current = s;
      setHipAngle(s);
      const tooBent = read.knee > CONFIG.kneeBentMax;
      setKneeTooBent(tooBent);
      // Knees bent like a normal bridge: not this exercise, read as down.
      const l = tooBent ? 0 : s;
      if (phaseRef.current !== "live") return;
      const now = performance.now();
      const timer = timerRef.current;
      const ev = timer.step(l, now);
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
      setHeld(timer.heldSec(now));
      setHoldPhase(timer.phase());
    },
    [phase, markComplete],
  );

  const buildRehabPayload = useCallback(() => {
    if (phase !== "active") return null;
    const { reps, attempts } = countsRef.current;
    const score = {
      points: reps * POINTS_PER_REP,
      streak: streakRef.current,
      bestStreak: bestStreakRef.current,
    };
    const interpretation = reps > 0
      ? `${reps} of ${TARGET_REPS} bridges on the heels held ${HOLD_SEC} s.`
      : "No bridge on the heels held long enough to count.";
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
        mechanic_state: { reps, goodReps: reps, brokenHolds: attempts },
        target_reps: TARGET_REPS,
        hold_sec: HOLD_SEC,
        config: CONFIG,
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [phase]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const holdPct = Math.min(100, (held / HOLD_SEC) * 100);
  const holdHint = kneeTooBent
    ? "Walk your heels further out"
    : holdPhase === "holding"
      ? `Hold… ${Math.max(0, HOLD_SEC - held).toFixed(0)} s`
      : holdPhase === "done"
        ? "Good — lower the hips and rest"
        : `Lift the hips to ${CONFIG.up}°`;

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>H13 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Lie on your back, side-on to the camera, both heels on the
                floor a little further out than for a normal bridge, toes
                up. Dig the heels in and lift the hips. Hold {HOLD_SEC}{" "}
                seconds, lower and rest. Goal {TARGET_REPS} holds.
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
                      Hip angle
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {hipAngle.toFixed(0)}°
                    </p>
                    <p className="tabular text-[11px] text-zinc-300">
                      up line {CONFIG.up}°
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
                      hint="Lie on your back, heels out, side-on to the camera."
                    />
                  )}
                  {(sessionPhase === "live" || sessionPhase === "complete") && (
                    <div className="rounded-card border border-border bg-surface p-4">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                        Holds
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
                Camera <strong>at floor level</strong>, ~2–2.5 m away,
                side-on to the patient.
              </li>
              <li>
                Shoulder, hip, knee and ankle of the near side in frame,
                also with the hips up.
              </li>
              <li>
                Calibration: hips down, heels out; then lift the hips and
                hold. Live: hips up past {CONFIG.up}°, hold {HOLD_SEC} s,
                lower — one hold. Knees bent like a normal bridge do not
                count.
              </li>
              <li>Target: {TARGET_REPS} holds.</li>
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
        Lie on your back, side-on to the camera, heels out. Both legs
        work together, so there is no side to pick.
      </p>
      <div className="mt-6">
        <Button onClick={onStart}>Begin</Button>
      </div>
    </div>
  );
}
