"use client";
// S11 — Rows / Scapular Retraction.
//
// Patient stands side-on to the camera, arms straight out in front —
// holding a resistance band tied to something fixed, or with no
// equipment at all. Pulls the elbows back past the
// body, squeezing the shoulder blades together, holds PAUSE_SEC, and
// lets the arms forward again. Both arms together — no side pick.
//
// Signal: elbow flexion (180 − computeElbowInteriorDeg, lib/rehab/
// poseMetrics) of the arm the camera sees more clearly. Pull check: the
// elbow must sit behind the shoulder (against the facing direction, from
// nose vs ears) by ROW_BEHIND_MIN torso lengths — bending the elbow in
// front of the body is not a row, and reads as "not pulled".
//
// Lines (lib/rehab/personalLine): a share of the deepest pull shown in
// calibration, kept between LINES.min and LINES.max.
//
// Mechanic: lib/rehab/stretchHold. Reps only: saves the reps, the
// squeezes cut short, the lines used, the score, and the calibration.

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
import { computeElbowInteriorDeg } from "@/lib/rehab/poseMetrics";
import { LM_LIVE } from "@/lib/pose/landmarks-live";
import { createStretchHold } from "@/lib/rehab/stretchHold";
import { personalLines } from "@/lib/rehab/personalLine";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "rows";
const TITLE = "Rows / Scapular Retraction";

/** Elbow flexion lines (0° = arm straight). */
const LINES = {
  share: 0.85,
  min: 50,
  max: 130,
  defaultUp: 80,
  downAboveRest: 20,
  defaultDown: 30,
  minGap: 25,
};
/** Elbow at least this far behind the shoulder, in torso lengths. */
const ROW_BEHIND_MIN = 0.05;
/** Squeeze at the back. */
const HOLD_SEC = 2;
/** The fold may ease this much and still be held. */
const SAG = 8;
const GRACE_MS = 500;
/** Rows in the set. */
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

/** Elbow bend and how far the elbow sits behind the shoulder, for the
 *  arm seen more clearly. `behind` is + when the elbow is behind the
 *  shoulder; null when the arm or the facing direction is not seen. */
function readArm(kp: LiveKeypoint[]): { bend: number; behind: number } | null {
  const nose = kp[LM_LIVE.NOSE], le = kp[LM_LIVE.LEFT_EAR], re = kp[LM_LIVE.RIGHT_EAR];
  const lh = kp[LM_LIVE.LEFT_HIP], rh = kp[LM_LIVE.RIGHT_HIP];
  if (!nose || !le || !re || !lh || !rh) return null;
  const earX = (le.x + re.x) / 2;
  if (Math.abs(nose.x - earX) < 2) return null;
  const face = Math.sign(nose.x - earX);
  const hip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
  let best: { bend: number; behind: number; score: number } | null = null;
  for (const side of ["left", "right"] as const) {
    const interior = computeElbowInteriorDeg(kp, side);
    if (interior === null) continue;
    const S = kp[side === "left" ? LM_LIVE.LEFT_SHOULDER : LM_LIVE.RIGHT_SHOULDER];
    const E = kp[side === "left" ? LM_LIVE.LEFT_ELBOW : LM_LIVE.RIGHT_ELBOW];
    const W = kp[side === "left" ? LM_LIVE.LEFT_WRIST : LM_LIVE.RIGHT_WRIST];
    const torso = Math.hypot(S.x - hip.x, S.y - hip.y);
    if (torso < 1) continue;
    const behind = (-(E.x - S.x) * face) / torso;
    const score = Math.min(S.score ?? 0, E.score ?? 0, W.score ?? 0);
    if (!best || score > best.score) best = { bend: 180 - interior, behind, score };
  }
  return best ? { bend: best.bend, behind: best.behind } : null;
}

export default function RowsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [phase, setPhase] = useState<"ready" | "active">("ready");
  const [flex, setFlex] = useState<number>(0);
  const [notBack, setNotBack] = useState(false);
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
      const arm = readArm(live);
      if (arm === null) return;
      const tilt = arm.bend;
      const prev = smoothRef.current;
      const s = prev === null ? tilt : prev * (1 - SMOOTH) + tilt * SMOOTH;
      smoothRef.current = s;
      setFlex(s);
      const front = arm.behind < ROW_BEHIND_MIN;
      // Only flag it once the elbow is bent: a straight arm out front is
      // simply the start position.
      setNotBack(front && s > LINES.min);
      // Elbow bent in front of the body: not a row — read as "not pulled".
      const l = front ? 0 : s;
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
      ? `${reps} of ${TARGET_REPS} rows to ${linesRef.current.up.toFixed(0)}°+ of elbow bend, each squeezed ${HOLD_SEC} s.`
      : "No rows counted.";
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
        pull_line_deg: linesRef.current.up,
        forward_line_deg: linesRef.current.down,
        config: { ...LINES, holdSec: HOLD_SEC, sag: SAG, graceMs: GRACE_MS, behindMin: ROW_BEHIND_MIN },
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [phase]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const holdPct = Math.min(100, (held / HOLD_SEC) * 100);
  const holdHint = notBack
    ? "Pull the elbows back past your body"
    : holdPhase === "holding"
      ? `Squeeze… ${Math.max(0, HOLD_SEC - held).toFixed(0)} s`
      : holdPhase === "done"
        ? "Good — arms forward again"
        : `Pull the elbows back — ${lines.up.toFixed(0)}°`;

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>S11 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Stand side-on to the camera, arms straight out in front —
                holding a resistance band tied to a door handle, or with no
                band at all. Pull the elbows back past your body and squeeze
                the shoulder blades together. Hold{" "}
                {HOLD_SEC} seconds, then let the arms forward. Goal{" "}
                {TARGET_REPS} reps.
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
                      Elbow bend
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
                      hint="Stand side-on, arms straight out in front."
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
                          {counts.attempts} let go too soon
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
                Camera at chest height, ~2 m away, <strong>side-on to the
                patient</strong>.
              </li>
              <li>
                Head, shoulder, elbow, wrist and hip of the near side in
                frame, arms out front and pulled back. A resistance band
                tied to a door handle adds load; without one, just pull the
                elbows back and squeeze.
              </li>
              <li>
                Calibration: arms straight out in front; then pull the
                elbows back past the body and hold — that sets your
                personal line ({Math.round(LINES.share * 100)}% of it).
                Live: pull back past the line, squeeze {HOLD_SEC} s, arms
                forward — one rep. Bending the elbows in front does not
                count.
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
        Stand side-on to the camera. Both arms work together, so there
        is no side to pick.
      </p>
      <div className="mt-6">
        <Button onClick={onStart}>Begin</Button>
      </div>
    </div>
  );
}
