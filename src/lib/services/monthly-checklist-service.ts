import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as monthlyChecklistRepo from "@/lib/repositories/monthly-checklist-repository";
import type { MonthlyChecklistWithItems } from "@/types/domain";
import type { MonthlyChecklistItemUpdateValues } from "@/lib/validations/planning";

type DB = SupabaseClient<Database, "taskflow">;

function firstOfThisMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function withDerivedFields(
  checklist: Database["taskflow"]["Tables"]["monthly_checklists"]["Row"],
  items: Database["taskflow"]["Tables"]["monthly_checklist_items"]["Row"][]
): MonthlyChecklistWithItems {
  const today = new Date();
  const itemsWithFields = items
    .map((item) => {
      const day = Number(item.item_key);
      return {
        ...item,
        day,
        isPast: day < today.getDate(),
        isToday: day === today.getDate(),
      };
    })
    .sort((a, b) => a.day - b.day);
  return { ...checklist, items: itemsWithFields };
}

/** Monthly Center / Planning Timeline: this month's checklist, created
 * lazily here if it doesn't exist yet (`ensureChecklistForMonth` is
 * idempotent so this is always safe to call). */
export async function getCurrentMonthChecklist(supabase: DB) {
  const planningMonth = firstOfThisMonth();
  const checklist = await monthlyChecklistRepo.ensureChecklistForMonth(supabase, planningMonth);
  const items = await monthlyChecklistRepo.findItemsForChecklist(supabase, checklist.id);
  return withDerivedFields(checklist, items);
}

export async function updateChecklistItem(
  supabase: DB,
  itemId: string,
  values: MonthlyChecklistItemUpdateValues,
  currentUserId: string
) {
  return monthlyChecklistRepo.setItemCompleted(supabase, itemId, {
    isCompleted: values.is_completed,
    completedBy: currentUserId,
  });
}
