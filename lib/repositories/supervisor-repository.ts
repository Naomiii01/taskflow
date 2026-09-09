import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, SupervisorTaskStatus } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

const SUPERVISOR_TASK_SELECT =
  "*, assigner:users!supervisor_tasks_assigned_by_fkey(id, name, email, avatar_url), assignee:users!supervisor_tasks_assigned_to_fkey(id, name, email, avatar_url)";

export async function findSupervisorTasks(supabase: DB, status?: SupervisorTaskStatus) {
  let q = supabase.from("supervisor_tasks").select(SUPERVISOR_TASK_SELECT).order("assigned_date", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function findSupervisorTaskById(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("supervisor_tasks")
    .select(SUPERVISOR_TASK_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createSupervisorTask(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["supervisor_tasks"]["Insert"]
) {
  const { data, error } = await supabase
    .from("supervisor_tasks")
    .insert(values)
    .select(SUPERVISOR_TASK_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function updateSupervisorTask(
  supabase: DB,
  id: string,
  values: Database["taskflow"]["Tables"]["supervisor_tasks"]["Update"]
) {
  const patch = { ...values };
  if (values.status === "Completed") patch.completed_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("supervisor_tasks")
    .update(patch)
    .eq("id", id)
    .select(SUPERVISOR_TASK_SELECT)
    .single();
  if (error) throw error;
  return data;
}
