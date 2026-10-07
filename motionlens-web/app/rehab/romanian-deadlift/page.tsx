"use client";
// H15 — Romanian Deadlift (RDL).
//
// Patient stands side-on to the camera, knees soft, hands (or a light
// weight) in front of the thighs. Hinges forward from the hips with the
// back flat, the hands sliding down the thighs, until the hamstrings
// stretch; pauses PAUSE_SEC, then drives the hips forward to stand tall.
// Both legs together — no side pick.
//
// Signal: trunk tilt from vertical (computeHipHingeAngleDeg, lib/rehab/
// poseMetrics — the same reading as the hip-hinge exercise, whose page
// is not touched). Knee check: the knees stay soft — knee flexion of
// the clearer leg above KNEE_BENT_MAX is a squat, not an RDL, and reads
// as "not hinged".
//
// Lines (lib/rehab/personalLine): the hinge line is a share of the
// deepest hinge shown in calibration; the "tall" line a little above
// standing.
//
// Mechanic: lib/rehab/stretchHold with a short pause — a rep is hinging
// past the line and standing back up past the tall line.
//
// Reps only: saves the reps, the pauses cut short, the lines used, the
// score, and the calibration.

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
import { computeHipHingeAngleDeg } from "@/lib/rehab/poseMetrics";
import { LM_LIVE } from "@/lib/pose/landmarks-live";
import { createStretchHold } from "@/lib/rehab/stretchHold";
import { personalLines } from "@/lib/rehab/personalLine";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "romanian-deadlift";
const TITLE = "Romanian Deadlift";

/** Trunk tilt lines (0° = standing tall). */
const LINES = {
  share: 0.85,
  min: 30,
  max: 90,
  defaultUp: 45,
  downAboveRest: 10,
  defaultDown: 15,
  minGap: 15,
};
/** Knee bent more than this = a squat, not a hinge. */
const KNEE_BENT_MAX = 35;
/** A brief pause at the bottom, not a hold. */
const HOLD_SEC = 0.5;
/** The fold may ease this much and still be held. */
const SAG = 6;
const GRACE_MS = 300;
/** RDLs in the set. */
const TARGET_REPS = 10;
const POINTS_PER_REP = 6;
/** EMA weight for the knee reading. */
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

/** Knee flexion of the leg seen more clearly; null when neither is. */
function bestKneeFlexion(kp: LiveKeypoint[]): number | null {
  let best: { v: number; score: number } | null = null;
  for (const side of ["left", "right"] as const) {
    const v = computeKneeAngle("flexion", kp, side);
    if (v === null) continue;
    const ids = side === "left"
      ? [LM_LIVE.LEFT_HIP, LM_LIVE.LEFT_KNEE, LM_LIVE.LEFT_ANKLE]
      : [LM_LIVE.RIGHT_HIP, LM_LIVE.RIGHT_KNEE, LM_LIVE.RIGHT_ANKLE];
    const score = Math.min(...ids.map((i) => kp[i]?.score ?? 0));
    if (!best || score > best.score) best = { v, score };
  }
  return best ? best.v : null;
}

export default function RomanianDeadliftPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [phase, setPhase] = useState<"ready" | "active">("ready");
  const [flex, setFlex] = useState<number>(0);
  const [kneeBent, setKneeBent] = useState(false);
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
      const live = kp as unknown as LiveKeypoint[];
      const tilt = computeHipHingeAngleDeg(live);
      if (tilt === null) return;
      const prev = smoothRef.current;
      const s = prev === null ? tilt : prev * (1 - SMOOTH) + tilt * SMOOTH;
      smoothRef.current = s;
      setFlex(s);
      const knee = bestKneeFlexion(live);
      const bent = knee !== null && knee > KNEE_BENT_MAX;
      setKneeBent(bent);
      // Knees bent like a squat: not a hinge, read as "not down".
      const l = bent ? 0 : s;
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
      ? `${reps} of ${TARGET_REPS} Romanian deadlifts.`
      : "No Romanian deadlifts counted.";
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
        hinge_line_deg: linesRef.current.up,
        tall_line_deg: linesRef.current.down,
        config: { ...LINES, holdSec: HOLD_SEC, sag: SAG, graceMs: GRACE_MS, kneeBentMax: KNEE_BENT_MAX },
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [phase]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const holdPct = Math.min(100, (held / HOLD_SEC) * 100);
  const holdHint = kneeBent
    ? "Keep the knees only slightly bent"
    : holdPhase === "holding"
      ? "Pause…"
      : holdPhase === "done"
        ? "Good — hips forward, stand tall"
        : `Hinge forward, back flat — ${lines.up.toFixed(0)}°`;

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>H15 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Stand side-on to the camera, knees soft, hands in front of
                your thighs. Hinge forward from the hips with the back flat,
                hands sliding down the thighs, until the back of the thighs
                stretches. Pause, then push the hips forward to stand tall.
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
                      Trunk tilt
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {flex.toFixed(0)}°
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
                      hint="Stand tall, side-on to the camera, knees soft."
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
                          {counts.attempts} stood up too soon
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
                Camera at hip height, ~2–2.5 m away, <strong>side-on to
                the patient</strong>.
              </li>
              <li>
                Shoulders, hips, knees and ankles in frame, standing and
                hinged. A light weight in the hands is optional.
              </li>
              <li>
                Calibration: stand tall; then hinge forward as far as you
                can keep the back flat, knees soft, and hold — that sets
                your personal line ({Math.round(LINES.share * 100)}% of it).
                Live: hinge past the line, pause, stand tall — one rep.
                Bending the knees into a squat does not count.
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
        Stand side-on to the camera, knees soft. Both legs work
        together, so there is no side to pick.
      </p>
      <div className="mt-6">
        <Button onClick={onStart}>Begin</Button>
      </div>
    </div>
  );
}
