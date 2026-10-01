"use client";
// A5 — Rathleff Heel Raise (plantar heel pain).
//
// Patient stands side-on to the camera on the picked leg, nearest the
// camera, holding a chair, with a rolled towel under the toes so they
// are bent up. Rises onto the toes (about 3 s), HOLDS at the top
// topHoldSec, and lowers SLOWLY (at least minLowerSec). Single leg.
//
// Signal: foot pitch of the picked foot (computeHeelLiftDeg with a
// side) against the patient's own resting pitch from calibration
// (hold 1, standing on the towel), smoothed.
//
// Rep rule: both parts must happen —
//   • top hold: lib/rehab/plateauHold, heel up >= 10° and kept
//     within 3° (a real pause, not a slow pass) for topHoldSec
//   • lowering: lib/rehab/loweringTimer, highest point to flat in
//     >= minLowerSec
// A return to flat without both is an attempt only (no hold at the
// top, or lowered too fast).
//
// Reps only: saves the good reps (as reps), the attempts by reason,
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
import { computeHeelLiftDeg } from "@/lib/rehab/poseMetrics";
import { createLoweringTimer } from "@/lib/rehab/loweringTimer";
import { createPlateauHold } from "@/lib/rehab/plateauHold";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "rathleff-heel-raise";
const TITLE = "Rathleff Heel Raise";

type Side = "left" | "right";

// Heel lift in degrees above the patient's resting foot (on the towel).
const RATHLEFF_CONFIG = {
  /** Up on the toes: at least 10° of heel lift. */
  upDeg: 10,
  /** The top pause may drift this much and still be a pause. */
  pauseBandDeg: 3,
  /** Back down: within 4° of the resting reading. */
  flatDeg: 4,
  /** Seconds held at the top. */
  topHoldSec: 2,
  /** The lowering must take at least this long. */
  minLowerSec: 2,
};
const TARGET_REPS = 12;
const POINTS_PER_REP = 8;
/** EMA weight for the foot-pitch reading — foot landmarks jitter. */
const SMOOTH = 0.4;

type Last =
  | { kind: "idle" }
  | { kind: "good"; sec: number }
  | { kind: "noHold" }
  | { kind: "fast"; sec: number };

