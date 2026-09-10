import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { FollowupFormValues, FollowupUpdateValues } from "@/lib/validations/followup";

type DB = SupabaseClient<Database, "taskflow">;

const FOLLOWUP_SELECT = "*, author:users!followups_created_by_fkey(id, name, email, avatar_url)";

export async function findFollowupsByTask(supabase: DB, taskId: string) {
  const { data, error } = await supabase
    .from("followups")
    .select(FOLLOWUP_SELECT)
    .eq("task_id", taskId)
    .order("followup_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function findFollowupById(supabase: DB, id: string) {
  const { data, error } = await supabase.from("followups").select(FOLLOWUP_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateFollowup(supabase: DB, id: string, values: FollowupUpdateValues) {
  const patch: Database["taskflow"]["Tables"]["followups"]["Update"] = {};
  if (values.followup_date !== undefined) patch.followup_date = values.followup_date;
  if (values.department_name !== undefined) patch.department_name = values.department_name || null;
  if (values.content !== undefined) patch.content = values.content;
  if (values.result !== undefined) patch.result = values.result || null;
  if (values.next_action !== undefined) patch.next_action = values.next_action || null;

  const { data, error } = await supabase
    .from("followups")
    .update(patch)
    .eq("id", id)
    .select(FOLLOWUP_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFollowupById(supabase: DB, id: string) {
  const { error } = await supabase.from("followups").delete().eq("id", id);
  if (error) throw error;
}

export async function findLatestFollowupForTask(supabase: DB, taskId: string) {
  const { data, error } = await supabase
    .from("followups")
    .select("followup_date, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createFollowup(supabase: DB, values: FollowupFormValues, createdBy: string) {
  const { data, error } = await supabase
    .from("followups")
    .insert({
      task_id: values.task_id,
      followup_date: values.followup_date,
      department_name: values.department_name ?? null,
      content: values.content,
      result: values.result ?? null,
      next_action: values.next_action ?? null,
      created_by: createdBy,
    })
    .select(FOLLOWUP_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function findFollowupsByTasks(supabase: DB, taskIds: string[]) {
  if (!taskIds.length) return [];
  const { data, error } = await supabase
    .from("followups")
    .select("task_id, followup_date, created_at")
    .in("task_id", taskIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Same as findFollowupsByTasks plus department_name — used by the Risk
 * Detection Engine to spot tasks bouncing between multiple departments. */
export async function findFollowupDetailsByTasks(supabase: DB, taskIds: string[]) {
  if (!taskIds.length) return [];
  const { data, error } = await supabase
    .from("followups")
    .select("task_id, followup_date, created_at, department_name")
    .in("task_id", taskIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
