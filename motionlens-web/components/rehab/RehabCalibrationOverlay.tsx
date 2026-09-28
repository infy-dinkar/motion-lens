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

import { AlertTriangle, Check, Circle, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { SessionState } from "@/lib/rehab/calibration/session";

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;

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
  const dash = RING_C * (1 - Math.min(1, Math.max(0, state.progress)));

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-black/25 p-4 text-white">
      {/* Top: which hold, what to do. */}
      <div className="rounded-card bg-black/60 px-4 py-3 backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
          Calibration · Hold {state.holdIndex + 1} of {state.total} — {hold.title}
        </p>
        <p className="mt-1 text-lg font-semibold leading-snug">{hold.instruction}</p>
      </div>

      {/* Centre: the ring and the one message. */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 128 128" className="h-32 w-32 -rotate-90">
            <circle cx="64" cy="64" r={RING_R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="8" />
            <circle
              cx="64"
              cy="64"
              r={RING_R}
              fill="none"
              stroke={blocked ? "rgb(251 191 36)" : "rgb(52 211 153)"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={dash}
              style={{ transition: "stroke-dashoffset 120ms linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="tabular text-2xl font-semibold">
              {Math.round(state.progress * 100)}%
            </span>
          </div>
        </div>
        <p
          className={`rounded-full px-4 py-1.5 text-sm font-medium backdrop-blur ${
            blocked ? "bg-amber-500/25 text-amber-100" : "bg-black/60 text-white"
          }`}
        >
          {state.message}
        </p>
      </div>

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

function labelOf(id: SessionState["checks"][number]["id"]): string {
  switch (id) {
    case "visible": return "In view";
    case "inFrame": return "Fully in frame";
    case "view": return "Facing the right way";
    case "facing": return "Correct side";
    case "distance": return "Distance";
  }
}
