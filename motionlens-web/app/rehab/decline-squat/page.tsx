"use client";
// K10 — Decline Squat (eccentric, patellar tendon).
//
// Patient stands side-on to the camera on a decline board (or flat
// floor), the picked leg nearest the camera, holding a support. Lowers
// into a squat on the picked leg SLOWLY — at least MIN_LOWER_SEC — down
// to the personal depth line; uses both legs to come back up. The slow
// lowering is the exercise.
//
// Signal: knee flexion of the picked leg (computeKneeAngle,
// lib/biomech/knee-live: 0° straight), smoothed.
//
// Lines (lib/rehab/personalLine): the depth line is a share of the
// deepest bend shown in calibration, kept between LINES.min and
// LINES.max; the "standing" line is a little above the resting bend.
//
// Tempo: lib/rehab/loweringTimer, direction "down", on the knee
// INTERIOR angle (180 − flexion): the clock runs from the straightest
// point to the deepest point (past the depth line); a rep counts only when that took
// >= MIN_LOWER_SEC. Faster ones are kept as "too fast" attempts.
//
// Reps only: saves the slow reps, the fast attempts, the lines used,
// the side, the score, and the calibration.

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
import { personalLines } from "@/lib/rehab/personalLine";
import { createLoweringTimer } from "@/lib/rehab/loweringTimer";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "decline-squat";
const TITLE = "Decline Squat";

type Side = "left" | "right";

/** Knee flexion lines (0° = straight). */
const LINES = {
  share: 0.85,
  min: 30,
  max: 90,
  defaultUp: 60,
  downAboveRest: 15,
  defaultDown: 20,
  minGap: 20,
};
/** The lowering must take at least this long to count. */
const MIN_LOWER_SEC = 3;

/** Lowering timer on the knee interior angle (180 − flexion). */
function makeTimer(depthFlex: number, standFlex: number) {
  return createLoweringTimer({
    top: 180 - standFlex,
    depth: 180 - depthFlex,
    minSec: MIN_LOWER_SEC,
    direction: "down",
    // Keep timing past the depth line to the deepest point, so a slow
    // squat that goes beyond the line is timed in full.
    followThrough: 3,
  });
}
const TARGET_REPS = 15;
const POINTS_PER_REP = 8;
/** EMA weight for the foot-pitch reading — foot landmarks jitter. */
const SMOOTH = 0.4;

type Tempo = { kind: "idle" } | { kind: "slow"; sec: number } | { kind: "fast"; sec: number };

