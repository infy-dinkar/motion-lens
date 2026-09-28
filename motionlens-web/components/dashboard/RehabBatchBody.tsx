"use client";
// Combined rehab report — one prescribed session, several exercises.
//
// Same arrangement as BiomechBatchBody in the report route: the saved
// row carries `is_batch` plus an `items` array, and each item is
// handed to the SAME single-session renderer the standalone reports
// use. Nothing about how an exercise is rendered lives here — only
// how a list of them is stacked and summarised.
//
// That matters more than it looks. SavedRehabReport switches on
// `mechanic_id` and knows all seven mechanics; duplicating any of
// that here would mean a rep-count session rendered one way inside a
// session and another way on its own.

import { ClipboardList } from "lucide-react";

import { SavedRehabReport } from "@/components/dashboard/SavedRehabReport";
import type { PatientDTO } from "@/lib/patients";

interface BatchItem {
  metrics: Record<string, unknown>;
  observations: Record<string, unknown>;
}

/** Does this saved rehab row hold a prescribed session rather than a
 *  single exercise? Used by the report route to pick a renderer. */
export function isRehabBatch(metrics: unknown): boolean {
  if (!metrics || typeof metrics !== "object") return false;
  const m = metrics as Record<string, unknown>;
  return m.is_batch === true && Array.isArray(m.items);
}

function normalise(raw: unknown): BatchItem | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const metrics =
    e.metrics && typeof e.metrics === "object" && !Array.isArray(e.metrics)
      ? (e.metrics as Record<string, unknown>)
      : null;
  // An item with no metrics has nothing for the mechanic renderer to
  // show. Drop it rather than rendering an empty card — and rather
  // than crashing the whole report, which is what the single-session
  // renderer would do with a missing mechanic_id.
  if (!metrics) return null;
  const observations =
    e.observations
    && typeof e.observations === "object"
    && !Array.isArray(e.observations)
      ? (e.observations as Record<string, unknown>)
      : {};
  return { metrics, observations };
}

export function RehabBatchBody({
  metrics,
  patient,
  patientName,
  patientId,
  dateStr,
}: {
  metrics: Record<string, unknown>;
  patient: PatientDTO | null;
  patientName: string | null;
  patientId: string;
  dateStr: string;
}) {
  const rawItems = Array.isArray(metrics.items) ? metrics.items : [];
  const items = rawItems
    .map(normalise)
    .filter((it): it is BatchItem => it !== null);

  // How many the doctor prescribed, versus how many were actually
  // played. They differ when the session was stopped early, and the
  // report says so rather than quietly showing a short list.
  const prescribed =
    typeof metrics.prescribed_count === "number"
      ? metrics.prescribed_count
      : null;
  const stoppedEarly = metrics.stopped_early === true;

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-warning/40 bg-warning/5 p-5 text-sm">
        <p className="font-semibold text-foreground">
          No exercise results in this session
        </p>
        <p className="mt-1 text-muted">
          The session was recorded but no exercise was completed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="rounded-card border border-border bg-surface px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-orange-500/10 text-orange-700 dark:text-orange-400">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {patientName?.trim() || "Anonymous patient"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Prescribed rehab session · {items.length} exercise
              {items.length === 1 ? "" : "s"} completed
              {prescribed !== null && prescribed !== items.length
                ? ` of ${prescribed} prescribed`
                : ""}
              {stoppedEarly ? " · ended early" : ""} · {dateStr}
            </p>
          </div>
        </div>
      </div>

      {items.map((it, i) => (
        <div
          key={i}
          className="border-t border-border pt-8 first:border-t-0 first:pt-0"
        >
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
            Exercise {i + 1} of {items.length}
          </p>
          <SavedRehabReport
            patientName={patientName}
            patient={patient}
            metrics={it.metrics}
            observations={it.observations}
          />
        </div>
      ))}

      <div className="border-t border-border pt-6">
        <a
          href={`/dashboard/patients/${patientId}`}
          className="text-sm text-accent hover:underline"
        >
          ← Back to patient
        </a>
      </div>
    </div>
  );
}
