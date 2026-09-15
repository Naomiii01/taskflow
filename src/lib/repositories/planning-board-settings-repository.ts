import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

const SETTINGS_ID = "singleton";

/** Capacity Warning thresholds — a single row seeded by migration, never
 * created or deleted from the app; only ever read or updated. */
export async function getSettings(supabase: DB) {
  const { data, error } = await supabase
    .from("planning_board_settings")
    .select("id, yellow_threshold, red_threshold, updated_by, updated_at")
    .eq("id", SETTINGS_ID)
    .single();
  if (error) throw error;
  return data;
}

export async function updateSettings(
  supabase: DB,
  values: { yellow_threshold: number; red_threshold: number },
  updatedBy: string
) {
  const { data, error } = await supabase
    .from("planning_board_settings")
    .update({ yellow_threshold: values.yellow_threshold, red_threshold: values.red_threshold, updated_by: updatedBy })
    .eq("id", SETTINGS_ID)
    .select("id, yellow_threshold, red_threshold, updated_by, updated_at")
    .single();
  if (error) throw error;
  return data;
}
