"use client";
// A10 — Lateral Hops (single leg).
//
// Patient faces the camera standing on the picked leg, the other knee
// lifted, and hops sideways across a line on the floor and back, always
// landing on the same leg.
//
// Signal: hip-mid x as a share of the frame width (computeHipMidX,
// lib/rehab/poseMetrics; mirrored so + is the patient's right — the
// calibration's hip_mid_x_norm). Calibration rest and range are the two
// landing spots, in either order. Counting: lib/rehab/zoneCounter — each
// arrival in the OTHER spot's zone is a rep; the middle 40% is ignored.
// One-leg check: the other knee above the standing knee
// (computeFreeKneeLift, knees only) for at least half of the hop's
// frames, else the hop is "two-footed" and not counted.
//
// Reps only.

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
import { computeFreeKneeLift, computeHipMidX } from "@/lib/rehab/poseMetrics";
import { createZoneCounter } from "@/lib/rehab/zoneCounter";
import { HOP_FREE_KNEE_MIN } from "@/lib/rehab/calibration/poseGates";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import { elapsedSecondsSince } from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

const SLUG = "lateral-hops";
const TITLE = "Lateral Hops";

/** Each landing zone: this share of the calibrated hop from its end. */
const ZONE_SHARE = 0.3;
/** Calibrated hop narrower than this (share of frame width) is ignored
 *  and the span is learned from the hops themselves. */
const MIN_SPAN = 0.04;
/** Learned span (no usable calibration), share of frame width. */
const AUTO_SPAN = 0.08;
/** Other knee above the standing knee, thigh lengths. */
const FREE_KNEE_MIN = HOP_FREE_KNEE_MIN;

type Side = "left" | "right";

function makeCounter(rest: unknown, range: unknown) {
  const ok = typeof rest === "number" && typeof range === "number" && Math.abs(range - rest) >= MIN_SPAN;
  return createZoneCounter({
    a: ok ? (rest as number) : null,
    b: ok ? (range as number) : null,
    share: ZONE_SHARE,
    autoSpan: AUTO_SPAN,
  });
}
/** Hops across the line, each direction counted. */
const TARGET_REPS = 20;
const POINTS_PER_REP = 3;

export default function LateralHopsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  const [side, setSide] = useState<Side | null>(null);
  const [bar, setBar] = useState<number | null>(null);
  const [kneeDown, setKneeDown] = useState(false);
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
  const counterRef = useRef(makeCounter(null, null));
  const spanRef = useRef<{ lo: number | null; hi: number | null }>({ lo: null, hi: null });
  const countsRef = useRef({ reps: 0, attempts: 0 });
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);

  // Frontal and sided: calibration records the two landing spots and
  // checks the other knee stays up.
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
    // Landing spots from this calibration (learned from the hops when
    // skipped or too narrow).
    const summary = calibSummaryRef.current();
    counterRef.current = makeCounter(summary?.rest, summary?.range);
    spanRef.current = counterRef.current.span();
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
      const x = computeHipMidX(live);
      const w = video.videoWidth;
      if (x === null || !w) return;
      // Mirrored so + is the patient's right, as in the calibration.
      const pos = 1 - x / w;
      const lift = computeFreeKneeLift(live, side);
      const up = lift !== null && lift >= FREE_KNEE_MIN;
      setKneeDown(!up);
      if (phaseRef.current !== "live") return;
      const counter = counterRef.current;
      const ev = counter.step(pos, up);
      spanRef.current = counter.span();
      setBar(counter.fraction(pos));
      if (ev) {
        setLastBad(ev.type === "bad");
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
    },
    [side, markComplete],
  );

  const buildRehabPayload = useCallback(() => {
    if (!side) return null;
    const { reps, attempts } = countsRef.current;
    const { lo, hi } = spanRef.current;
    const score = {
      points: reps * POINTS_PER_REP,
      streak: streakRef.current,
      bestStreak: bestStreakRef.current,
    };
    const interpretation = reps > 0
      ? `${reps} of ${TARGET_REPS} single-leg lateral hops on the ${side} leg${attempts ? `, ${attempts} with the other foot down` : ""}.`
      : `No single-leg lateral hops counted (${side} leg).`;
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
        mechanic_state: { reps, goodReps: reps, twoFootHops: attempts },
        target_reps: TARGET_REPS,
        landing_span: { lo, hi },
        config: { zoneShare: ZONE_SHARE, minSpan: MIN_SPAN, autoSpan: AUTO_SPAN, freeKneeMin: FREE_KNEE_MIN },
        level_index: DEFAULT_LEVEL_INDEX,
      },
      observations: { interpretation },
    };
  }, [side]);

  const image = REHAB_EXERCISE_IMAGES[SLUG];
  const sideWord = side === "left" ? "Left" : "Right";
  const holdPct = bar === null ? 50 : bar * 100;
  const holdHint = kneeDown
    ? "Keep the other foot up — knee a little forward"
    : lastBad
      ? "That hop was on two feet — one leg only"
      : bar === null
        ? "Hop across the line and back"
        : "Hop across — land softly on the same leg";

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>A10 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {TITLE}<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Stand facing the camera on the chosen leg, the other knee
                lifted a little forward, beside a line on the floor. Hop
                sideways across the line and back, always landing softly
                on the same leg. Goal {TARGET_REPS} hops.
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
                      Hops
                    </p>
                    <p className="tabular text-2xl font-semibold text-white">
                      {counts.reps}
                    </p>
                    <p className="tabular text-[11px] text-zinc-300">
                      {kneeDown ? "other foot down" : "on one leg"}
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
                      hint="On the chosen leg beside the line, other knee up."
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
                          {counts.attempts} on two feet (not counted)
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
                Camera at hip height, ~3 m away, <strong>facing the
                patient</strong>, with room on both sides for the hops.
              </li>
              <li>
                Head to knees in frame on both sides of the line. A clear,
                non-slip floor.
              </li>
              <li>
                Calibration: on the chosen leg on one side of the line,
                hold; then hop across and hold on the other side — these
                are your two landing spots. Live: arriving at the other
                spot is one hop; half-hops back to the same side do not
                count, nor do hops with the other foot down.
              </li>
              <li>Target: {TARGET_REPS} hops on the chosen leg.</li>
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
        Choose the hopping leg
      </h2>
      <p className="mt-2 text-sm text-muted">
        Pick the leg to hop on. Face the camera; the other foot stays
        up.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => onPick("left")}>Left leg</Button>
        <Button onClick={() => onPick("right")}>Right leg</Button>
      </div>
    </div>
  );
}
