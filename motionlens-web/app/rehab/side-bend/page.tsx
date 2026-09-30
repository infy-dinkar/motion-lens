"use client";
// B3 — Side Bend (Lateral Trunk Flexion).
//
// Mechanic: bilateral rep count, hand-rolled in this file — no
// mechanic shell and nothing from lib/rehab/mechanics, though the
// result is saved as mechanic_id "rep_count" alongside the
// shell-driven exercises. The signed lateral-flexion angle is
// EMA-smoothed, and touching BOTH sides past REP_REACH 12° counts as
// one full cycle. TARGET_REPS auto-completes.
//
// Bilateral by design: the patient bends to either side, and the
// helper returns POSITIVE for an anatomical-right bend.
//
// It was Target-Reach, with this same signed angle driving a cursor
// at spawning targets. Commit 7ebb81b replaced that across five
// exercises: under pose latency the cursor lagged the trunk badly
// enough to be frustrating, and the game never auto-saved.
//
// Mirror correctness: the camera shell renders a selfie-mirror
// (patient's right appears on screen-right). The helper returns
// POSITIVE when the patient bends to their anatomical right, which
// in the mirrored view = screen-right = cursor.x > 0.5. Natural
// directional feel without extra negation.
//
// Reuses (no modifications):
//   • RehabCameraShell
//   • computeLateralTrunkFlexionDeg — NEW pure fn in poseMetrics
//   • usePatientContext

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DEFAULT_LEVEL_INDEX } from "@/lib/rehab/progressionLadders";
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
import { useRehabCalibration } from "@/lib/rehab/calibration/useRehabCalibration";
import { RehabCalibrationOverlay } from "@/components/rehab/RehabCalibrationOverlay";
import { useRehabAutoFlow } from "@/lib/rehab/useAutoFlow";
import { LiveModeLayout } from "@/components/live/LiveModeLayout";
import { computeLateralTrunkFlexionDeg } from "@/lib/rehab/poseMetrics";
import { usePatientContext } from "@/hooks/usePatientContext";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import {
  buildSkeletonPosePayload,
  elapsedSecondsSince,
  kpToPoseSnapshot,
  type BestPoseSnapshot,
  type PoseSnapshot,
} from "@/lib/rehab/sessionHelpers";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";

// 25° = upper end of typical clinical active lateral-flexion ROM.
const MAX_BEND_DEG = 25;

// Full left↔right cycle rep: neutral → LEFT bend → neutral → RIGHT bend
// → neutral = 1 rep. Counted when the patient has reached BOTH a left
// and a right extreme since the last rep (order-independent). REP_REACH
// = the |lateral flexion angle| that counts as "reached a side".
// Auto-saves at TARGET_REPS. Tune REP_REACH on camera if needed.
const TARGET_REPS = 20;
const REP_REACH = 12;

export default function SideBendExercisePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

