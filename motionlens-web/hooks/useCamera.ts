"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Every mounted useCamera registers its stop() here.
 *
 * Only for the case where something is about to leave the page and
 * wants the device (and the inference loop feeding on it) released
 * first — see stopAllCameras. Normal teardown still happens on
 * unmount and does not go through this.
 */
const liveStops = new Set<() => void>();

/**
 * Release every camera currently open on the page.
 *
 * Called by a flow that is navigating away deliberately. It is safe
 * to call when nothing is open, and a component that stops this way
 * still runs its own unmount cleanup afterwards — stop() is
 * idempotent.
 */
export function stopAllCameras(): void {
  for (const stop of Array.from(liveStops)) stop();
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setActive(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Camera access denied";
      setError(msg);
      setActive(false);
    }
  }, []);

  useEffect(() => stop, [stop]);

  // Join the registry for as long as this instance is mounted.
  useEffect(() => {
    liveStops.add(stop);
    return () => {
      liveStops.delete(stop);
    };
  }, [stop]);

  return { videoRef, streamRef, active, error, start, stop };
}
