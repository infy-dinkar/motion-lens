"use client";
// A4 — Eccentric Heel Drops (Alfredson).
//
// Patient stands side-on to the camera on the edge of a step (or on the
// floor), holding a rail or wall, with the picked leg nearest the
// camera. Rises onto the toes using BOTH legs, shifts the weight onto
// the picked leg, and lowers that heel SLOWLY — at least MIN_LOWER_SEC
// — down to flat (or below the step). The other leg helps back up. The
// slow lowering is the exercise.
//
// Signal: foot pitch of the picked foot (computeHeelLiftDeg with a
// side) against the patient's own flat foot from calibration (hold 1),
// smoothed. Below the step edge it reads negative, which is fine.
//
// Tempo: lib/rehab/loweringTimer on 180 − lift (flat ≈ 180, heel up
// low), direction "up". The clock runs from the highest heel point to
// the lowest one (flat, or below the step edge); a rep counts only when
// that took ≥ MIN_LOWER_SEC. Faster ones
// are kept as "too fast" attempts.
//
// Reps only: saves the slow reps (as reps), the fast attempts, the
// side, the score, and the calibration.

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
import { computeHeelLiftDeg } from "@/lib/rehab/poseMetrics";
import { createLoweringTimer } from "@/lib/rehab/loweringTimer";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "eccentric-heel-drops";
const TITLE = "Eccentric Heel Drops";

type Side = "left" | "right";

// Engine numbers = 180 − heel lift (flat ≈ 180).
const HEEL_DROP_CONFIG = {
  /** Back to flat: within 2° of the flat-foot reading (or below it). */
  top: 178,
  /** Up on the toes: at least 10° of heel lift. */
  depth: 170,
  /** The lowering must take at least this long to count. */
  minSec: 3,
};
const TARGET_REPS = 15;
const POINTS_PER_REP = 8;
/** EMA weight for the foot-pitch reading — foot landmarks jitter. */
const SMOOTH = 0.4;

type Tempo = { kind: "idle" } | { kind: "slow"; sec: number } | { kind: "fast"; sec: number };

export default function EccentricHeelDropsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [side, setSide] = useState<Side | null>(null);
  const [lift, setLift] = useState<number>(0);
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
  /** Flat-foot pitch from calibration (hold 1); 0 when it was skipped. */
  const baselineRef = useRef<number>(0);
  const smoothRef = useRef<number | null>(null);
  // followThrough: off a step the heel drops below flat, and the clock
  // runs to the lowest point, not just to flat.
  const timerRef = useRef(createLoweringTimer({ ...HEEL_DROP_CONFIG, direction: "up", followThrough: 3 }));
  const countsRef = useRef({ reps: 0, fast: 0 });
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);

  // Side-on and sided: calibration checks the picked leg faces the camera.
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
    countsRef.current = { reps: 0, fast: 0 };
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setCounts(countsRef.current);
    setTempo({ kind: "idle" });
    // The patient's own flat foot is the zero for every rep.
    const rest = calibSummaryRef.current()?.rest;
    baselineRef.current = typeof rest === "number" ? rest : 0;
  }, seq.countdownSec, calibration);
  const phaseRef = useRef(sessionPhase);
  phaseRef.current = sessionPhase;

  const handleFrame = useCallback(
    (kp: Keypoint[], video: HTMLVideoElement) => {
      calibration.feed(kp as unknown as LiveKeypoint[], video);
      if (!side) return;
      const pitch = computeHeelLiftDeg(kp as unknown as LiveKeypoint[], side);
      if (pitch === null) return;
      const prev = smoothRef.current;
      const s = prev === null ? pitch : prev * (1 - SMOOTH) + pitch * SMOOTH;
      smoothRef.current = s;
      // Below the step edge the heel reads under flat: negative is fine.
      const l = s - baselineRef.current;
      setLift(l);
      if (phaseRef.current !== "live") return;
      const done = timerRef.current.step(180 - l, performance.now());
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
      ? `${reps} of ${TARGET_REPS} slow heel drops (${side} leg)`
        + (fast > 0 ? `; ${fast} lowered too fast.` : ".")
      : `No slow heel drops counted (${side} leg).`;
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
        min_lower_sec: HEEL_DROP_CONFIG.minSec,
        config: HEEL_DROP_CONFIG,
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [side]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const sideWord = side === "left" ? "Left" : "Right";

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>A4 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Stand side-on on a step edge (or the floor), holding a
                rail, chosen leg nearest the camera. Rise onto your toes
                with both legs, shift onto the chosen leg, and lower that
                heel slowly — at least {HEEL_DROP_CONFIG.minSec} seconds.
                Use the other leg to come back up. Goal {TARGET_REPS} slow
                reps.
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
                      {side === "left" ? "L" : "R"} heel lift
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {lift.toFixed(0)}°
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
                      hint="Side-on, chosen leg nearest the camera, feet flat."
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
                          ? `Rise up, then lower over ${HEEL_DROP_CONFIG.minSec} s`
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
                Camera at knee height, ~2 m away, <strong>side-on, the
                chosen leg nearest the camera</strong>.
              </li>
              <li>
                Hip, knee, ankle, heel and toes of that leg in frame.
                Shoes off or low shoes; the step edge must not hide the
                heel.
              </li>
              <li>
                Calibration: stand flat (that is the zero), then rise
                onto the toes. Live: rise with both legs, lower on the
                chosen leg over at least {HEEL_DROP_CONFIG.minSec} s.
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
        Pick the leg that lowers (usually the painful one). Stand with
        that leg nearest the camera.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => onPick("left")}>Left leg</Button>
        <Button onClick={() => onPick("right")}>Right leg</Button>
      </div>
    </div>
  );
}
