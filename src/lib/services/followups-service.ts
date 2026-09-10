import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as followupsRepo from "@/lib/repositories/followups-repository";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import type { FollowupFormValues, FollowupUpdateValues } from "@/lib/validations/followup";

type DB = SupabaseClient<Database, "taskflow">;

export async function listFollowupsForTask(supabase: DB, taskId: string) {
  return followupsRepo.findFollowupsByTask(supabase, taskId);
}

export async function addFollowup(supabase: DB, values: FollowupFormValues, createdBy: string) {
  const task = await tasksRepo.findTaskById(supabase, values.task_id);
  if (!task) throw new Error("找不到對應的任務");

  const followup = await followupsRepo.createFollowup(supabase, values, createdBy);

  // Keep tasks.followup_date in sync with the latest follow-up so dashboard
  // / calendar queries that read the task row directly stay accurate.
  await tasksRepo.updateTask(supabase, values.task_id, { followup_date: values.followup_date });

  return followup;
}

/** 修正打錯字／內容的追蹤紀錄。若改到的剛好是該任務最新一筆，順便同步
 * tasks.followup_date，避免儀表板／行事曆看到的追蹤日跟這裡對不上。 */
export async function updateFollowup(supabase: DB, id: string, values: FollowupUpdateValues) {
  const existing = await followupsRepo.findFollowupById(supabase, id);
  if (!existing) throw new Error("找不到這筆追蹤紀錄");

  const followup = await followupsRepo.updateFollowup(supabase, id, values);

  const latest = await followupsRepo.findLatestFollowupForTask(supabase, existing.task_id);
  if (latest && latest.created_at === existing.created_at) {
    await tasksRepo.updateTask(supabase, existing.task_id, { followup_date: followup.followup_date });
  }

  return followup;
}

/** 刪除一筆追蹤紀錄。若刪掉的剛好是該任務最新一筆，改用剩下紀錄裡最新的
 * 日期同步 tasks.followup_date（沒有剩下的就清空），避免儀表板／行事曆看到
 * 已經不存在的追蹤日。 */
export async function deleteFollowup(supabase: DB, id: string) {
  const existing = await followupsRepo.findFollowupById(supabase, id);
  if (!existing) throw new Error("找不到這筆追蹤紀錄");

  const wasLatest = await followupsRepo.findLatestFollowupForTask(supabase, existing.task_id);
  await followupsRepo.deleteFollowupById(supabase, id);

  if (wasLatest?.created_at !== existing.created_at) return;
  const newLatest = await followupsRepo.findLatestFollowupForTask(supabase, existing.task_id);
  await tasksRepo.updateTask(supabase, existing.task_id, { followup_date: newLatest?.followup_date ?? null });
}
