"use client";
// The calibration engine, held for one exercise page.
//
// Owns a CalibrationSession for the page's slug and side, feeds it the
// frames the page already receives in onFrame, and exposes what the
// page needs: the live state for the overlay, `done` for the phase
// machine, "Start anyway", and the summary for the saved payload.
//
// Lifecycle follows `active`, which the page sets to the same thing it
// hands useRehabAutoFlow as `started` (side picked / Begin pressed):
//
//   active false → no session, state null, frames ignored
//   active true  → a fresh session; frames drive it until done
//   done         → frames ignored; summary() is ready
//
// A page whose slug has no spec gets `enabled: false` and everything
// is a no-op, so wiring is safe on every page even before its row
// exists.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { LiveKeypoint } from "@/hooks/usePoseDetectionLive";
import {
  CalibrationSession,
  type CalibrationSummary,
  type SessionState,
} from "@/lib/rehab/calibration/session";
import type { Side } from "@/lib/rehab/calibration/signals";
import { calibrationSpec } from "@/lib/rehab/calibration/specs";

export interface RehabCalibration {
  /** False when the slug has no spec; every member is then inert. */
  enabled: boolean;
  /** For the overlay. Null before the first frame and after reset. */
  state: SessionState | null;
  /** All holds recorded or skipped. useRehabAutoFlow waits on this. */
  done: boolean;
  /** Call first thing in the page's onFrame. */
  feed: (kp: LiveKeypoint[], video: HTMLVideoElement) => void;
  /** "Start anyway": give up on the current hold and move on. */
  startAnyway: () => void;
  /** For metrics.calibration. Null when not enabled or never run. */
  summary: () => CalibrationSummary | null;
}

const INERT: RehabCalibration = {
  enabled: false,
  state: null,
  done: true,
  feed: () => {},
  startAnyway: () => {},
  summary: () => null,
};

export function useRehabCalibration(
  slug: string,
  side: Side | null,
  active: boolean,
): RehabCalibration {
  const spec = useMemo(() => calibrationSpec(slug), [slug]);
  const sessionRef = useRef<CalibrationSession | null>(null);
  const [state, setState] = useState<SessionState | null>(null);

  // A new session whenever the gate opens or the side changes; none
  // while the gate is closed. Resetting here rather than in feed()
  // means a page that picks a side, exits, and picks the other side
  // calibrates again from scratch — which it must, since the working
  // limb changed.
  useEffect(() => {
    if (!active || !spec) {
      sessionRef.current = null;
      setState(null);
      return;
    }
    const session = new CalibrationSession(spec, side);
    sessionRef.current = session;
    setState(session.state);
  }, [active, spec, side]);

  const feed = useCallback(
    (kp: LiveKeypoint[], video: HTMLVideoElement) => {
      const session = sessionRef.current;
      if (!session || session.state.done) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w <= 0 || h <= 0) return;
      // One state update per frame. The pages already set a live angle
      // per frame, so this adds no render the page was not doing.
      setState(session.feed(kp, { w, h }, performance.now()));
    },
    [],
  );

  const startAnyway = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.state.done) return;
    session.skipHold();
    setState(session.state);
  }, []);

  const summary = useCallback((): CalibrationSummary | null => {
    const session = sessionRef.current;
    if (!session) return null;
    return session.summary(performance.now());
  }, []);

  if (!spec) return INERT;

  return {
    enabled: true,
    state,
    done: state?.done ?? false,
    feed,
    startAnyway,
    summary,
  };
}
