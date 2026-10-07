"use client";
// A11 — Ankle Pumps.
//
// Patient sits with the picked leg straight out on a support, side-on
// to the camera with that leg nearest it, and pumps the foot: toes up
// toward the shin, then pointed down, continuously.
//
// Signal: signed ankle angle (computeAnklePumpDeg, lib/rehab/
// ankleMetrics — shin line vs sole line, 90° neutral; + up / − down).
// Rehab's own copy of the ankle assessment's math, not imported.
// Calibration: rest, then toes up and toes down (the two-sided holds,
// filed by sign: range_right = up, range_left = down).
//
// Counting: lib/rehab/anklePumpCounter — end-to-end with a dead band;
// reaching both ends = one pump. Clean = the knee stays within 15° of
// where it started and the leg does not lift (the assessment's
// compensation checks). Reps only.

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
import { computeAnklePumpDeg, computeKneeInteriorDeg, computeLegHeight } from "@/lib/rehab/ankleMetrics";
import { ANKLE_PUMP, anklePumpEnds, createAnklePumpCounter } from "@/lib/rehab/anklePumpCounter";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "ankle-pumps";
const TITLE = "Ankle Pumps";

type Side = "left" | "right";

/** Pumps in the set (toes up and toes down = one). */
const TARGET_REPS = 20;
const POINTS_PER_REP = 2;

export default function AnklePumpsPage() {
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
  const [moved, setMoved] = useState<null | "knee" | "lift">(null);
  const [lastBad, setLastBad] = useState(false);
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
  const endsRef = useRef(anklePumpEnds(null, null));
  const counterRef = useRef(createAnklePumpCounter(anklePumpEnds(null, null)));
  const countsRef = useRef({ reps: 0, attempts: 0 });
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);

  // Side-on and sided: calibration records the up and down ends and
  // checks the leg is straight on the support.
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
    // Ends from this calibration (defaults when skipped or too close).
    // Two-sided holds are filed by sign: right = up, left = down.
    const summary = calibSummaryRef.current();
    endsRef.current = anklePumpEnds(summary?.range_right, summary?.range_left);
    counterRef.current = createAnklePumpCounter(endsRef.current);
    countsRef.current = { reps: 0, attempts: 0 };
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setCounts(countsRef.current);
    setBar(null);
    setLastBad(false);
  }, seq.countdownSec, calibration);
  const phaseRef = useRef(sessionPhase);
  phaseRef.current = sessionPhase;

  const handleFrame = useCallback(
    (kp: Keypoint[], video: HTMLVideoElement) => {
      const live = kp as unknown as LiveKeypoint[];
      calibration.feed(live, video);
      if (!side) return;
      const ankle = computeAnklePumpDeg(live, side);
      if (ankle === null) return;
      setAngle(ankle);
      if (phaseRef.current !== "live") return;
      const counter = counterRef.current;
      const frame = {
        ankle,
        knee: computeKneeInteriorDeg(live, side),
        leg: computeLegHeight(live, side),
      };
      const ev = counter.step(frame);
      const chk = counter.lastCheck();
      setMoved(chk.kneeMoved ? "knee" : chk.legLifted ? "lift" : null);
      setBar(counter.fraction(ankle));
      if (ev) {
        setLastBad(ev.type === "bad");
        const c = { ...countsRef.current };
        if (ev.type === "pump") {
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
    },
    [side, markComplete],
  );

  const buildRehabPayload = useCallback(() => {
    if (!side) return null;
    const { reps, attempts } = countsRef.current;
    const ends = endsRef.current;
    const score = {
      points: reps * POINTS_PER_REP,
      streak: streakRef.current,
      bestStreak: bestStreakRef.current,
    };
    const interpretation = reps > 0
      ? `${reps} of ${TARGET_REPS} ankle pumps (${side} foot)${attempts ? `; ${attempts} with the knee or leg moving` : ""}.`
      : `No ankle pumps counted (${side} foot).`;
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
        mechanic_state: { reps, goodReps: reps, movedLegPumps: attempts },
        target_reps: TARGET_REPS,
        up_end_deg: ends.up,
        down_end_deg: ends.down,
        config: ANKLE_PUMP,
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [side]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const sideWord = side === "left" ? "Left" : "Right";
  const holdPct = bar === null ? 50 : bar * 100;
  const holdHint = moved === "knee"
    ? "Keep the knee still — move only the ankle"
    : moved === "lift"
      ? "Keep the leg resting on the support"
      : lastBad
        ? "That pump moved the leg — ankle only"
        : bar !== null && bar > 0.5
          ? "Now point the toes down"
          : "Pull the toes up toward you";

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>A11 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Sit with the chosen leg straight out on a support, side-on
                to the camera with that leg nearest it. Pull the toes up
                toward you, then point them down, smoothly and fully. Only
                the ankle moves. Goal {TARGET_REPS} pumps.
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
              title={`${TITLE} · ${sideWord} leg`}
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} reps`}
              onExit={() => setSide(null)}
              camera={(
                <RehabCameraShell onFrame={handleFrame} autoStart hideControls>
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      {side === "left" ? "L" : "R"} ankle
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {angle >= 0 ? "+" : "−"}{Math.abs(angle).toFixed(0)}°
                    </p>
                    <p className="tabular text-[11px] text-zinc-300">
                      {angle >= 0 ? "up" : "down"} · {counts.reps} pumps
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
                      {sideWord} leg
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
                      hint="Leg straight out on the support, foot relaxed."
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
                          {counts.attempts} with the leg moving (not counted)
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
                Camera at the height of the foot, ~1.2–1.5 m away,
                <strong> side-on, the chosen leg nearest the camera</strong>.
              </li>
              <li>
                Knee, ankle, heel and toes in frame and large. Bare foot or
                a thin sock, no blanket over the foot.
              </li>
              <li>
                Calibration: foot relaxed; then toes up and hold; then toes
                down and hold — these are your two ends. Live: toes up and
                down is one pump. A knee or leg that moves does not count.
              </li>
              <li>Target: {TARGET_REPS} pumps with the chosen foot.</li>
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
        Choose the foot
      </h2>
      <p className="mt-2 text-sm text-muted">
        Pick the foot to pump. Sit with that leg nearest the camera.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => onPick("left")}>Left leg</Button>
        <Button onClick={() => onPick("right")}>Right leg</Button>
      </div>
    </div>
  );
}