export default function RathleffHeelRaisePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [side, setSide] = useState<Side | null>(null);
  const [lift, setLift] = useState<number>(0);
  const [counts, setCounts] = useState({ reps: 0, noHold: 0, fast: 0 });
  const [last, setLast] = useState<Last>({ kind: "idle" });
  const [held, setHeld] = useState(0);
  const [holding, setHolding] = useState(false);

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
  const holdRef = useRef(createPlateauHold({
    minLevel: RATHLEFF_CONFIG.upDeg,
    band: RATHLEFF_CONFIG.pauseBandDeg,
    holdSec: RATHLEFF_CONFIG.topHoldSec,
  }));
  // Engine numbers for the lowering = 180 − lift (flat ≈ 180).
  const lowerRef = useRef(createLoweringTimer({
    top: 180 - RATHLEFF_CONFIG.flatDeg,
    depth: 180 - RATHLEFF_CONFIG.upDeg,
    minSec: RATHLEFF_CONFIG.minLowerSec,
    direction: "up",
  }));
  const countsRef = useRef({ reps: 0, noHold: 0, fast: 0 });
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
    holdRef.current.reset();
    lowerRef.current.reset();
    countsRef.current = { reps: 0, noHold: 0, fast: 0 };
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setCounts(countsRef.current);
    setLast({ kind: "idle" });
    setHeld(0);
    setHolding(false);
    // The patient's own resting foot (on the towel) is the zero.
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
      const l = s - baselineRef.current;
      setLift(l);
      if (phaseRef.current !== "live") return;
      const now = performance.now();
      const hold = holdRef.current;
      hold.step(l, now);
      setHeld(hold.currentSec(now));
      setHolding(l >= RATHLEFF_CONFIG.upDeg && !hold.held());
      const done = lowerRef.current.step(180 - l, now);
      if (!done) return;
      // Back at flat: judge the whole rep.
      const c = { ...countsRef.current };
      const heldTop = hold.held();
      if (heldTop && done.slow) {
        c.reps += 1;
        streakRef.current += 1;
        bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
        setLast({ kind: "good", sec: done.sec });
      } else {
        if (!heldTop) {
          c.noHold += 1;
          setLast({ kind: "noHold" });
        } else {
          c.fast += 1;
          setLast({ kind: "fast", sec: done.sec });
        }
        streakRef.current = 0;
      }
      hold.reset();
      countsRef.current = c;
      setCounts(c);
      if (c.reps >= TARGET_REPS) markComplete();
    },
    [side, markComplete],
  );

  const buildRehabPayload = useCallback(() => {
    if (!side) return null;
    const { reps, noHold, fast } = countsRef.current;
    const score = {
      points: reps * POINTS_PER_REP,
      streak: streakRef.current,
      bestStreak: bestStreakRef.current,
    };
    const interpretation = reps > 0
      ? `${reps} of ${TARGET_REPS} Rathleff heel raises (${side} leg)`
        + (noHold + fast > 0 ? `; ${noHold} without the top hold, ${fast} lowered too fast.` : ".")
      : `No Rathleff heel raises counted (${side} leg).`;
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
        // Reps with the top hold AND a slow lowering; the rest beside.
        mechanic_state: { reps, goodReps: reps, noHoldReps: noHold, fastReps: fast },
        target_reps: TARGET_REPS,
        config: RATHLEFF_CONFIG,
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
              <Badge>A5 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Stand side-on on the chosen leg, nearest the camera,
                holding a chair, with a rolled towel under your toes. Rise
                onto your toes, hold {RATHLEFF_CONFIG.topHoldSec} seconds at
                the top, then lower slowly — at least{" "}
                {RATHLEFF_CONFIG.minLowerSec} seconds. Goal {TARGET_REPS}{" "}
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
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} reps`}
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
                      hint="Side-on, chosen leg nearest the camera, toes on the towel."
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
                          style={{ width: `${Math.min(100, (held / RATHLEFF_CONFIG.topHoldSec) * 100)}%` }}
                        />
                      </div>
                      <p className={`mt-2 text-sm font-medium ${last.kind === "good" ? "text-emerald-500" : last.kind === "idle" ? "" : "text-amber-500"}`}>
                        {holding
                          ? `Hold at the top… ${Math.max(0, RATHLEFF_CONFIG.topHoldSec - held).toFixed(0)} s`
                          : lift >= RATHLEFF_CONFIG.upDeg
                            ? "Now lower slowly"
                            : last.kind === "idle"
                            ? "Rise, hold at the top, lower slowly"
                            : last.kind === "good"
                              ? `Good — lowered in ${last.sec.toFixed(1)} s`
                              : last.kind === "noHold"
                                ? `Hold ${RATHLEFF_CONFIG.topHoldSec} s at the top`
                                : `Too fast — ${last.sec.toFixed(1)} s. Lower slower`}
                      </p>
                      {counts.noHold + counts.fast > 0 && (
                        <p className="tabular mt-3 text-xs text-muted">
                          Not counted: {counts.noHold} no top hold · {counts.fast} too fast
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
                Shoes off; a rolled towel under the toes only, clear of
                the heel.
              </li>
              <li>
                Calibration: stand on the towel, foot flat (that is the
                zero), then rise onto the toes. Live: rise, hold{" "}
                {RATHLEFF_CONFIG.topHoldSec} s, lower over at least{" "}
                {RATHLEFF_CONFIG.minLowerSec} s — one rep.
              </li>
              <li>Target: {TARGET_REPS} reps on the chosen leg.</li>
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
        Pick the leg that works (usually the painful one). Stand with
        that leg nearest the camera, towel under its toes.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => onPick("left")}>Left leg</Button>
        <Button onClick={() => onPick("right")}>Right leg</Button>
      </div>
    </div>
  );
}
