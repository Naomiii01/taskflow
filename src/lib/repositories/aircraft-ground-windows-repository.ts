import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

const GROUND_WINDOW_SELECT =
  "id, aircraft_registration, station, arrival_at, departure_at, notes, source, current_status, major_work_planned, estimated_mh, required_skill, required_equipment, required_authorization, planning_status, shift, created_by, created_at, updated_at";

/**
 * Windows that overlap [startIso, endExclusiveIso) — i.e. any part of the
 * ground stay falls within the board's visible date range. `endExclusiveIso`
 * should be the day AFTER the last visible column (Aircraft Planning Board
 * Lite passes date-only strings, which Postgres reads as midnight).
 */
export async function findWindowsOverlapping(supabase: DB, startIso: string, endExclusiveIso: string) {
  const { data, error } = await supabase
    .from("aircraft_ground_windows")
    .select(GROUND_WINDOW_SELECT)
    .lt("arrival_at", endExclusiveIso)
    .gt("departure_at", startIso)
    .order("arrival_at");
  if (error) throw error;
  return data ?? [];
}

export async function findWindowById(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("aircraft_ground_windows")
    .select(GROUND_WINDOW_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createWindow(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["aircraft_ground_windows"]["Insert"]
) {
  const { data, error } = await supabase
    .from("aircraft_ground_windows")
    .insert(values)
    .select(GROUND_WINDOW_SELECT)
    .single();
  if (error) throw error;
  return data;
}

/** Bulk insert for the schedule-file import path. Supabase caps a single
 * insert's payload, so the service chunks large imports before calling this.
 * Upserts with `ignoreDuplicates` (→ ON CONFLICT DO NOTHING on the
 * aircraft_registration/station/arrival_at/departure_at unique constraint)
 * so re-importing an overlapping export — the normal case once daily
 * imports start — never creates duplicate rows and, just as importantly,
 * never overwrites Planning Information she's already filled in by hand on
 * a row that happens to match. The returned rows are only the genuinely new
 * ones; anything skipped as a duplicate simply isn't in `data`. */
export async function createWindows(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["aircraft_ground_windows"]["Insert"][]
) {
  if (!values.length) return [];
  const { data, error } = await supabase
    .from("aircraft_ground_windows")
    .upsert(values, { onConflict: "aircraft_registration,station,arrival_at,departure_at", ignoreDuplicates: true })
    .select(GROUND_WINDOW_SELECT);
  if (error) throw error;
  return data ?? [];
}

/** Clears out stale imported ground windows before a re-import writes fresh
 * ones — schedules change constantly, so re-importing the same date range
 * (a daily habit once this is the normal workflow) needs to REPLACE the old
 * computed windows, not just pile new ones on top of them. Only ever touches
 * rows that are safe to discard: `source = 'import'` (never a row she built
 * by hand) AND every Planning Information field is still empty (never a row
 * she's since filled in — that one stays untouched even if the schedule
 * moved, since her plan matters more than the exact stale timestamps).
 * `rangeStartIso`/`rangeEndExclusiveIso` should bracket the new import's
 * earliest arrival to latest departure for this aircraft — old rows whose
 * arrival falls in that window are what the fresh import is meant to
 * supersede. */
export async function deleteStaleImportWindows(
  supabase: DB,
  aircraftRegistration: string,
  rangeStartIso: string,
  rangeEndExclusiveIso: string
) {
  const { error } = await supabase
    .from("aircraft_ground_windows")
    .delete()
    .eq("aircraft_registration", aircraftRegistration)
    .eq("source", "import")
    .gte("arrival_at", rangeStartIso)
    .lt("arrival_at", rangeEndExclusiveIso)
    .is("major_work_planned", null)
    .is("shift", null)
    .is("current_status", null)
    .is("estimated_mh", null)
    .is("required_skill", null)
    .is("required_equipment", null)
    .is("required_authorization", null)
    .is("planning_status", null);
  if (error) throw error;
}

export async function updateWindow(
  supabase: DB,
  id: string,
  values: Database["taskflow"]["Tables"]["aircraft_ground_windows"]["Update"]
) {
  const { data, error } = await supabase
    .from("aircraft_ground_windows")
    .update(values)
    .eq("id", id)
    .select(GROUND_WINDOW_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWindow(supabase: DB, id: string) {
  const { error } = await supabase.from("aircraft_ground_windows").delete().eq("id", id);
  if (error) throw error;
}