export function Inner() {
  // Simple "ready → active" gate so the reference image renders
  // before the camera engages — mirrors the side-picker pattern on
  // other rehab pages.
  const [phase, setPhase] = useState<"ready" | "active">("ready");
  const [liveAngle, setLiveAngle] = useState<number>(0);
  const [reps, setReps] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  // Brief pulse on the rep counter each time a rep lands.
  const [flash, setFlash] = useState(false);
  const flashTimeoutRef = useRef<number | null>(null);
  // Which side the trunk currently favours — drives the live readout.
  const [bendDir, setBendDir] = useState<"left" | "right" | "neutral">("neutral");
  // Extremes reached in the CURRENT rep — drives the L/R progress chips.
  const [visited, setVisited] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });

  const { patient, isDoctorFlow } = usePatientContext();
  // Prescribed-session position, or an inert object on a normal
  // standalone visit. Never gates the exercise itself — the page's
  // own side / duration picker still runs exactly as it always has.
  const seq = useRehabSequence();

  // Inside a prescribed session nothing should need tapping: the
  // exercise opens itself and the longer get-ready countdown covers
  // getting into position. Applied ONCE — exiting brings the gate
  // back rather than restarting under the patient.
  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (seq.inSequence && !autoStarted) {
      setAutoStarted(true);
      setPhase("active");
    }
  }, [seq.inSequence, autoStarted]);

  const sessionStartRef = useRef<number>(performance.now());
  const bestPoseRef = useRef<BestPoseSnapshot | null>(null);
  const lastKpRef = useRef<PoseSnapshot | null>(null);
  const peakBendRef = useRef<number>(0);
  // EMA-smoothed angle — kills per-frame pose jitter (phantom reps).
  const smoothAngleRef = useRef<number | null>(null);
  // Extremes reached since the last counted rep + authoritative count.
  const repVisitedRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const repsCountRef = useRef<number>(0);

  // Auto-flow: Begin → 3-2-1 countdown → live → complete (at
  // TARGET_REPS) → auto-save. Session-scoped refs reset at the live
  // transition so countdown framing noise never leaks into the payload.
  // Two short holds before the countdown: start pose, then show your
  // range. Records rest and range under metrics.calibration; changes
  // nothing about how the exercise itself is scored.
  const calibration = useRehabCalibration("side-bend", null, phase !== "ready");

  const {
    phase: sessionPhase,
    countdown,
    skipCountdown,
    markComplete,
  } = useRehabAutoFlow(phase !== "ready", () => {
    peakBendRef.current = 0;
    bestPoseRef.current = null;
    smoothAngleRef.current = null;
    repVisitedRef.current = { left: false, right: false };
    repsCountRef.current = 0;
    setReps(0);
    setVisited({ left: false, right: false });
    setElapsedSec(0);
    sessionStartRef.current = performance.now();
  }, seq.countdownSec, calibration);
  // Latest calibration summary for the payload, through a ref so
  // buildRehabPayload keeps its dependency list unchanged.
  const phaseRef = useRef(sessionPhase);
  phaseRef.current = sessionPhase;
  const calibSummaryRef = useRef(calibration.summary);
  calibSummaryRef.current = calibration.summary;

  useEffect(() => {
    if (sessionPhase !== "live") return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [sessionPhase]);

  const handleFrame = useCallback(
    (kp: Keypoint[], video: HTMLVideoElement) => {
      calibration.feed(kp as unknown as LiveKeypoint[], video);
      const snap = kpToPoseSnapshot(kp, video.videoWidth, video.videoHeight);
      if (snap) lastKpRef.current = snap;
      const rawAngle = computeLateralTrunkFlexionDeg(
        kp as unknown as LiveKeypoint[],
      );
      if (rawAngle === null) return;
      const prev = smoothAngleRef.current;
      const angle = prev === null ? rawAngle : prev * 0.65 + rawAngle * 0.35;
      smoothAngleRef.current = angle;
      setLiveAngle(angle);
      setBendDir(angle <= -2 ? "left" : angle >= 2 ? "right" : "neutral");

      const absAngle = Math.abs(angle);
      if (absAngle > peakBendRef.current) {
        peakBendRef.current = absAngle;
        if (absAngle >= 5 && lastKpRef.current) {
          bestPoseRef.current = {
            landmarks: lastKpRef.current.landmarks,
            source_frame: lastKpRef.current.source_frame,
            angle: absAngle,
            capturedAtMs: performance.now(),
          };
        }
      }

      // Only a LIVE bend is a rep. The calibration holds bend to both
      // sides on purpose and must not tick the counter; go-live resets
      // the refs anyway, but the number would flash on screen first.
      if (phaseRef.current !== "live") return;

      // ── Full left↔right cycle rep counter ───────────────────────
      // Mark which extreme has been reached; once BOTH sides have been
      // touched, that's one full cycle → +1 rep. Reaching TARGET_REPS
      // auto-completes → auto-save.
      if (angle <= -REP_REACH && !repVisitedRef.current.left) {
        repVisitedRef.current.left = true;
        setVisited((v) => ({ ...v, left: true }));
      }
      if (angle >= REP_REACH && !repVisitedRef.current.right) {
        repVisitedRef.current.right = true;
        setVisited((v) => ({ ...v, right: true }));
      }
      if (
        repVisitedRef.current.left
        && repVisitedRef.current.right
        && repsCountRef.current < TARGET_REPS
      ) {
        repVisitedRef.current = { left: false, right: false };
        setVisited({ left: false, right: false });
        repsCountRef.current += 1;
        setReps(repsCountRef.current);
        setFlash(true);
        if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = window.setTimeout(() => setFlash(false), 700);
        if (repsCountRef.current >= TARGET_REPS) markComplete();
      }
    },
    [markComplete],
  );

  const buildRehabPayload = useCallback(() => {
    const peak = peakBendRef.current;
    const interpretation =
      `Side bend — ${reps} full left-right rep${reps === 1 ? "" : "s"}; peak lateral trunk flexion ${peak.toFixed(0)}° (target up to ${MAX_BEND_DEG}°).`;
    const skeletonPose = buildSkeletonPosePayload(
      bestPoseRef.current,
      lastKpRef.current,
      peak,
      null,
      `Peak side bend — ${peak.toFixed(0)}° lateral trunk flexion`,
    );
    return {
      module: "rehab" as const,
      movement: "side-bend",
      metrics: {
        calibration: calibSummaryRef.current(),
        exercise_slug: "side-bend",
        mechanic_id: "rep_count",
        started_at_ms: sessionStartRef.current,
        duration_sec: elapsedSecondsSince(sessionStartRef.current),
        reps,
        target_reps: TARGET_REPS,
        score: { points: 0, streak: 0, bestStreak: 0 },
        // rep_count report reads reps/goodReps from mechanic_state.
        mechanic_state: { reps, goodReps: reps },
        signal: {
          name: "lateral_trunk_flexion",
          unit: "deg",
          value_at_peak: peak,
          target_band: { min: 0, max: MAX_BEND_DEG },
        },
        level_index: DEFAULT_LEVEL_INDEX,
        skeleton_pose: skeletonPose,
      },
      observations: { interpretation },
    };
  }, [reps]);

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge>B3 · Rehab game</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                Side Bend<span className="text-accent">.</span>
              </h1>
              <p className="mt-5 text-lg text-muted">
                Lateral trunk-flexion drill — patient stands frontal
                and bends side to side. One full cycle — bend{" "}
                <strong>left</strong> → back to centre → bend{" "}
                <strong>right</strong> → back to centre — is one rep;
                the session auto-saves after {TARGET_REPS} reps. The
                shared clinical metric — <strong>lateral-flexion
                angle</strong> — is the control.
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

          {/* Skipped on the way in during a prescribed session;
              shown again if the patient exits. */}
          {phase === "ready" && (autoStarted || !seq.inSequence) ? (
            <ReadyGate onStart={() => setPhase("active")} />
          ) : null}

          {phase !== "ready" && (
            <LiveModeLayout
              title="Side Bend"
              subtitle={isDoctorFlow && patient ? `Connected to ${patient.name}'s record.` : `Goal ${TARGET_REPS} reps`}
              onExit={() => setPhase("ready")}
              camera={(
                <RehabCameraShell onFrame={handleFrame} autoStart hideControls>
                  <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">Lateral flexion</p>
                    <p className="tabular text-2xl font-semibold text-white">{liveAngle > 0 ? "+" : ""}{liveAngle.toFixed(0)}°</p>
                    <p className="mt-1 text-[10px] text-zinc-300">{bendDir === "left" ? "bending left" : bendDir === "right" ? "bending right" : "neutral"}</p>
                  </div>
                  {sessionPhase === "countdown" && countdown !== null && (
                    <AutoFlowCountdownOverlay countdown={countdown} />
                  )}
                  {sessionPhase === "calibrate" && calibration.state && (
                    <RehabCalibrationOverlay
                      state={calibration.state}
                      onStartAnyway={calibration.startAnyway}
                    />
                  )}
                  {sessionPhase === "complete" && <AutoFlowCompleteOverlay />}
                </RehabCameraShell>
              )}
              sidebar={(
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-400/40">Bilateral</span>
                    <Button variant="ghost" size="sm" onClick={() => setPhase("ready")}>Show reference</Button>
                  </div>
                  {REHAB_EXERCISE_IMAGES["side-bend"] && (
                    <div className="overflow-hidden rounded-md border border-border bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={REHAB_EXERCISE_IMAGES["side-bend"]} alt="Side Bend reference" loading="lazy" className="block w-full object-contain" style={{ maxHeight: 140 }} />
                      <p className="border-t border-border bg-surface px-2 py-1 text-center text-[10px] uppercase tracking-[0.12em] text-muted">Reference form</p>
                    </div>
                  )}
                  {sessionPhase === "countdown" && countdown !== null && (
                    <AutoFlowCountdownCard
                      countdown={countdown}
                      onSkip={skipCountdown}
                      hint="Patient facing the camera, standing neutral, arms relaxed."
                    />
                  )}
                  {(sessionPhase === "live" || sessionPhase === "complete") && (
                    <>
                      <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2">
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Time</p>
                          <p className="tabular text-2xl font-semibold leading-none text-white">
                            {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, "0")}
                          </p>
                        </div>
                        <p className="text-[10px] text-zinc-400">Reps auto-save at {TARGET_REPS}</p>
                      </div>
                      <div
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-all duration-200 ${
                          flash
                            ? "border-emerald-400 bg-emerald-500/20 ring-2 ring-emerald-400/60"
                            : "border-zinc-700 bg-zinc-900/80"
                        }`}
                      >
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Reps</p>
                          <p className="tabular text-3xl font-bold leading-none text-white">
                            {Math.min(reps, TARGET_REPS)}
                            <span className="text-lg font-semibold text-zinc-500"> / {TARGET_REPS}</span>
                          </p>
                        </div>
                        {flash ? (
                          <span className="rounded-full bg-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-100 ring-1 ring-emerald-400/50">+1 rep</span>
                        ) : reps >= TARGET_REPS ? (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">Complete</span>
                        ) : null}
                      </div>
                      {/* Which extremes are done for the CURRENT rep. */}
                      <div className="flex items-center gap-2">
                        {(["left", "right"] as const).map((s) => {
                          const done = visited[s];
                          return (
                            <span
                              key={s}
                              className={`flex-1 rounded-md border px-2 py-1.5 text-center text-[11px] font-semibold ${
                                done
                                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                                  : "border-zinc-700 bg-zinc-900/60 text-zinc-400"
                              }`}
                            >
                              {s === "left" ? "Left" : "Right"} {done ? "✓" : "…"}
                            </span>
                          );
                        })}
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted">
                        From standing, bend to the <strong>left</strong>,
                        back to centre, then to the <strong>right</strong>,
                        back to centre — that&apos;s 1 rep.
                      </p>
                    </>
                  )}
                  <div className="no-pdf">
                    {/* A prescribed session stashes this result and moves on;
                        the combined report saves at the end. A standalone
                        visit keeps today's per-exercise auto-save. */}
                    {seq.inSequence ? (
                      sessionPhase === "complete" && (
                        <SequenceNext seq={seq} buildPayload={buildRehabPayload} />
                      )
                    ) : (
                      <AutoFlowFooter
                        complete={sessionPhase === "complete"}
                        buildPayload={buildRehabPayload}
                        completeHint={`${TARGET_REPS} reps done — saving to record automatically.`}
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
                Camera at chest height, ~2 m away, perpendicular to
                the patient — <strong>frontal view</strong>. Both
                shoulders and both hips must stay clearly in frame
                across the full bend.
              </li>
              <li>
                Patient stands neutral, feet shoulder-width, arms
                relaxed at sides. Avoid forward bending (flexion) and
                rotation — keep the motion strictly lateral.
              </li>
              <li>
                Bend gently to one side (past ~{REP_REACH}°), return to
                centre, then to the other side, and back — one full
                left-and-right cycle counts as a rep. The Left/Right
                chips light up as you reach each side.
              </li>
              <li>
                The rep counter climbs with each full cycle; after
                {" "}{TARGET_REPS} reps the session auto-saves. Bend
                further (toward ~{MAX_BEND_DEG}°) for a fuller stretch.
              </li>
              <li>
                Keep the pelvis level — avoid hip-hiking to substitute
                for lateral flexion (we measure trunk-vs-pelvis tilt, so
                hiking won&apos;t register as a bend).
              </li>
            </ul>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}

function ReadyGate({ onStart }: { onStart: () => void }) {
  return (
    <div className="mt-10 max-w-xl">
      {REHAB_EXERCISE_IMAGES["side-bend"] && (
        <div className="mb-6 mx-auto max-w-md overflow-hidden rounded-md border border-border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={REHAB_EXERCISE_IMAGES["side-bend"]}
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
        Bilateral movement — bend left, back to centre, then right, back
        to centre = 1 rep. Do {TARGET_REPS} reps. Set up frontal to the
        camera, then begin.
      </p>
      <div className="mt-6">
        <Button onClick={onStart}>Begin</Button>
      </div>
    </div>
  );
}
