import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

const LOG_SELECT = "*, user:users!task_logs_user_id_fkey(id, name, email, avatar_url)";

export async function findLogsByTask(supabase: DB, taskId: string) {
  const { data, error } = await supabase
    .from("task_logs")
    .select(LOG_SELECT)
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
