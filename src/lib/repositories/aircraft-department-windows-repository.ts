import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

const DEPARTMENT_WINDOW_SELECT =
  "id, aircraft_registration, department, start_date, end_date, description, source, source_document, notes, created_by, created_at, updated_at";

/** Department windows (機坪／基地) that overlap [startIso, endExclusiveIso).
 * Unlike aircraft_residency_windows, end_date here is INCLUSIVE (matches how
 * the source maintenance schedule reads "幾號到幾號"), so the overlap test
 * uses `gte` on end_date rather than `gt`. */
export async function findWindowsOverlapping(supabase: DB, startIso: string, endExclusiveIso: string) {
  const { data, error } = await supabase
    .from("aircraft_department_windows")
    .select(DEPARTMENT_WINDOW_SELECT)
    .lt("start_date", endExclusiveIso)
    .gte("end_date", startIso)
    .order("start_date");
  if (error) throw error;
  return data ?? [];
}

export async function createWindow(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["aircraft_department_windows"]["Insert"]
) {
  const { data, error } = await supabase
    .from("aircraft_department_windows")
    .insert(values)
    .select(DEPARTMENT_WINDOW_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function updateWindow(
  supabase: DB,
  id: string,
  values: Database["taskflow"]["Tables"]["aircraft_department_windows"]["Update"]
) {
  const { data, error } = await supabase
    .from("aircraft_department_windows")
    .update(values)
    .eq("id", id)
    .select(DEPARTMENT_WINDOW_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWindow(supabase: DB, id: string) {
  const { error } = await supabase.from("aircraft_department_windows").delete().eq("id", id);
  if (error) throw error;
}
