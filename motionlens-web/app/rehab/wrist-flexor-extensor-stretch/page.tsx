"use client";
// W2 — Wrist Flexor & Extensor Stretch.
//
// Patient stands side-on, the picked arm straight out in front, nearest
// the camera. Part 1 — FLEXOR stretch: palm forward, the other hand pulls
// the fingers back (wrist UP), held HOLD_SEC, PER_PART times. Part 2 —
// EXTENSOR stretch: palm down, the other hand presses the hand down
// (wrist DOWN), held HOLD_SEC, PER_PART times.
//
// Signal: signed wrist angle (computeWristFlexExtDeg, lib/rehab/
// poseMetrics; + up / − down) — approximate, four hand points; the
// other hand may cover the fingers. Each part has its own personal line
// (lib/rehab/personalLine) from the calibrated up / down ends; the timer
// reads the angle in that part's direction. Mechanic: lib/rehab/
// stretchHold. No elbow-straight check (user's choice). Reps only.

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
import { computeWristFlexExtDeg } from "@/lib/rehab/poseMetrics";
import { createStretchHold } from "@/lib/rehab/stretchHold";
import { personalLines } from "@/lib/rehab/personalLine";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "wrist-flexor-extensor-stretch";
const TITLE = "Wrist Flexor & Extensor Stretch";

/** Stretch lines, degrees of wrist bend in the part's direction. */
const LINES = {
  share: 0.85,
  min: 15,
  max: 80,
  defaultUp: 40,
  downAboveRest: 10,
  defaultDown: 15,
  minGap: 10,
};
const HOLD_SEC = 30;
const SAG = 3;
const GRACE_MS = 1000;
type Part = "flexor" | "extensor";

type Side = "left" | "right";

function makeTimer(up: number, down: number) {
  return createStretchHold({
    enter: up,
    breakAt: up - SAG,
    release: down,
    holdSec: HOLD_SEC,
    graceMs: GRACE_MS,
  });
}
/** Holds per part; the set is flexor ×PER_PART then extensor ×PER_PART. */
const PER_PART = 3;
const TARGET_REPS = PER_PART * 2;
const POINTS_PER_REP = 8;

export default function WristFlexorExtensorStretchPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [side, setSide] = useState<Side | null>(null);
  const [angle, setAngle] = useState<number>(0);
  const [part, setPart] = useState<Part>("flexor");
  const [lines, setLines] = useState({ up: LINES.defaultUp, down: LINES.defaultDown });
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
  const timerRef = useRef(makeTimer(LINES.defaultUp, LINES.defaultDown));
  const linesRef = useRef({ up: LINES.defaultUp, down: LINES.defaultDown });
  const partRef = useRef<Part>("flexor");
  /** Each part's lines, from the calibrated up / down ends. */
  const partLinesRef = useRef<Record<Part, { up: number; down: number }>>({
    flexor: { up: LINES.defaultUp, down: LINES.defaultDown },
    extensor: { up: LINES.defaultUp, down: LINES.defaultDown },
  });
  const countsRef = useRef({ reps: 0, attempts: 0 });
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);

  // Side-on and sided: calibration records rest, wrist up and wrist down.
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
    // Two-sided holds are filed by sign: right = up, left = down. Each
    // part reads the angle in its own direction (down = negated).
    const rest = typeof summary?.rest === "number" ? summary.rest : null;
    const up = summary?.range_right, down = summary?.range_left;
    partLinesRef.current = {
      flexor: personalLines(rest === null ? undefined : Math.max(0, rest), up, LINES),
      extensor: personalLines(rest === null ? undefined : Math.max(0, -rest), typeof down === "number" ? -down : undefined, LINES),
    };
    partRef.current = "flexor";
    setPart("flexor");
    const l = partLinesRef.current.flexor;
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
      const live = kp as unknown as LiveKeypoint[];
      calibration.feed(live, video);
      if (!side) return;
      const w = computeWristFlexExtDeg(live, side);
      if (w === null) return;
      // Flexor stretch = wrist up (+); extensor = wrist down (read as +).
      const a = partRef.current === "flexor" ? w : -w;
      setAngle(a);
      if (phaseRef.current !== "live") return;
      const now = performance.now();
      const timer = timerRef.current;
      const ev = timer.step(a, now);
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
        else if (ev.type === "rep" && c.reps === PER_PART && partRef.current === "flexor") {
          // Flexor part done: switch to the extensor stretch.
          partRef.current = "extensor";
          setPart("extensor");
          const l = partLinesRef.current.extensor;
          linesRef.current = l;
          setLines(l);
          timerRef.current = makeTimer(l.up, l.down);
        }
      }
      setHeld(timer.heldSec(now));
      setHoldPhase(timer.phase());
    },
    [side, markComplete],
  );

  const buildRehabPayload = useCallback(() => {
    if (!side) return null;
    const { reps, attempts } = countsRef.current;
    const pl = partLinesRef.current;
    const score = {
      points: reps * POINTS_PER_REP,
      streak: streakRef.current,
      bestStreak: bestStreakRef.current,
    };
    const interpretation = reps > 0
      ? `${Math.min(reps, PER_PART)} of ${PER_PART} flexor and ${Math.max(0, reps - PER_PART)} of ${PER_PART} extensor wrist stretches (${side} arm), each held ${HOLD_SEC} s.`
      : `No wrist stretch held long enough (${side} arm).`;
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
        mechanic_state: { reps, goodReps: reps, brokenHolds: attempts, flexorHolds: Math.min(reps, PER_PART), extensorHolds: Math.max(0, reps - PER_PART) },
        target_reps: TARGET_REPS,
        hold_sec: HOLD_SEC,
        flexor_line_deg: pl.flexor.up,
        extensor_line_deg: pl.extensor.up,
        config: { ...LINES, holdSec: HOLD_SEC, sag: SAG, graceMs: GRACE_MS, perPart: PER_PART },
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [side]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const sideWord = side === "left" ? "Left" : "Right";
  const holdPct = Math.min(100, (held / HOLD_SEC) * 100);
  const holdHint = holdPhase === "holding"
    ? `Hold… ${Math.max(0, HOLD_SEC - held).toFixed(0)} s`
    : holdPhase === "done"
      ? "Good — let go and relax the wrist"
      : part === "flexor"
        ? `FLEXOR: palm forward, pull the fingers back — ${lines.up.toFixed(0)}°`
        : `EXTENSOR: palm down, press the hand down — ${lines.up.toFixed(0)}°`;

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>W2 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Stand side-on, the chosen arm straight out in front, nearest
                the camera. First the <strong>flexor stretch</strong>: palm
                forward, pull the fingers back with the other hand. Then the{" "}
                <strong>extensor stretch</strong>: palm down, press the hand
                down. Hold each {HOLD_SEC} s, {PER_PART} times. Hold the
                fingertips from above so the camera side stays clear.
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
              title={`${TITLE} · ${sideWord} arm`}
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} reps`}
              onExit={() => setSide(null)}
              camera={(
                <RehabCameraShell onFrame={handleFrame} autoStart hideControls>
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      {part === "flexor" ? "Flexor" : "Extensor"} · {side === "left" ? "L" : "R"} wrist
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {angle.toFixed(0)}°
                    </p>
                    <p className="tabular text-[11px] text-zinc-300">
                      line {lines.up.toFixed(0)}°
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
                      {sideWord} arm
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
                      hint="Arm straight out in front, wrist straight."
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
                Camera at shoulder height, ~1.5 m away, <strong>side-on, the
                chosen arm nearest the camera</strong>.
              </li>
              <li>
                Shoulder to fingertips in frame and large; good light. Hold
                the fingertips from above — do not cover the hand on the
                camera side.
              </li>
              <li>
                Calibration: wrist straight; then the flexor stretch (wrist
                up) and hold; then the extensor stretch (wrist down) and
                hold. Each part gets its own line ({Math.round(LINES.share * 100)}%
                of it). Live: {PER_PART} flexor holds, then {PER_PART} extensor
                holds, {HOLD_SEC} s each.
              </li>
              <li>Target: {PER_PART} + {PER_PART} holds with the chosen arm.</li>
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
        Choose the arm to stretch
      </h2>
      <p className="mt-2 text-sm text-muted">
        Pick the arm to stretch. Stand with that arm nearest the camera.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => onPick("left")}>Left arm</Button>
        <Button onClick={() => onPick("right")}>Right arm</Button>
      </div>
    </div>
  );
}
