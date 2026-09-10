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
