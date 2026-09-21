import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { PLANNING_MONTHLY_MILESTONES } from "@/lib/constants";

type DB = SupabaseClient<Database, "taskflow">;

export async function findChecklistByMonth(supabase: DB, planningMonth: string) {
  const { data, error } = await supabase
    .from("monthly_checklists")
    .select("*")
    .eq("planning_month", planningMonth)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findItemsForChecklist(supabase: DB, checklistId: string) {
  const { data, error } = await supabase
    .from("monthly_checklist_items")
    .select("*")
    .eq("checklist_id", checklistId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

/** Idempotent: creates this month's checklist + its 3 milestone items
 * (PLANNING_MONTHLY_MILESTONES) if they don't already exist yet — called
 * lazily whenever the Planning Timeline is opened for a month it hasn't
 * seen before, same pattern as the Daily Checklist Engine. */
export async function ensureChecklistForMonth(supabase: DB, planningMonth: string) {
  let checklist = await findChecklistByMonth(supabase, planningMonth);
  if (!checklist) {
    const { data, error } = await supabase
      .from("monthly_checklists")
      .insert({ planning_month: planningMonth })
      .select("*")
      .single();
    if (error) {
      // Unique violation race (two callers at once) — re-fetch instead of failing.
      const retry = await findChecklistByMonth(supabase, planningMonth);
      if (retry) checklist = retry;
      else throw error;
    } else {
      checklist = data;
    }
  }

  const existingItems = await findItemsForChecklist(supabase, checklist!.id);
  const existingKeys = new Set(existingItems.map((i) => i.item_key));
  const missing = PLANNING_MONTHLY_MILESTONES.filter((m) => !existingKeys.has(String(m.day)));
  if (missing.length) {
    const { error } = await supabase
      .from("monthly_checklist_items")
      .insert(missing.map((m) => ({ checklist_id: checklist!.id, item_key: String(m.day), item_label: m.label })));
    if (error) throw error;
  }

  return checklist!;
}

export async function setItemCompleted(
  supabase: DB,
  itemId: string,
  values: { isCompleted: boolean; completedBy: string | null }
) {
  const { data, error } = await supabase
    .from("monthly_checklist_items")
    .update({
      is_completed: values.isCompleted,
      completed_by: values.isCompleted ? values.completedBy : null,
      completed_at: values.isCompleted ? new Date().toISOString() : null,
    })
    .eq("id", itemId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
