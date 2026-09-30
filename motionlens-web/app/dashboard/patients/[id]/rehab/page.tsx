"use client";
// Dashboard rehab launcher — parallel to /analyze/page.tsx. Shows
// the rehab exercise catalogue with the patient context already
// attached, so any session played from here saves against the
// patient's record.
//
// Exercise definitions live in the shared lib/rehab/exerciseCatalog
// so this page and the public /rehab catalogue stay in sync.
//
// Auto-recommendations: on mount we call useRecommendations(patientId)
// which reads getPrescribedSet — today that returns the auto ranked
// set, later it will prefer a doctor-saved prescription without any
// UI change here.

import { useCallback, useEffect, useMemo, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, LineChart, Pencil, PlayCircle, Sparkles, X } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/Button";
import { REHAB_EXERCISE_IMAGES } from "@/lib/rehab/exerciseImages";
import {
  JOINT_META,
  JOINT_ORDER,
  groupExercisesByJoint,
  visibleExercises,
} from "@/lib/rehab/exerciseCatalog";
import { ISSUE_CODES, issueOf } from "@/lib/rehab/issueCodes";
import { useRecommendations } from "@/lib/rehab/useRecommendations";
import { PrescriptionEditor } from "@/components/rehab/PrescriptionEditor";
import { getPatient, type PatientDTO } from "@/lib/patients";
import {
  encodeSequence,
  newSequenceId,
  runnerUrl,
  type SequenceStep,
} from "@/lib/rehab/sequence";

export default function PatientRehabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  return (
    <AuthGuard>
      <DashboardShell
        backHref={`/dashboard/patients/${id}`}
        backLabel="Patient"
      >
        <Content patientId={id} />
      </DashboardShell>
    </AuthGuard>
  );
}

