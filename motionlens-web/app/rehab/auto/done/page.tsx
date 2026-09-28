"use client";
// End of a prescribed session — the one place the combined report is
// written.
//
// Every exercise in the session stashed its own payload and moved on
// without saving (see lib/rehab/sequence.ts). This screen collects
// them and files ONE report:
//
//   { module: "rehab", movement: "batch",
//     metrics: { is_batch: true, items: [...] } }
//
// which is the same shape Biomechanics Auto Mode uses, and which
// app/dashboard/reports/[id]/page.tsx routes to RehabBatchBody.
//
// Two rules the arrangement depends on:
//
//   • The stash is cleared ONLY after the save succeeds. A failed
//     save leaves everything in place so Retry has something to send,
//     and a patient who did five exercises never loses five exercises
//     to one bad request.
//
//   • Stopping early is not an error. Whatever was completed is
//     saved, and the report records that the session ended short — a
//     patient who stopped after four of five did four exercises.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Undo2,
} from "lucide-react";

import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { usePatientContext } from "@/hooks/usePatientContext";
import { deleteReport } from "@/lib/reports";
import {
  SEQ_PARAM,
  SID_PARAM,
  STOPPED_PARAM,
  clearStash,
  decodeSequence,
  readStash,
  titleOfSlug,
  type SequenceStep,
  type StashedItem,
} from "@/lib/rehab/sequence";

export default function RehabSessionDonePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; reportId: string }
  | { kind: "undone" }
  | { kind: "error"; message: string };

function Inner() {
  const params = useSearchParams();
  const { isDoctorFlow, patient, patientId, saveReport } = usePatientContext();

  const sid = params.get(SID_PARAM);
  const steps = useMemo(() => decodeSequence(params.get(SEQ_PARAM)), [params]);
  const stoppedEarly = params.get(STOPPED_PARAM) === "1";

  // Read the stash exactly once. Re-reading after the save cleared it
  // would blank the summary the doctor is looking at.
  const [items] = useState<StashedItem[]>(() => (sid ? readStash(sid) : []));

  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const firedRef = useRef(false);

  const buildPayload = useCallback(() => {
    const done = items.length;
    const total = steps.length;
    return {
      module: "rehab" as const,
      // The slug slot holds "batch" for a session, exactly as the
      // biomech batch row does. Per-exercise slugs live on the items.
      movement: "batch",
      metrics: {
        is_batch: true,
        session: "prescribed",
        prescribed_count: total,
        completed_count: done,
        stopped_early: stoppedEarly,
        items: items.map((it) => ({
          exercise_slug: it.slug,
          side: it.side,
          metrics: it.metrics,
          observations: it.observations,
        })),
      },
      observations: {
        interpretation:
          `${done} of ${total} prescribed exercise${total === 1 ? "" : "s"} completed`
          + (stoppedEarly ? " — session ended early." : "."),
      },
    };
  }, [items, steps.length, stoppedEarly]);

  const save = useCallback(async () => {
    setState({ kind: "saving" });
    const out = await saveReport(buildPayload());
    if (out.ok && out.reportId) {
      // Only now — a cleared stash plus a failed save is an
      // unrecoverable session.
      if (sid) clearStash(sid);
      setState({ kind: "saved", reportId: out.reportId });
    } else {
      setState({
        kind: "error",
        message: out.message || "Could not save the session report.",
      });
    }
  }, [saveReport, buildPayload, sid]);

  // Fire once on mount. Nothing to save in the public flow, or when
  // the session recorded no completed exercise.
  useEffect(() => {
    if (firedRef.current) return;
    if (!isDoctorFlow) return;
    if (items.length === 0) return;
    firedRef.current = true;
    void save();
  }, [isDoctorFlow, items.length, save]);

  const onUndo = useCallback(async () => {
    if (state.kind !== "saved") return;
    const id = state.reportId;
    setState({ kind: "saving" });
    try {
      await deleteReport(id);
      setState({ kind: "undone" });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Undo failed.",
      });
    }
  }, [state]);

  const backHref = patientId
    ? `/dashboard/patients/${patientId}/rehab`
    : "/rehab";

  return (
    <>
      <Nav />
      <main className="flex flex-col">
        <Section className="pt-32 md:pt-40">
          <Badge>Prescribed session</Badge>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
            {stoppedEarly ? "Session ended" : "Session complete"}
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            {items.length} of {steps.length} prescribed exercise
            {steps.length === 1 ? "" : "s"} completed
            {patient ? ` for ${patient.name}` : ""}.
            {stoppedEarly && items.length > 0
              ? " Everything completed before stopping is kept."
              : ""}
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <SessionList items={items} steps={steps} />
            <div className="space-y-4">
              <SaveCard
                state={state}
                isDoctorFlow={isDoctorFlow}
                empty={items.length === 0}
                patientName={patient?.name ?? null}
                patientId={patientId}
                onRetry={save}
                onUndo={onUndo}
              />
              <Link href={backHref}>
                <Button variant="secondary" className="w-full">
                  {patientId ? "Back to rehab" : "Back to catalogue"}
                </Button>
              </Link>
            </div>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}

