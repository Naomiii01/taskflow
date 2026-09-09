import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, FollowUpEntityType } from "@/types/database.types";
import * as followUpRepo from "@/lib/repositories/follow-up-repository";
import * as waitingRepo from "@/lib/repositories/waiting-repository";
import * as supervisorRepo from "@/lib/repositories/supervisor-repository";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import { notifyOnce, startOfTodayIso } from "@/lib/services/engine-utils";
import type { FollowUpRecordValues } from "@/lib/validations/planning";
import type { EngineRunResult } from "@/types/domain";

type DB = SupabaseClient<Database, "taskflow">;

export async function listFollowUpsForEntity(supabase: DB, entityType: FollowUpEntityType, entityId: string) {
  return followUpRepo.findFollowUpsForEntity(supabase, entityType, entityId);
}

/**
 * Records a follow-up attempt (第一次/第二次/第三次追蹤...) — the attempt
 * number is assigned server-side from the entity's existing history so the
 * UI never has to track "which attempt is this" itself, and all history is
 * preserved (this only ever inserts, never overwrites a prior attempt).
 */
export async function createFollowUp(supabase: DB, values: FollowUpRecordValues, currentUserId: string) {
  const entityType = values.entity_type as FollowUpEntityType;
  const attemptNumber = await followUpRepo.nextAttemptNumber(supabase, entityType, values.entity_id);
  return followUpRepo.createFollowUpRecord(supabase, {
    entity_type: entityType,
    entity_id: values.entity_id,
    attempt_number: attemptNumber,
    next_follow_up_date: values.next_follow_up_date || null,
    method: values.method || null,
    target_person: values.target_person || null,
    notes: values.notes || null,
    created_by: currentUserId,
  });
}

/** Resolves who should be notified when a follow-up on this entity comes due. */
async function ownerFor(supabase: DB, entityType: FollowUpEntityType, entityId: string) {
  if (entityType === "task") {
    const task = await tasksRepo.findTaskById(supabase, entityId);
    return task ? { userId: task.owner_id, label: `任務 ${task.task_number}：${task.title}` } : null;
  }
  if (entityType === "waiting_item") {
    const item = await waitingRepo.findWaitingItemById(supabase, entityId);
    return item ? { userId: item.created_by, label: `等待事項（${item.waiting_unit}）：${item.description}` } : null;
  }
  const supervisorTask = await supervisorRepo.findSupervisorTaskById(supabase, entityId);
  return supervisorTask ? { userId: supervisorTask.assigned_to, label: `主管交辦：${supervisorTask.title}` } : null;
}

/** Follow-up Center 到期自動提醒 — reuses the existing `followup_due`
 * notification type (see Phase 6.5 decision notes) rather than adding a new
 * enum value, since this is conceptually the same "a follow-up is due"
 * signal the Reminder Engine already sends for tasks. */
export async function runFollowUpDueEngine(supabase: DB): Promise<EngineRunResult> {
  const today = new Date().toISOString().slice(0, 10);
  const due = await followUpRepo.findDueFollowUps(supabase, today);
  let created = 0;

  for (const record of due) {
    const owner = await ownerFor(supabase, record.entity_type as FollowUpEntityType, record.entity_id);
    if (!owner?.userId) continue;

    const ok = await notifyOnce(supabase, {
      userId: owner.userId,
      relatedTaskId: record.entity_type === "task" ? record.entity_id : null,
      type: "followup_due",
      title: `📌 追蹤到期：第 ${record.attempt_number} 次`,
      message: `${owner.label} 已到預定追蹤日期（${record.next_follow_up_date}），請進行下一次追蹤。`,
      since: startOfTodayIso(),
    });
    if (ok) created++;
  }

  return { ran: true, notificationsCreated: created, details: { dueFollowUps: due.length } };
}