function Content({ patientId }: { patientId: string }) {
  const groups = useMemo(() => groupExercisesByJoint(), []);
  const recs = useRecommendations(patientId);

  // Browse filter: by joint (the default, as before) or by issue, and
  // optionally narrowed to one joint and/or one issue. The prescribed
  // strip above is never filtered.
  const [view, setView] = useState<"joint" | "issue">("joint");
  const [joint, setJoint] = useState<string>("all");
  const [issue, setIssue] = useState<string>("all");
  const router = useRouter();

  // Start the whole prescribed list as one session. The queue is the
  // recommendation order — doctor-authored when a prescription exists,
  // auto-ranked otherwise — and it is handed to the first exercise's
  // own page rather than to a runner, because the exercise pages own
  // the screen. See lib/rehab/sequence.ts.
  //
  // Side is NOT chosen here: every exercise asks for its own, using
  // the picker it already ships with (and marching for its duration).
  const startSession = useCallback(() => {
    // One step per prescribed SIDE, not per exercise: an exercise set
    // to both sides has to run twice, because the session has no
    // picker and a single step could only ever train one of them.
    //
    // Where no side was prescribed the step carries null and the page
    // asks, exactly as a standalone visit does — that covers bilateral
    // exercises and any prescription written before sides existed.
    const steps: SequenceStep[] = recs.recommended.flatMap((r) => {
      const sides = recs.sides[r.slug];
      if (!sides || sides.length === 0) {
        return [{ slug: r.slug, side: null }] as SequenceStep[];
      }
      return sides.map((side) => ({ slug: r.slug, side }));
    });
    if (steps.length === 0) return;
    // One route for the whole session — see app/rehab/auto/run. Moving
    // between exercises by route cost tens of seconds each time.
    const seq = encodeSequence(steps);
    router.push(runnerUrl({ patientId, seq, sid: newSequenceId() }));
  }, [recs.recommended, recs.sides, patientId, router]);

  const [patient, setPatient] = useState<PatientDTO | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getPatient(patientId)
      .then((p) => {
        if (!cancelled) setPatient(p);
      })
      .catch(() => {
        // Non-fatal — recommender strip degrades to generic wording.
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Choose rehab game</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            Which mechanic are we playing today?
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Pick a game. Session scores save automatically against this
            patient&apos;s record.
          </p>
        </div>
        <Link href={`/dashboard/patients/${patientId}/rehab/progress`}>
          <Button variant="secondary" size="sm">
            <LineChart className="h-4 w-4" />
            Progress
          </Button>
        </Link>
      </div>

      <RecommendedStrip
        recs={recs}
        patientName={patient?.name ?? null}
        onEdit={() => setEditing(true)}
        onStart={startSession}
      />

      {editing && (
        <PrescriptionEditor
          patientName={patient?.name ?? null}
          currentSlugs={recs.slugs}
          currentSides={recs.sides}
          source={recs.source}
          reasonsBySlug={recs.bySlug}
          saving={recs.saving}
          onSave={recs.save}
          onReset={recs.reset}
          onClose={() => setEditing(false)}
        />
      )}

      <ExerciseBrowser
        groups={groups}
        recs={recs}
        patientId={patientId}
        view={view}
        joint={joint}
        issue={issue}
        onView={(v) => {
          setView(v);
          // By issue has no joint filter: its sections are the issues.
          if (v === "issue") setJoint("all");
        }}
        onJoint={(j) => {
          setJoint(j);
          // An issue no exercise in the new joint carries would show an
          // empty page; drop it back to all.
          if (j !== "all" && issue !== "all") {
            const inJoint = visibleExercises().some(
              (e) => e.joint === j && (e.issues ?? []).includes(issue),
            );
            if (!inJoint) setIssue("all");
          }
        }}
        onIssue={setIssue}
        onClear={() => {
          setView("joint");
          setJoint("all");
          setIssue("all");
        }}
      />
    </div>
  );
}

// ─── Exercise browser: filter bar + cards ───────────────────────

type Recs = ReturnType<typeof useRecommendations>;
type Groups = ReturnType<typeof groupExercisesByJoint>;
type Exercise = Groups[number]["items"][number];

function ExerciseBrowser({
  groups,
  recs,
  patientId,
  view,
  joint,
  issue,
  onView,
  onJoint,
  onIssue,
  onClear,
}: {
  groups: Groups;
  recs: Recs;
  patientId: string;
  view: "joint" | "issue";
  joint: string;
  issue: string;
  onView: (v: "joint" | "issue") => void;
  onJoint: (j: string) => void;
  onIssue: (i: string) => void;
  onClear: () => void;
}) {
  const all = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Issue options: only issues some exercise carries, narrowed to the
  // chosen joint, in the PDF's order.
  const issueOptions = useMemo(() => {
    const pool = joint === "all" ? all : all.filter((e) => e.joint === joint);
    const used = new Set(pool.flatMap((e) => e.issues ?? []));
    return ISSUE_CODES.filter((i) => used.has(i.code));
  }, [all, joint]);

  const matches = useMemo(
    () =>
      all.filter(
        (e) =>
          (joint === "all" || e.joint === joint)
          && (issue === "all" || (e.issues ?? []).includes(issue)),
      ),
    [all, joint, issue],
  );

  // Recommended first, as before.
  const byScore = useCallback(
    (a: Exercise, b: Exercise) => {
      const scoreA = recs.bySlug.get(a.slug)?.score ?? -Infinity;
      const scoreB = recs.bySlug.get(b.slug)?.score ?? -Infinity;
      if (scoreA === scoreB) return 0;
      return scoreB - scoreA;
    },
    [recs.bySlug],
  );

  const sections = useMemo(() => {
    if (view === "joint") {
      return JOINT_ORDER.map((j) => ({
        key: j,
        title: JOINT_META[j as keyof typeof JOINT_META].label,
        subtitle: JOINT_META[j as keyof typeof JOINT_META].subtitle,
        items: matches.filter((e) => e.joint === j).sort(byScore),
      })).filter((sec) => sec.items.length > 0);
    }
    const codes = issue === "all" ? issueOptions.map((i) => i.code) : [issue];
    return codes
      .map((code) => {
        const info = issueOf(code);
        return {
          key: code,
          title: `${code} · ${info?.label ?? code}`,
          subtitle: info?.region ?? "",
          items: matches.filter((e) => (e.issues ?? []).includes(code)).sort(byScore),
        };
      })
      .filter((sec) => sec.items.length > 0);
  }, [view, matches, issue, issueOptions, byScore]);

  const filtered = view !== "joint" || joint !== "all" || issue !== "all";
  const selectClass =
    "rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface/60 p-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">View</p>
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(["joint", "issue"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onView(v)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                  view === v ? "bg-accent text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {v === "joint" ? "By joint" : "By issue"}
              </button>
            ))}
          </div>
        </div>
        {view === "joint" && (
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">Joint</span>
          <select value={joint} onChange={(e) => onJoint(e.target.value)} className={selectClass}>
            <option value="all">All joints</option>
            {JOINT_ORDER.map((j) => (
              <option key={j} value={j}>
                {JOINT_META[j as keyof typeof JOINT_META].label}
              </option>
            ))}
          </select>
        </label>
        )}
        <label className="min-w-0 flex-1 sm:max-w-sm">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">Issue</span>
          <select value={issue} onChange={(e) => onIssue(e.target.value)} className={`${selectClass} w-full`}>
            <option value="all">All issues</option>
            {issueOptions.map((i) => (
              <option key={i.code} value={i.code}>
                {i.code} · {i.label}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <Button variant="secondary" size="sm" onClick={onClear}>
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
        <p className="ml-auto text-sm text-muted">
          {matches.length} exercise{matches.length === 1 ? "" : "s"}
        </p>
      </div>

      {sections.length === 0 ? (
        <p className="rounded-card border border-border bg-surface/60 p-8 text-center text-sm text-muted">
          No exercises for this filter.
        </p>
      ) : (
        <div className="space-y-12">
          {sections.map((sec) => (
            <section key={sec.key}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{sec.title}</h2>
                <p className="text-xs text-muted">{sec.subtitle}</p>
              </div>
              <div className="mt-4 grid gap-5 md:grid-cols-3">
                {sec.items.map((m) => (
                  <ExerciseCard
                    key={m.slug}
                    m={m}
                    rec={recs.bySlug.get(m.slug)}
                    patientId={patientId}
                    highlight={issue !== "all" ? issue : view === "issue" ? sec.key : null}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** How many tags a card shows before "+N". */
const MAX_CARD_TAGS = 4;

function ExerciseCard({
  m,
  rec,
  patientId,
  highlight,
}: {
  m: Exercise;
  rec: ReturnType<Recs["bySlug"]["get"]>;
  patientId: string;
  /** Issue the view is about: shown first and marked on this card. */
  highlight: string | null;
}) {
  const Icon = m.icon;
  const href = `/rehab/${m.slug}?patientId=${patientId}`;
  const imageUrl = REHAB_EXERCISE_IMAGES[m.slug];
  const isRecommended = Boolean(rec);
  const tags = m.issues ?? [];
  const ordered = highlight && tags.includes(highlight)
    ? [highlight, ...tags.filter((t) => t !== highlight)]
    : tags;
  const shown = ordered.slice(0, MAX_CARD_TAGS);
  const rest = ordered.slice(MAX_CARD_TAGS);
  const sharedClass = `group relative flex flex-col overflow-hidden rounded-hero border ${
    isRecommended
      ? "border-accent/60 shadow-glow-sm ring-1 ring-accent/20"
      : "border-border"
  } bg-gradient-to-br ${m.tone} p-6 transition md:p-8 hover:border-accent hover:shadow-glow-sm`;
  return (
    <Link href={href} className={sharedClass}>
      {isRecommended && (
        <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent ring-1 ring-accent/30">
          <Sparkles className="h-3 w-3" />
          Recommended
        </span>
      )}
      {imageUrl && (
        <div className="mb-3 w-full overflow-hidden rounded-md bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="block h-28 w-full object-contain"
          />
        </div>
      )}
      <div className="flex items-center justify-between">
        <Icon className={`h-7 w-7 ${m.iconTone}`} />
        <ArrowUpRight className="h-5 w-5 text-muted transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent" />
      </div>
      <div className="mt-8">
        <h3 className="text-xl font-semibold tracking-tight md:text-2xl">{m.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted">{m.patientBody}</p>
        {shown.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {shown.map((code) => (
              <span
                key={code}
                title={`${code} · ${issueOf(code)?.label ?? ""}`}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular ring-1 ${
                  code === highlight
                    ? "bg-accent/20 text-accent ring-accent/40"
                    : "bg-surface/80 text-muted ring-border"
                }`}
              >
                {code}
              </span>
            ))}
            {rest.length > 0 && (
              <span
                title={rest.map((c) => `${c} · ${issueOf(c)?.label ?? ""}`).join("\n")}
                className="rounded-full bg-surface/80 px-2 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-border"
              >
                +{rest.length}
              </span>
            )}
          </div>
        )}
        {rec && rec.reasons.length > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-accent/90">
            Why: {rec.reasons[0].reason}
          </p>
        )}
      </div>
    </Link>
  );
}

// ─── Recommended-for-this-patient strip ─────────────────────────
// Pure auto — the doctor sees a curated list derived from the latest
// assessment reports. The strip is structured so that an "Edit"
// button can slot in the future (see FUTURE DOCTOR-EDIT note in
// lib/rehab/recommendation.js:getPrescribedSet).

function RecommendedStrip({
  recs,
  patientName,
  onEdit,
  onStart,
}: {
  recs: ReturnType<typeof useRecommendations>;
  patientName: string | null;
  onEdit: () => void;
  /** Play the whole prescribed list back to back. */
  onStart: () => void;
}) {
  const nameLabel = patientName?.trim() ? patientName : "this patient";

  if (recs.status === "loading") {
    return (
      <div className="rounded-card border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-subtle">
          Recommended for {nameLabel}
        </p>
        <p className="mt-2 text-sm text-muted">
          Reading recent assessments…
        </p>
      </div>
    );
  }

  if (recs.status === "error") {
    return (
      <div className="rounded-card border border-warning/40 bg-warning/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-warning">
              Recommended for {nameLabel}
            </p>
            <p className="mt-2 text-sm text-foreground">
              Could not load assessments — showing full catalogue instead.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit prescription
          </Button>
        </div>
      </div>
    );
  }

  if (recs.status === "empty" || recs.recommended.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-subtle">
              Recommended for {nameLabel}
            </p>
            <p className="mt-2 text-sm text-muted">
              {recs.assessmentsUsed > 0
                ? `Reviewed ${recs.assessmentsUsed} assessment${recs.assessmentsUsed === 1 ? "" : "s"} — no clear deficits flagged yet.`
                : "No assessment reports on file yet."}
              {" "}
              Prescribe manually to get started.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit prescription
          </Button>
        </div>
      </div>
    );
  }

  const top = recs.recommended.slice(0, 6);
  const sourceLabel =
    recs.source === "doctor" ? "clinician-prescribed" : "auto-derived";
  return (
    <div className="rounded-card border border-accent/30 bg-accent/5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-accent">
            Prescribed for {nameLabel}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {recs.recommended.length} exercise{recs.recommended.length === 1 ? "" : "s"}
            {" · "}
            {sourceLabel}
            {recs.source === "auto"
              ? ` from ${recs.assessmentsUsed} recent assessment${recs.assessmentsUsed === 1 ? "" : "s"}`
              : ""}
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The whole prescribed list, back to back. Sits beside Edit
              rather than replacing the per-card links: a doctor who
              wants one exercise still clicks that card. */}
          <Button size="sm" onClick={onStart}>
            <PlayCircle className="h-4 w-4" />
            Start session
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Plays the whole list back to back on a countdown, once per
        prescribed side. Exercises with a side set start straight away;
        the rest ask first. One combined report saves at the end.
      </p>
      <ul className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {top.map((rec) => {
          const firstReason = rec.reasons[0]?.reason ?? rec.note;
          return (
            <li
              key={rec.slug}
              className="rounded-md border border-border bg-background p-3"
            >
              <p className="text-sm font-semibold text-foreground">
                {humanizeSlug(rec.slug)}
                {(recs.sides[rec.slug] ?? []).map((side) => (
                  <span
                    key={side}
                    className="ml-1.5 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent"
                  >
                    {side}
                  </span>
                ))}
              </p>
              {firstReason && (
                <p className="mt-0.5 text-xs text-muted">
                  {firstReason}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
