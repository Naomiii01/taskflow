import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";
import type { SavedFilterValues } from "@/lib/validations/followup";

type DB = SupabaseClient<Database, "taskflow">;

export async function findSavedFilters(supabase: DB, userId: string) {
  const { data, error } = await supabase
    .from("saved_filters")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSavedFilter(supabase: DB, userId: string, values: SavedFilterValues) {
  const { data, error } = await supabase
    .from("saved_filters")
    .insert({ user_id: userId, name: values.name, filters: values.filters as Json })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSavedFilter(supabase: DB, userId: string, id: string) {
  const { error } = await supabase.from("saved_filters").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}
