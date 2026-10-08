"use client";
// B19 — Wall Angels.
//
// Patient stands with the back to a wall, facing the camera, arms in a
// "W" against the wall (elbows at shoulder height). Slides both arms up
// into a "Y", pauses briefly, slides back down. Both arms together — no
// side pick.
//
// Signal: both wrists' height above the shoulders as a percentage of
// the trunk (computeBothWristsRisePct, lib/rehab/poseMetrics).
//
// Lines (lib/rehab/personalLine): the "up" line is a share of the
// calibrated "Y"; the "down" line a little above the "W".
// Mechanic: lib/rehab/stretchHold with a short pause. Reps only.

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
import { computeBothWristsRisePct } from "@/lib/rehab/poseMetrics";
import { createStretchHold } from "@/lib/rehab/stretchHold";
import { personalLines } from "@/lib/rehab/personalLine";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "wall-angels";
const TITLE = "Wall Angels";

/** Arm height lines (% of the trunk the wrists are above the shoulders). */
const LINES = {
  share: 0.85,
  min: 60,
  max: 160,
  defaultUp: 85,
  downAboveRest: 10,
  defaultDown: 55,
  minGap: 15,
};
/** A brief pause at the top, not a hold. */
const HOLD_SEC = 0.5;
/** The arms may ease this much and still be held. */
const SAG = 6;
const GRACE_MS = 300;
/** Angels in the set. */
const TARGET_REPS = 10;
const POINTS_PER_REP = 6;
/** EMA weight for the arm reading. */
const SMOOTH = 0.4;

function makeTimer(depth: number, stand: number) {
  return createStretchHold({
    enter: depth,
    breakAt: depth - SAG,
    release: stand,
    holdSec: HOLD_SEC,
    graceMs: GRACE_MS,
  });
}

export default function WallAngelsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [phase, setPhase] = useState<"ready" | "active">("ready");
  const [rise, setRise] = useState<number>(0);
  const [lines, setLines] = useState({ up: LINES.defaultUp, down: LINES.defaultDown });
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
  const timerRef = useRef(makeTimer(LINES.defaultUp, LINES.defaultDown));
  const linesRef = useRef({ up: LINES.defaultUp, down: LINES.defaultDown });
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
    // Personal lines from this calibration (defaults when skipped).
    const summary = calibSummaryRef.current();
    const l = personalLines(summary?.rest, summary?.range, LINES);
    linesRef.current = l;
    setLines(l);
    timerRef.current = makeTimer(l.up, l.down);
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
      const r = computeBothWristsRisePct(kp as unknown as LiveKeypoint[]);
      if (r === null) return;
      const prev = smoothRef.current;
      const s = prev === null ? r : prev * (1 - SMOOTH) + r * SMOOTH;
      smoothRef.current = s;
      const l = s;
      setRise(s);
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
      ? `${reps} of ${TARGET_REPS} wall angels.`
      : "No wall angels counted.";
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
        mechanic_state: { reps, goodReps: reps, cutShort: attempts },
        target_reps: TARGET_REPS,
        hold_sec: HOLD_SEC,
        up_line_pct: linesRef.current.up,
        down_line_pct: linesRef.current.down,
        config: { ...LINES, holdSec: HOLD_SEC, sag: SAG, graceMs: GRACE_MS },
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [phase]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const holdPct = Math.min(100, (held / HOLD_SEC) * 100);
  const holdHint =
    holdPhase === "holding"
      ? "Pause…"
      : holdPhase === "done"
        ? "Good — slide back down to the W"
        : "Slide both arms up the wall into a Y";

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>B19 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Stand with your back to a wall, facing the camera, arms in a
                &ldquo;W&rdquo; against the wall. Slide both arms up into a
                &ldquo;Y&rdquo;, pause, slide back down — keep the back and
                arms on the wall. Goal {TARGET_REPS} reps.
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
                      Arm height
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {rise.toFixed(0)}%
                    </p>
                    <p className="tabular text-[11px] text-zinc-300">
                      line {lines.up.toFixed(0)}%
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
                      hint="Back to the wall, arms in a W."
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
                          {counts.attempts} came down too soon
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
                Camera at chest height, ~2.5 m away, <strong>facing the
                patient</strong>.
              </li>
              <li>
                Head to hips in frame, with room above the head for the
                hands.
              </li>
              <li>
                Calibration: arms in the W; then up into the Y and hold —
                that sets your personal line (
                {Math.round(LINES.share * 100)}% of it). Live: up past the
                line, pause, back down — one rep.
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
        Stand with your back to a wall, facing the camera. Both arms
        work together, so there is no side to pick.
      </p>
      <div className="mt-6">
        <Button onClick={onStart}>Begin</Button>
      </div>
    </div>
  );
}
