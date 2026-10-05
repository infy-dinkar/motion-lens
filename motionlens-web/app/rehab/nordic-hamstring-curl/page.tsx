"use client";
// H18 — Nordic Hamstring Curl (eccentric).
//
// Patient kneels upright side-on to the camera, heels held down (under
// a sofa or by a partner), body straight from knees to shoulders.
// Leans forward from the knees as SLOWLY as possible — at least
// MIN_LOWER_SEC — keeping the hips straight, catches the fall with the
// hands, and pushes back up. The slow lowering is the exercise. Both
// legs together — no side pick.
//
// Signal: trunk tilt from vertical (computeHipHingeAngleDeg, lib/rehab/
// poseMetrics — as RDL / hip hinge). Hip check: the hip interior
// (shoulder–hip–knee) of the clearer side under HIP_MIN means folding at
// the hips; a lowering with a fold in it is not counted. No ankle
// points are used.
//
// Tempo: lib/rehab/loweringTimer, direction "down", on 180 − tilt, with
// followThrough so the clock runs from upright to the lowest controlled
// point. A rep counts when the depth line was passed and the lowering
// took >= MIN_LOWER_SEC with the hips straight.
//
// Reps only: saves the slow reps, the fast and hips-bent attempts, the
// lines used, the score, and the calibration.

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
import { computeHipHingeAngleDeg } from "@/lib/rehab/poseMetrics";
import { LM_LIVE } from "@/lib/pose/landmarks-live";
import { createLoweringTimer } from "@/lib/rehab/loweringTimer";
import { personalLines } from "@/lib/rehab/personalLine";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "nordic-hamstring-curl";
const TITLE = "Nordic Hamstring Curl";

/** Trunk tilt lines (0° = kneeling upright). */
const LINES = {
  share: 0.85,
  min: 20,
  max: 70,
  defaultUp: 35,
  downAboveRest: 10,
  defaultDown: 15,
  minGap: 15,
};
/** Hip interior below this = folding at the hips. */
const HIP_MIN = 150;
/** The lowering must take at least this long. */
const MIN_LOWER_SEC = 3;
/** Slow lowerings in the set. */
const TARGET_REPS = 10;
const POINTS_PER_REP = 10;
/** EMA weight for the tilt reading. */
const SMOOTH = 0.4;

type Last = { kind: "idle" } | { kind: "good"; sec: number } | { kind: "fast"; sec: number } | { kind: "hips" };

/** Lowering timer on 180 − tilt (upright ≈ 180). */
function makeTimer(depthTilt: number, uprightTilt: number) {
  return createLoweringTimer({
    top: 180 - uprightTilt,
    depth: 180 - depthTilt,
    minSec: MIN_LOWER_SEC,
    direction: "down",
    followThrough: 3,
  });
}

/** Hip interior (shoulder–hip–knee) of the side seen more clearly. */
function bestHipInterior(kp: LiveKeypoint[]): number | null {
  let best: { v: number; score: number } | null = null;
  for (const side of ["left", "right"] as const) {
    const S = kp[side === "left" ? LM_LIVE.LEFT_SHOULDER : LM_LIVE.RIGHT_SHOULDER];
    const H = kp[side === "left" ? LM_LIVE.LEFT_HIP : LM_LIVE.RIGHT_HIP];
    const K = kp[side === "left" ? LM_LIVE.LEFT_KNEE : LM_LIVE.RIGHT_KNEE];
    if (!S || !H || !K) continue;
    const score = Math.min(S.score ?? 0, H.score ?? 0, K.score ?? 0);
    if (score < 0.3) continue;
    const ax = S.x - H.x, ay = S.y - H.y, bx = K.x - H.x, by = K.y - H.y;
    const m = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (m < 1) continue;
    const v = (Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / m))) * 180) / Math.PI;
    if (!best || score > best.score) best = { v, score };
  }
  return best ? best.v : null;
}

