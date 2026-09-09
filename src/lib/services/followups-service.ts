import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as followupsRepo from "@/lib/repositories/followups-repository";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import type { FollowupFormValues } from "@/lib/validations/followup";

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