export default function DeclineSquatPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [side, setSide] = useState<Side | null>(null);
  const [flex, setFlex] = useState<number>(0);
  const [lines, setLines] = useState({ up: LINES.defaultUp, down: LINES.defaultDown });
  const [counts, setCounts] = useState({ reps: 0, fast: 0 });
  const [tempo, setTempo] = useState<Tempo>({ kind: "idle" });

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
  const smoothRef = useRef<number | null>(null);
  const timerRef = useRef(makeTimer(LINES.defaultUp, LINES.defaultDown));
  const countsRef = useRef({ reps: 0, fast: 0 });
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);

  // Side-on and sided: calibration checks the picked leg faces the
  // camera. The other leg helps on the way up, so no still-leg check.
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
    // Personal lines from this calibration (defaults when skipped).
    const summary = calibSummaryRef.current();
    const l = personalLines(summary?.rest, summary?.range, LINES);
    setLines(l);
    timerRef.current = makeTimer(l.up, l.down);
    countsRef.current = { reps: 0, fast: 0 };
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setCounts(countsRef.current);
    setTempo({ kind: "idle" });
  }, seq.countdownSec, calibration);
  const phaseRef = useRef(sessionPhase);
  phaseRef.current = sessionPhase;

  const handleFrame = useCallback(
    (kp: Keypoint[], video: HTMLVideoElement) => {
      calibration.feed(kp as unknown as LiveKeypoint[], video);
      if (!side) return;
      const f = computeKneeAngle("flexion", kp as unknown as LiveKeypoint[], side);
      if (f === null) return;
      const prev = smoothRef.current;
      const s = prev === null ? f : prev * (1 - SMOOTH) + f * SMOOTH;
      smoothRef.current = s;
      setFlex(s);
      if (phaseRef.current !== "live") return;
      const done = timerRef.current.step(180 - s, performance.now());
      if (!done) return;
      const c = { ...countsRef.current };
      if (done.slow) {
        c.reps += 1;
        streakRef.current += 1;
        bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
        setTempo({ kind: "slow", sec: done.sec });
      } else {
        c.fast += 1;
        streakRef.current = 0;
        setTempo({ kind: "fast", sec: done.sec });
      }
      countsRef.current = c;
      setCounts(c);
      if (c.reps >= TARGET_REPS) markComplete();
    },
    [side, markComplete],
  );

  const buildRehabPayload = useCallback(() => {
    if (!side) return null;
    const { reps, fast } = countsRef.current;
    const score = {
      points: reps * POINTS_PER_REP,
      streak: streakRef.current,
      bestStreak: bestStreakRef.current,
    };
    const interpretation = reps > 0
      ? `${reps} of ${TARGET_REPS} slow decline squats (${side} leg)`
        + (fast > 0 ? `; ${fast} lowered too fast.` : ".")
      : `No slow decline squats counted (${side} leg).`;
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
        // Slow lowerings are the reps; the fast ones are kept beside.
        mechanic_state: { reps, goodReps: reps, fastReps: fast },
        target_reps: TARGET_REPS,
        min_lower_sec: MIN_LOWER_SEC,
        depth_line_deg: lines.up,
        stand_line_deg: lines.down,
        config: { ...LINES, minLowerSec: MIN_LOWER_SEC },
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [side, lines]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const sideWord = side === "left" ? "Left" : "Right";

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>K10 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Stand side-on on a decline board (or the floor), holding a
                support, chosen leg nearest the camera. Squat down on the
                chosen leg slowly — at least {MIN_LOWER_SEC} seconds — to
                your depth line, then use both legs to stand back up.
                Goal {TARGET_REPS} slow reps.
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
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} slow reps`}
              onExit={() => setSide(null)}
              camera={(
                <RehabCameraShell onFrame={handleFrame} autoStart hideControls>
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      {side === "left" ? "L" : "R"} knee bend
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {flex.toFixed(0)}°
                    </p>
                    <p className="tabular text-[11px] text-zinc-300">
                      depth line {lines.up.toFixed(0)}°
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
                      hint="Stand tall, side-on, chosen leg nearest the camera."
                    />
                  )}
                  {(sessionPhase === "live" || sessionPhase === "complete") && (
                    <div className="rounded-card border border-border bg-surface p-4">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                        Slow reps
                      </p>
                      <p className="tabular mt-1 text-4xl font-semibold">
                        {counts.reps}
                        <span className="text-lg text-muted"> / {TARGET_REPS}</span>
                      </p>
                      <p className={`mt-2 text-sm font-medium ${tempo.kind === "slow" ? "text-emerald-500" : tempo.kind === "fast" ? "text-amber-500" : ""}`}>
                        {tempo.kind === "idle"
                          ? `Squat down slowly to ${lines.up.toFixed(0)}° — ${MIN_LOWER_SEC} s or more`
                          : tempo.kind === "slow"
                            ? `Good — ${tempo.sec.toFixed(1)} s`
                            : `Too fast — ${tempo.sec.toFixed(1)} s. Lower slower`}
                      </p>
                      {counts.fast > 0 && (
                        <p className="tabular mt-3 text-xs text-muted">
                          {counts.fast} lowered too fast (not counted)
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
                Camera at hip height, ~2–2.5 m away, <strong>side-on, the
                chosen leg nearest the camera</strong>.
              </li>
              <li>
                Hip, knee and ankle of that leg in frame, standing and at
                the bottom. A decline board (about 25°) is optional; a
                wall, rail or chair for balance.
              </li>
              <li>
                Calibration: stand tall, then squat on the chosen leg as
                deep as is comfortable and hold — that sets your personal
                depth line ({Math.round(LINES.share * 100)}% of it). Live:
                lower to the line over at least {MIN_LOWER_SEC} s, stand
                back up with both legs — one rep.
              </li>
              <li>Target: {TARGET_REPS} slow reps on the chosen leg.</li>
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
        Choose the working leg
      </h2>
      <p className="mt-2 text-sm text-muted">
        Pick the leg that does the slow lowering (usually the painful
        one). Stand with that leg nearest the camera.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => onPick("left")}>Left leg</Button>
        <Button onClick={() => onPick("right")}>Right leg</Button>
      </div>
    </div>
  );
}
