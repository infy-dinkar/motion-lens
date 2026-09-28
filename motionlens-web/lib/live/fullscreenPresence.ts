// When to leave browser fullscreen.
//
// LiveModeLayout puts the page into fullscreen while an exercise or a
// live test is running, and has to give it back when that ends. The
// obvious rule — exit when the layout unmounts — is wrong, because a
// layout unmounting is not the same as the live view going away:
//
//   • A prescribed rehab session swaps one exercise component for the
//     next. The outgoing layout unmounts and the incoming one mounts a
//     few milliseconds later.
//   • React StrictMode in development mounts, synthetically unmounts,
//     and remounts every component once. Fast Refresh and Suspense
//     retries do similar things.
//
// In all of those the browser must stay in fullscreen, and it cannot be
// asked for it again afterwards: requestFullscreen only succeeds inside
// a user-activation window, and none of these carry a click.
//
// So the exit is deferred by a short grace period, and cancelled if any
// layout mounts before it fires. A genuine exit — the patient's own
// Exit button, Back, the end of a session — has nothing arriving in
// that window, and fullscreen drops half a second later. A swap or a
// remount always does, and fullscreen holds.

/** How long an unmounted layout waits for a successor before letting
 *  fullscreen go. Comfortably longer than the gap in a session swap
 *  (~100 ms on a slow machine), comfortably shorter than anything a
 *  person would notice as a delay. */
const EXIT_GRACE_MS = 500;

let live = 0;
let pendingExit: number | null = null;

function cancelPendingExit(): void {
  if (pendingExit !== null) {
    window.clearTimeout(pendingExit);
    pendingExit = null;
  }
}

/** A fullscreen-owning layout is on screen. Cancels any exit that a
 *  just-departed layout had scheduled. */
export function liveLayoutMounted(): void {
  live += 1;
  cancelPendingExit();
}

/** A fullscreen-owning layout has gone. Schedules the exit, to be
 *  cancelled if another layout arrives first. */
export function liveLayoutUnmounted(): void {
  live = Math.max(0, live - 1);
  cancelPendingExit();
  pendingExit = window.setTimeout(() => {
    pendingExit = null;
    if (live === 0 && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, EXIT_GRACE_MS);
}
