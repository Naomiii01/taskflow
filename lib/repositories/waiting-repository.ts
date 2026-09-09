import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, CrossDeptUnit, WaitingStatus } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

const WAITING_SELECT = "*, related_task:tasks!waiting_items_related_task_id_fkey(id, task_number, title)";

export async function findWaitingItems(
  supabase: DB,
  filters?: { status?: WaitingStatus; waitingUnit?: CrossDeptUnit }
) {
  let q = supabase.from("waiting_items").select(WAITING_SELECT).order("created_date", { ascending: true });
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.waitingUnit) q = q.eq("waiting_unit", filters.waitingUnit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function findWaitingItemById(supabase: DB, id: string) {
  const { data, error } = await supabase.from("waiting_items").select(WAITING_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createWaitingItem(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["waiting_items"]["Insert"]
) {
  const { data, error } = await supabase.from("waiting_items").insert(values).select(WAITING_SELECT).single();
  if (error) throw error;
  return data;
}

export async function updateWaitingItem(
  supabase: DB,
  id: string,
  values: Database["taskflow"]["Tables"]["waiting_items"]["Update"]
) {
  const { data, error } = await supabase
    .from("waiting_items")
    .update(values)
    .eq("id", id)
    .select(WAITING_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWaitingItem(supabase: DB, id: string) {
  const { error } = await supabase.from("waiting_items").delete().eq("id", id);
  if (error) throw error;
}
