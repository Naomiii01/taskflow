import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { PLANNING_DAILY_CHECKLIST_ITEMS } from "@/lib/constants";

type DB = SupabaseClient<Database, "taskflow">;

const ITEM_SELECT = "*, completed_by_user:users!daily_checklist_items_completed_by_fkey(id, name, email, avatar_url)";

export async function findChecklistByDate(supabase: DB, date: string) {
  const { data, error } = await supabase.from("daily_checklists").select("*").eq("checklist_date", date).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findItemsForChecklist(supabase: DB, checklistId: string) {
  const { data, error } = await supabase
    .from("daily_checklist_items")
    .select(ITEM_SELECT)
    .eq("checklist_id", checklistId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

/** Idempotent: creates today's checklist + its 8 default items if they don't
 * already exist (called both by the 00:00 cron and lazily on-demand if the
 * homepage is opened before the cron has run for the day). */
export async function ensureChecklistForDate(supabase: DB, date: string) {
  let checklist = await findChecklistByDate(supabase, date);
  if (!checklist) {
    const { data, error } = await supabase
      .from("daily_checklists")
      .insert({ checklist_date: date })
      .select("*")
      .single();
    if (error) {
      // Unique violation race (two callers at once) — re-fetch instead of failing.
      const retry = await findChecklistByDate(supabase, date);
      if (retry) checklist = retry;
      else throw error;
    } else {
      checklist = data;
    }
  }

  const existingItems = await findItemsForChecklist(supabase, checklist!.id);
  const existingKeys = new Set(existingItems.map((i) => i.item_key));
  const missing = PLANNING_DAILY_CHECKLIST_ITEMS.filter((i) => !existingKeys.has(i.key));
  if (missing.length) {
    const { error } = await supabase
      .from("daily_checklist_items")
      .insert(missing.map((i) => ({ checklist_id: checklist!.id, item_key: i.key, item_label: i.label })));
    if (error) throw error;
  }

  return checklist!;
}

export async function setItemCompleted(
  supabase: DB,
  itemId: string,
  values: { isCompleted: boolean; completedBy: string | null; note?: string | null }
) {
  const { data, error } = await supabase
    .from("daily_checklist_items")
    .update({
      is_completed: values.isCompleted,
      completed_by: values.isCompleted ? values.completedBy : null,
      completed_at: values.isCompleted ? new Date().toISOString() : null,
      ...(values.note !== undefined ? { note: values.note } : {}),
    })
    .eq("id", itemId)
    .select(ITEM_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function findChecklistHistory(supabase: DB, limit = 30) {
  const { data, error } = await supabase
    .from("daily_checklists")
    .select("*")
    .order("checklist_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
