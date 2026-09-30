"use client";
// What the patient sees during calibration.
//
// Rendered inside RehabCameraShell's children slot, over the skeleton,
// so every exercise gets the same screen without the shell changing:
//
//   top     which hold this is and what to do
//   centre  the ring — stillness filling it, the block reason under it
//   bottom  the checklist, a distance note, and "Start anyway" once the
//           hold has run long enough
//
// After the last hold the caller passes `countdown` and the same
// surface shows the 3-2-1 instead. Nothing here computes anything; it
// draws a SessionState.

import { useState } from "react";
import { AlertTriangle, Check, Circle, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/Button";
// The same ring the Games calibration uses, so a patient who has done
// both sees one thing: a lime circle that closes as they hold still and
// counts the seconds left in the middle.
import { ProgressRing } from "@/components/games/gameUi";
import { STILL_TOLERANCE } from "@/lib/rehab/calibration/holdTracker";
import type { SessionState } from "@/lib/rehab/calibration/session";
import { HOLD_MS } from "@/lib/rehab/calibration/specs";

export function RehabCalibrationOverlay({
  state,
  countdown,
  onStartAnyway,
}: {
  state: SessionState;
  /** Set once calibration is done: the 3-2-1 before the exercise. */
  countdown?: number | null;
  onStartAnyway: () => void;
}) {
  // ?rehabdebug=1 shows the numbers behind every decision. Read once:
  // the overlay only exists on the client, after the camera is up.
  const [debugOn] = useState(
    () =>
      typeof window !== "undefined"
      && new URLSearchParams(window.location.search).get("rehabdebug") === "1",
  );

  if (countdown !== null && countdown !== undefined) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
        <div className="rounded-full bg-black/70 px-10 py-6 text-center text-white shadow-2xl ring-2 ring-white/20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Calibrated — starting in
          </p>
          <p className="tabular text-7xl font-semibold leading-none">{countdown}</p>
        </div>
      </div>
    );
  }

  const { hold } = state;
  if (!hold) return null;

  const blocked = state.status === "blocked";
  // Lime while the ring is filling; grey when it is paused or waiting.
  const active = state.status === "holding" || state.status === "drifted";

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-black/25 p-4 text-white">
      {/* Top: which hold, what to do. */}
      <div className="rounded-card bg-black/60 px-4 py-3 backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
          Calibration · Hold {state.holdIndex + 1} of {state.total} — {hold.title}
        </p>
        <p className="mt-1 text-lg font-semibold leading-snug">{hold.instruction}</p>
      </div>

      {/* Centre: the ring and the one message — laid out as the Games
          calibrate screen is. The ring never changes silently: paused,
          drifted and idle each say what is happening. */}
      <div className="flex flex-col items-center gap-3">
        <ProgressRing progress={state.progress} active={active} holdMs={HOLD_MS} />
        <p
          className={`max-w-xl rounded-card px-4 py-1.5 text-center backdrop-blur ${
            blocked
              ? "bg-black/60 text-2xl font-semibold text-amber-300"
              : "bg-black/50 text-lg text-white/80"
          }`}
        >
          {state.message}
        </p>
        {blocked && state.progress > 0 && (
          <p className="rounded-full bg-black/50 px-3 py-1 text-sm text-white/60">
            Timer paused at {Math.round(state.progress * 100)}% — it will carry on from here.
          </p>
        )}
      </div>

      {debugOn && <DebugReadout state={state} />}

      {/* Bottom: checklist, distance note, escape hatch. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 rounded-card bg-black/60 px-4 py-2 text-xs backdrop-blur">
          {state.checks.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5">
              {c.ok ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : c.blocking ? (
                <Circle className="h-3.5 w-3.5 text-amber-300" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
              )}
              <span className={c.ok ? "text-white/70" : "text-white"}>{labelOf(c.id)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col items-end gap-2">
          {state.warn && (
            <p className="rounded-full bg-black/60 px-3 py-1 text-xs text-amber-200 backdrop-blur">
              {state.warn}
            </p>
          )}
          {state.canStartAnyway && (
            <div className="pointer-events-auto">
              <Button size="sm" variant="secondary" onClick={onStartAnyway}>
                <SkipForward className="h-3.5 w-3.5" />
                Start anyway
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Everything the current decision rests on, as raw numbers. */
function DebugReadout({ state }: { state: SessionState }) {
  const d = state.debug;
  const f = (v: number | null | undefined, digits = 2) =>
    v === null || v === undefined ? "—" : v.toFixed(digits);
  const delta =
    state.value !== null && d.rest !== null ? Math.abs(state.value - d.rest) : null;
  return (
    <div className="pointer-events-none absolute left-4 top-24 rounded-md bg-black/75 px-3 py-2 font-mono text-[11px] leading-relaxed text-emerald-100 backdrop-blur">
      <div>hold {state.holdIndex + 1}/{state.total} · {state.status} · {Math.round(state.progress * 100)}%</div>
      <div>msg: {state.message || "—"}</div>
      <div>value {f(state.value, 1)} · rest {f(d.rest, 1)} · Δ {f(delta, 1)} (need ≥ {d.minDelta})</div>
      <div>drift {f(d.drift, 3)} (reset &gt; {STILL_TOLERANCE})</div>
      <div>view ratio {f(d.viewRatio)} · facing diff {f(d.facingDiff)} · scale {f(d.scale, 3)}</div>
      {d.extra && <div>{d.extra}</div>}
      <div>
        {state.checks.map((c) => `${c.id}:${c.ok ? "ok" : "FAIL"}`).join("  ")}
      </div>
      <div>elapsed {(state.elapsedMs / 1000).toFixed(1)}s</div>
    </div>
  );
}

function labelOf(id: SessionState["checks"][number]["id"]): string {
  switch (id) {
    case "visible": return "In view";
    case "inFrame": return "Fully in frame";
    case "view": return "Facing the right way";
    case "facing": return "Correct side";
    case "distance": return "Distance";
  }
}
