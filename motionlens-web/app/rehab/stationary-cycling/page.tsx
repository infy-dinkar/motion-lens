"use client";
// K16 — Stationary Cycling.
//
// Patient pedals a stationary bike, side-on to the camera; the picked
// side is the leg nearest the camera. The set runs SESSION_SEC; every
// pedal revolution is counted.
//
// Signal: knee flexion of the near leg (computeKneeAngle, lib/biomech/
// knee-live). Calibration: rest = pedal at the bottom, range = at the
// top. Counting: lib/rehab/bothEndsCounter — reaching both ends = one
// revolution. The bike frame may hide the knee at times. Reps
// (revolutions) only.

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
import { bothEndsFrom, createBothEndsCounter } from "@/lib/rehab/bothEndsCounter";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "stationary-cycling";
const TITLE = "Stationary Cycling";

type Side = "left" | "right";

/** Ends and the dead band (degrees). */
const ENDS = { zoneShare: 0.3, minSpan: 25, defaultHigh: 100, defaultLow: 40 };
/** Length of the set. */
const SESSION_SEC = 120;
const POINTS_PER_REP = 3;

export default function StationaryCyclingPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [side, setSide] = useState<Side | null>(null);
  const [bar, setBar] = useState<number | null>(null);
  const [angle, setAngle] = useState(0);
  const [left, setLeft] = useState(SESSION_SEC);
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
  const countsRef = useRef({ reps: 0, attempts: 0 });
  /** When the live set started (first live frame). */
  const liveStartRef = useRef<number | null>(null);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);

  // Side-on and sided: calibration records the pedal-bottom and
  // pedal-top knee bends of the near leg.
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
    // range = pedal top (knee most bent), rest = pedal bottom.
    const summary = calibSummaryRef.current();
    endsRef.current = bothEndsFrom(summary?.range, summary?.rest, ENDS);
    counterRef.current = createBothEndsCounter(endsRef.current, ENDS);
    countsRef.current = { reps: 0, attempts: 0 };
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setCounts(countsRef.current);
    setBar(null);
    liveStartRef.current = null;
    setLeft(SESSION_SEC);
  }, seq.countdownSec, calibration);
  const phaseRef = useRef(sessionPhase);
  phaseRef.current = sessionPhase;

  const handleFrame = useCallback(
    (kp: Keypoint[], video: HTMLVideoElement) => {
      const live = kp as unknown as LiveKeypoint[];
      calibration.feed(live, video);
      if (!side) return;
      const knee = computeKneeAngle("flexion", live, side);
      if (knee === null) return;
      setAngle(knee);
      if (phaseRef.current !== "live") return;
      const now = performance.now();
      if (liveStartRef.current === null) liveStartRef.current = now;
      const remaining = Math.max(0, SESSION_SEC - (now - liveStartRef.current) / 1000);
      setLeft(remaining);
      if (remaining <= 0) { markComplete(); return; }
      const counter = counterRef.current;
      const rep = counter.step(knee);
      setBar(counter.fraction(knee));
      if (rep) {
        const c = { ...countsRef.current };
        c.reps += 1;
        streakRef.current += 1;
        bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
        countsRef.current = c;
        setCounts(c);
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
      ? `${reps} pedal revolutions in ${Math.round(SESSION_SEC / 60)} min.`
      : "No pedal revolutions counted.";
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
        mechanic_state: { reps, goodReps: reps },
        target_reps: null,
        session_sec: SESSION_SEC,
        config: { ...ENDS, sessionSec: SESSION_SEC },
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [side]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const sideWord = side === "left" ? "Left" : "Right";
  const holdPct = bar === null ? 50 : bar * 100;
  const holdHint = `Keep pedalling — ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")} left`;

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>K16 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Pedal a stationary bike, side-on to the camera, at an easy
                pace for {Math.round(SESSION_SEC / 60)} minutes. Every pedal
                revolution is counted.
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
              title={`${TITLE} · ${sideWord} side to the camera`}
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `${Math.round(SESSION_SEC / 60)} minutes`}
              onExit={() => setSide(null)}
              camera={(
                <RehabCameraShell onFrame={handleFrame} autoStart hideControls>
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      Revolutions
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {counts.reps}
                    </p>
                    <p className="tabular text-[11px] text-zinc-300">
                      knee {angle.toFixed(0)}°
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
                      {sideWord} side
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
                      hint="On the bike, near pedal at the bottom."
                    />
                  )}
                  {(sessionPhase === "live" || sessionPhase === "complete") && (
                    <div className="rounded-card border border-border bg-surface p-4">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                        Revolutions
                      </p>
                      <p className="tabular mt-1 text-4xl font-semibold">
                        {counts.reps}
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
                Camera at seat height, ~2 m away, <strong>side-on to the
                bike</strong>; pick the side that faces the camera.
              </li>
              <li>
                Hip, knee and ankle of the near leg in frame through the
                whole pedal stroke. The bike frame may hide the knee at
                times.
              </li>
              <li>
                Calibration: near pedal at the bottom — hold; at the top —
                hold. Live: every revolution is counted for{" "}
                {Math.round(SESSION_SEC / 60)} minutes.
              </li>
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
        Which side faces the camera?
      </h2>
      <p className="mt-2 text-sm text-muted">
        Pick the leg nearest the camera; that knee is read.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => onPick("left")}>Left side</Button>
        <Button onClick={() => onPick("right")}>Right side</Button>
      </div>
    </div>
  );
}
