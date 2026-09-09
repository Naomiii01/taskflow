import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as savedFiltersRepo from "@/lib/repositories/saved-filters-repository";
import type { SavedFilterValues } from "@/lib/validations/followup";

type DB = SupabaseClient<Database, "taskflow">;

export async function listSavedFilters(supabase: DB, userId: string) {
  return savedFiltersRepo.findSavedFilters(supabase, userId);
}

export async function saveFilter(supabase: DB, userId: string, values: SavedFilterValues) {
  return savedFiltersRepo.createSavedFilter(supabase, userId, values);
}

export async function removeSavedFilter(supabase: DB, userId: string, id: string) {
  return savedFiltersRepo.deleteSavedFilter(supabase, userId, id);
}
