import "server-only";

import { differenceInCalendarDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, CrossDeptUnit, WaitingStatus } from "@/types/database.types";
import * as waitingRepo from "@/lib/repositories/waiting-repository";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import { waitingColorForDays } from "@/lib/constants";
import type { WaitingItemWithTask } from "@/types/domain";
import type { WaitingItemValues, WaitingItemUpdateValues, WaitingQuery } from "@/lib/validations/planning";
import type { TaskFormValues } from "@/lib/validations/task";

type DB = SupabaseClient<Database, "taskflow">;
type RawWaitingItem = Awaited<ReturnType<typeof waitingRepo.findWaitingItems>>[number];

/** Adds the auto-computed Waiting Days + color (3天內綠色/4-7天黃色/8-14天橘色/
 * 15天以上紅色) — "已等待天數" counts from created_date to today while the item
 * is still Waiting, or to its last update once Replied/Cancelled (freezing the
 * clock once it's resolved). */
function withWaitingDays(item: RawWaitingItem): WaitingItemWithTask {
  const end = item.status === "Waiting" ? new Date() : new Date(item.updated_at);
  const waitingDays = Math.max(0, differenceInCalendarDays(end, new Date(`${item.created_date}T00:00:00`)));
  return { ...item, waitingDays, color: waitingColorForDays(waitingDays) };
}

export async function listWaitingItems(supabase: DB, query: WaitingQuery) {
  const items = await waitingRepo.findWaitingItems(supabase, {
    status: query.status as WaitingStatus | undefined,
    waitingUnit: query.waiting_unit as CrossDeptUnit | undefined,
  });
  return items.map(withWaitingDays);
}

export async function getWaitingItem(supabase: DB, id: string) {
  const item = await waitingRepo.findWaitingItemById(supabase, id);
  return item ? withWaitingDays(item) : null;
}

export async function createWaitingItem(supabase: DB, values: WaitingItemValues, currentUserId: string) {
  const item = await waitingRepo.createWaitingItem(supabase, {
    waiting_unit: values.waiting_unit as Database["taskflow"]["Enums"]["cross_dept_unit_enum"],
    description: values.description,
    related_task_id: values.related_task_id || null,
    expected_reply_date: values.expected_reply_date || null,
    created_by: currentUserId,
  });
  return withWaitingDays(item);
}

export async function updateWaitingItem(supabase: DB, id: string, values: WaitingItemUpdateValues) {
  const patch: Database["taskflow"]["Tables"]["waiting_items"]["Update"] = {};
  if (values.waiting_unit !== undefined)
    patch.waiting_unit = values.waiting_unit as Database["taskflow"]["Enums"]["cross_dept_unit_enum"];
  if (values.description !== undefined) patch.description = values.description;
  if (values.related_task_id !== undefined) patch.related_task_id = values.related_task_id || null;
  if (values.expected_reply_date !== undefined) patch.expected_reply_date = values.expected_reply_date || null;
  if (values.status !== undefined) patch.status = values.status as WaitingStatus;
  const item = await waitingRepo.updateWaitingItem(supabase, id, patch);
  return withWaitingDays(item);
}

export async function deleteWaitingItem(supabase: DB, id: string) {
  return waitingRepo.deleteWaitingItem(supabase, id);
}

/**
 * Derived Task Engine, concrete instantiation of the spec's example
 * ("工程部回覆需新增工卡，直接建立 Child Task"): when a cross-department reply
 * to a Waiting Center item requires a new work card / follow-up task, this
 * creates it as a Child Task (parent_task_id = the waiting item's source
 * task, if it had one) in one step and marks the waiting item Replied so it
 * drops off the Waiting Center automatically.
 */
export async function createDerivedTask(supabase: DB, waitingItemId: string, values: TaskFormValues, currentUserId: string) {
  const waitingItem = await waitingRepo.findWaitingItemById(supabase, waitingItemId);
  if (!waitingItem) throw new Error("找不到此等待事項");

  const task = await tasksRepo.createTask(
    supabase,
    { ...values, parent_task_id: values.parent_task_id ?? waitingItem.related_task_id ?? null },
    currentUserId
  );
  await waitingRepo.updateWaitingItem(supabase, waitingItemId, { status: "Replied" });
  return task;
}
