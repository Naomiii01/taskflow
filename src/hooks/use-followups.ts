"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { FollowupFormValues, FollowupUpdateValues } from "@/lib/validations/followup";
import type { FollowupWithAuthor } from "@/types/domain";

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `發生錯誤（${res.status}）`);
  return body as T;
}

export function useFollowups(taskId: string | undefined) {
  return useQuery({
    queryKey: ["followups", taskId],
    queryFn: () => fetchJson<{ data: FollowupWithAuthor[] }>(`/api/followups?task_id=${taskId}`),
    enabled: !!taskId,
  });
}

export function useAddFollowup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: FollowupFormValues) =>
      fetchJson<FollowupWithAuthor>("/api/followups", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: (_data, variables) => {
      toast.success("已新增追蹤紀錄");
      queryClient.invalidateQueries({ queryKey: ["followups", variables.task_id] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.task_id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateFollowup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; taskId: string; values: FollowupUpdateValues }) =>
      fetchJson<FollowupWithAuthor>(`/api/followups/${id}`, { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: (_data, variables) => {
      toast.success("已更新追蹤紀錄");
      queryClient.invalidateQueries({ queryKey: ["followups", variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
