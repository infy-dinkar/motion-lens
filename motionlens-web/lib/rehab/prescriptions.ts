// Authenticated API client for /api/patients/{id}/prescription.
//
// Prescriptions are the doctor-authored override of the auto
// recommendation. Only one prescription lives per (doctor, patient)
// pair — PUT is idempotent upsert.

import { authedFetch } from "@/lib/auth";

/** Which side a one-sided exercise should be worked on. */
export type RehabSide = "left" | "right";

/**
 * Prescribed sides per exercise slug.
 *
 * A LIST, because an exercise is usually trained on both sides and the
 * session has to run it once per side — there is no picker to fall
 * back on. Only slugs whose catalogue entry has `needsSide` ever
 * appear; everything else is bilateral and has no entry at all.
 *
 * An empty list is never stored: a ticked exercise always has at least
 * one side.
 */
export type PrescribedSides = Record<string, RehabSide[]>;

/** What a newly ticked one-sided exercise gets. */
export const DEFAULT_SIDES: RehabSide[] = ["left", "right"];

/** Where inside `notes` the sides live. One key, so the rest of the
 *  dict stays free for whatever comes next. */
const SIDES_KEY = "sides";

/**
 * Read the prescribed sides out of a prescription's notes.
 *
 * Defensive on every level: notes is server-controlled free-form JSON
 * and a prescription saved before sides existed has no key at all.
 * Anything that is not a literal "left" or "right" is dropped rather
 * than trusted into a page's side state.
 */
export function readSides(
  notes: Record<string, unknown> | null | undefined,
): PrescribedSides {
  const raw = notes?.[SIDES_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: PrescribedSides = {};
  for (const [slug, value] of Object.entries(raw as Record<string, unknown>)) {
    // A bare string is the shape this field had before an exercise
    // could be prescribed on both sides. Read it as a one-item list
    // rather than discarding the doctor's choice.
    const list = Array.isArray(value) ? value : [value];
    const sides = list.filter(
      (v): v is RehabSide => v === "left" || v === "right",
    );
    // De-dupe: ["left","left"] would run the same side twice.
    const unique = sides.filter((v, i) => sides.indexOf(v) === i);
    if (unique.length > 0) out[slug] = unique;
  }
  return out;
}

export interface PrescriptionDTO {
  id: string;
  patient_id: string;
  doctor_id: string;
  slugs: string[];
  notes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionResponse {
  success: boolean;
  data: PrescriptionDTO | null;
}

async function asJSON<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail =
      typeof (body as { detail?: unknown }).detail === "string"
        ? (body as { detail: string }).detail
        : `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/** GET the doctor prescription for a patient. Returns null when the
 *  doctor has not saved one yet — callers fall back to the auto
 *  recommender in that case. */
export async function loadPrescription(
  patientId: string,
): Promise<PrescriptionDTO | null> {
  const res = await authedFetch(`/api/patients/${patientId}/prescription`);
  const body = await asJSON<PrescriptionResponse>(res);
  return body.data ?? null;
}

/**
 * Upsert the prescription. Replaces the slug list AND the notes
 * wholesale — the endpoint takes full state, not a diff.
 *
 * Sides are folded into notes here rather than by every caller, so
 * there is one place that knows the storage shape.
 */
export async function savePrescription(
  patientId: string,
  slugs: string[],
  sides: PrescribedSides = {},
  notes: Record<string, unknown> = {},
): Promise<PrescriptionDTO> {
  // Never keep a side for an exercise that is no longer prescribed —
  // it would come back the next time that exercise is ticked, silently
  // overriding whatever the doctor picked then.
  const kept: PrescribedSides = {};
  for (const slug of slugs) {
    const picked = sides[slug];
    if (picked && picked.length > 0) kept[slug] = picked;
  }
  const res = await authedFetch(`/api/patients/${patientId}/prescription`, {
    method: "PUT",
    body: JSON.stringify({ slugs, notes: { ...notes, [SIDES_KEY]: kept } }),
  });
  return asJSON<PrescriptionDTO>(res);
}

/** Delete the doctor prescription so the auto recommender wins. */
export async function clearPrescription(patientId: string): Promise<void> {
  const res = await authedFetch(`/api/patients/${patientId}/prescription`, {
    method: "DELETE",
  });
  await asJSON<PrescriptionResponse>(res);
}