export default function NordicHamstringCurlPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [phase, setPhase] = useState<"ready" | "active">("ready");
  const [flex, setFlex] = useState<number>(0);
  const [hipsBent, setHipsBent] = useState(false);
  const [lines, setLines] = useState({ up: LINES.defaultUp, down: LINES.defaultDown });
  const [last, setLast] = useState<Last>({ kind: "idle" });
  const [counts, setCounts] = useState({ reps: 0, fast: 0, hips: 0 });

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
  const countsRef = useRef({ reps: 0, fast: 0, hips: 0 });
  /** The hips folded during the lowering in progress. */
  const foldedRef = useRef(false);
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
    countsRef.current = { reps: 0, fast: 0, hips: 0 };
    foldedRef.current = false;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setCounts(countsRef.current);
    setLast({ kind: "idle" });
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
      const hip = bestHipInterior(live);
      const bent = hip !== null && hip < HIP_MIN;
      setHipsBent(bent && s > linesRef.current.down);
      if (phaseRef.current !== "live") return;
      const now = performance.now();
      // Track the lowering in progress: did the hips fold.
      if (s > linesRef.current.down && bent) foldedRef.current = true;
      const done = timerRef.current.step(180 - s, now);
      if (!done) return;
      const c = { ...countsRef.current };
      if (foldedRef.current) {
        c.hips += 1;
        streakRef.current = 0;
        setLast({ kind: "hips" });
      } else if (done.slow) {
        c.reps += 1;
        streakRef.current += 1;
        bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
        setLast({ kind: "good", sec: done.sec });
      } else {
        c.fast += 1;
        streakRef.current = 0;
        setLast({ kind: "fast", sec: done.sec });
      }
      foldedRef.current = false;
      countsRef.current = c;
      setCounts(c);
      if (c.reps >= TARGET_REPS) markComplete();
    },
    [phase, markComplete],
  );

  const buildRehabPayload = useCallback(() => {
    if (phase !== "active") return null;
    const { reps, fast, hips } = countsRef.current;
    const score = {
      points: reps * POINTS_PER_REP,
      streak: streakRef.current,
      bestStreak: bestStreakRef.current,
    };
    const interpretation = reps > 0
      ? `${reps} of ${TARGET_REPS} slow Nordic curls to ${linesRef.current.up.toFixed(0)}°+ of lean`
        + (fast + hips > 0 ? `; ${fast} too fast, ${hips} with the hips bent.` : ".")
      : "No slow Nordic curls counted.";
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
        mechanic_state: { reps, goodReps: reps, fastReps: fast, hipsBentReps: hips },
        target_reps: TARGET_REPS,
        min_lower_sec: MIN_LOWER_SEC,
        depth_line_deg: linesRef.current.up,
        upright_line_deg: linesRef.current.down,
        config: { ...LINES, minLowerSec: MIN_LOWER_SEC, hipMin: HIP_MIN },
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [phase]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const holdHint = hipsBent
    ? "Keep the hips straight — lean from the knees"
    : last.kind === "idle"
      ? `Lean forward slowly — ${MIN_LOWER_SEC} s or more`
      : last.kind === "good"
        ? `Good — ${last.sec.toFixed(1)} s`
        : last.kind === "fast"
          ? `Too fast — ${last.sec.toFixed(1)} s. Slower`
          : "Hips bent — not counted";

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>H18 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Kneel upright side-on to the camera, heels held down under a
                sofa or by a partner, body straight from knees to shoulders.
                Lean forward from the knees as slowly as you can — at least{" "}
                {MIN_LOWER_SEC} seconds — keeping the hips straight. Catch
                yourself with your hands, push back up. Goal{" "}
                {TARGET_REPS} slow reps.
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
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} slow reps`}
              onExit={() => setPhase("ready")}
              camera={(
                <RehabCameraShell onFrame={handleFrame} autoStart hideControls>
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      Lean
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
                      hint="Kneel upright, heels held down, body straight."
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
                      <p className={`mt-2 text-sm font-medium ${last.kind === "good" ? "text-emerald-500" : last.kind === "idle" ? "" : "text-amber-500"}`}>{holdHint}</p>
                      {counts.fast + counts.hips > 0 && (
                        <p className="tabular mt-3 text-xs text-muted">
                          Not counted: {counts.fast} too fast · {counts.hips} hips bent
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
                Camera at hip height (kneeling), ~2.5 m away,{" "}
                <strong>side-on to the patient</strong>.
              </li>
              <li>
                Shoulders, hips and knees in frame, upright and leaning. A
                pad under the knees; heels hooked under a heavy sofa or held
                by a partner.
              </li>
              <li>
                Calibration: kneel upright; then lean forward from the
                knees, hips straight, as far as you can control, and hold —
                that sets your personal depth line (
                {Math.round(LINES.share * 100)}% of it). Live: lean past the
                line over at least {MIN_LOWER_SEC} s, catch, push back up —
                one rep. Bending at the hips does not count.
              </li>
              <li>Target: {TARGET_REPS} slow reps.</li>
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
        Kneel side-on to the camera, heels held down. Both legs work
        together, so there is no side to pick.
      </p>
      <div className="mt-6">
        <Button onClick={onStart}>Begin</Button>
      </div>
    </div>
  );
}
