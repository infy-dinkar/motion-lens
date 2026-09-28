"use client";
// Where a prescribed session's state comes from when the exercises are
// NOT separate routes.
//
// The first arrangement moved between exercises with router.push, one
// route per exercise. That was clean but unusably slow: a route change
// took tens of seconds on the finished exercise before the next one
// appeared, in a production build as well as in dev. Biomechanics Auto
// Mode has never had the problem because it never navigates — it keeps
// one route and swaps the mounted component by `key`.
//
// So a session now runs inside one route too, and the position in the
// queue has to reach the exercise some other way than the URL. That is
// this context.
//
// useRehabSequence prefers it and falls back to the URL, which means a
// standalone visit to /rehab/<slug> is completely unaffected: no
// provider, no context, and the hook reports "not in a session"
// exactly as before.

import { createContext, useContext } from "react";

import type { RehabSequence } from "@/lib/rehab/useSequence";

const SequenceContext = createContext<RehabSequence | null>(null);

export function SequenceProvider({
  value,
  children,
}: {
  value: RehabSequence;
  children: React.ReactNode;
}) {
  return (
    <SequenceContext.Provider value={value}>
      {children}
    </SequenceContext.Provider>
  );
}

/** The running session, or null when this exercise was opened on its
 *  own. */
export function useSequenceContext(): RehabSequence | null {
  return useContext(SequenceContext);
}