/** Every prescribed exercise, marked done or not reached. Ordered by
 *  the prescription, not by what happened, so a doctor can see which
 *  one the session stopped at. */
function SessionList({
  items,
  steps,
}: {
  items: StashedItem[];
  steps: SequenceStep[];
}) {
  // By queue position: the same exercise can appear twice, once per
  // side, and finishing one of them does not finish the other.
  const byIndex = new Map(items.map((it) => [it.index, it]));
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted" />
        <p className="text-sm font-semibold text-foreground">
          Prescribed exercises
        </p>
      </div>
      <ul className="mt-4 space-y-2">
        {steps.map((step, i) => {
          const item = byIndex.get(i);
          const done = item !== undefined;
          // Prefer the side actually worked; fall back to the one
          // prescribed, so a step that was never reached still shows
          // what it was set to.
          const shownSide = item?.side ?? step.side;
          return (
            <li
              key={`${step.slug}:${step.side ?? ""}:${i}`}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm text-foreground">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border border-border" />
                )}
                {titleOfSlug(step.slug)}
              </span>
              <span className="text-xs text-muted">
                {done
                  ? shownSide
                    ? `${shownSide === "left" ? "Left" : "Right"} side`
                    : "Completed"
                  : shownSide
                    ? `Not reached · ${shownSide}`
                    : "Not reached"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SaveCard({
  state,
  isDoctorFlow,
  empty,
  patientName,
  patientId,
  onRetry,
  onUndo,
}: {
  state: SaveState;
  isDoctorFlow: boolean;
  empty: boolean;
  patientName: string | null;
  patientId: string | null;
  onRetry: () => void;
  onUndo: () => void;
}) {
  if (!isDoctorFlow) {
    return (
      <div className="rounded-card border border-border bg-surface p-4 text-sm text-muted">
        Nice session. Nothing is saved outside a patient record.
      </div>
    );
  }
  if (empty) {
    return (
      <div className="rounded-card border border-border bg-surface p-4 text-sm text-muted">
        No exercise was completed, so nothing was saved.
      </div>
    );
  }

  if (state.kind === "saving" || state.kind === "idle") {
    return (
      <div className="flex items-center gap-2 rounded-card border border-border bg-surface p-4 text-sm">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
        <span className="text-foreground">
          Saving session to {patientName ?? "the patient"}&apos;s record…
        </span>
      </div>
    );
  }

  if (state.kind === "saved") {
    return (
      <div className="rounded-card border-2 border-emerald-500/50 bg-emerald-500/10 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">
              Session report saved ✓
            </p>
            <p className="mt-0.5 text-xs text-muted">
              One combined report in {patientName ?? "the patient"}&apos;s
              record.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/dashboard/reports/${state.reportId}`}>
            <Button size="sm">View report</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onUndo}>
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </Button>
        </div>
      </div>
    );
  }

  if (state.kind === "undone") {
    return (
      <div className="rounded-card border border-border bg-surface p-4 text-sm text-muted">
        Save undone — this session was deleted.
        {patientId && (
          <>
            {" "}
            <Link
              href={`/dashboard/patients/${patientId}`}
              className="text-accent hover:underline"
            >
              View patient
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-card border border-error/40 bg-error/5 p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Could not save the session
          </p>
          <p className="mt-0.5 text-xs text-muted">{state.message}</p>
          <p className="mt-1 text-xs text-muted">
            Nothing was lost — the results are still held in this tab.
            Keep it open and try again.
          </p>
        </div>
      </div>
      <Button className="mt-3" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
