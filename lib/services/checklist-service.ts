import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as checklistRepo from "@/lib/repositories/checklist-repository";
import type { DailyChecklistWithItems } from "@/types/domain";
import type { ChecklistItemUpdateValues } from "@/lib/validations/planning";

type DB = SupabaseClient<Database, "taskflow">;

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function withCompletionRate(checklist: Database["taskflow"]["Tables"]["daily_checklists"]["Row"], items: DailyChecklistWithItems["items"]) {
  const completionRate = items.length
    ? Math.round((items.filter((i) => i.is_completed).length / items.length) * 100)
    : 0;
  return { ...checklist, items, completionRate } as DailyChecklistWithItems & { completionRate: number };
}

/**
 * Today Center: today's checklist, created lazily here if the 00:00 cron
 * hasn't run yet for the day (e.g. first deploy, or the cron misfired) —
 * `ensureChecklistForDate` is idempotent so this is always safe to call.
 */
export async function getTodayChecklist(supabase: DB) {
  const date = todayDateOnly();
  const checklist = await checklistRepo.ensureChecklistForDate(supabase, date);
  const items = await checklistRepo.findItemsForChecklist(supabase, checklist.id);
  return withCompletionRate(checklist, items);
}

/** A past date's checklist for the History view — does NOT auto-create it
 * (only today's checklist should ever be created on-demand). */
export async function getChecklistForDate(supabase: DB, date: string) {
  const checklist = await checklistRepo.findChecklistByDate(supabase, date);
  if (!checklist) return null;
  const items = await checklistRepo.findItemsForChecklist(supabase, checklist.id);
  return withCompletionRate(checklist, items);
}

export async function listChecklistHistory(supabase: DB, limit?: number) {
  return checklistRepo.findChecklistHistory(supabase, limit);
}

export async function updateChecklistItem(
  supabase: DB,
  itemId: string,
  values: ChecklistItemUpdateValues,
  currentUserId: string
) {
  return checklistRepo.setItemCompleted(supabase, itemId, {
    isCompleted: values.is_completed,
    completedBy: currentUserId,
    note: values.note,
  });
}
