"use client";

import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

export function useTaskLogs(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-logs", taskId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("task_logs")
        .select("*, user:users!task_logs_user_id_fkey(id, name, email, avatar_url)")
        .eq("task_id", taskId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });
}
