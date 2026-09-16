import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

const RESIDENCY_WINDOW_SELECT = "id, aircraft_registration, station, start_date, end_date, source, notes, created_by, created_at, updated_at";

/** Residency windows that overlap [startIso, endExclusiveIso) — same
 * half-open convention as aircraft_ground_windows' overlap query, so the
 * board can ask for both with the same date range. `start_date`/`end_date`
 * are plain dates (no time-of-day), unlike the ground windows' timestamps. */
export async function findWindowsOverlapping(supabase: DB, startIso: string, endExclusiveIso: string) {
  const { data, error } = await supabase
    .from("aircraft_residency_windows")
    .select(RESIDENCY_WINDOW_SELECT)
    .lt("start_date", endExclusiveIso)
    .gt("end_date", startIso)
    .order("start_date");
  if (error) throw error;
  return data ?? [];
}

export async function createWindow(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["aircraft_residency_windows"]["Insert"]
) {
  const { data, error } = await supabase
    .from("aircraft_residency_windows")
    .insert(values)
    .select(RESIDENCY_WINDOW_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function updateWindow(
  supabase: DB,
  id: string,
  values: Database["taskflow"]["Tables"]["aircraft_residency_windows"]["Update"]
) {
  const { data, error } = await supabase
    .from("aircraft_residency_windows")
    .update(values)
    .eq("id", id)
    .select(RESIDENCY_WINDOW_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWindow(supabase: DB, id: string) {
  const { error } = await supabase.from("aircraft_residency_windows").delete().eq("id", id);
  if (error) throw error;
}
