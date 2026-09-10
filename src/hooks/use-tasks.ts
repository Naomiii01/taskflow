"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { TaskFormValues, TaskUpdateValues } from "@/lib/validations/task";
import type { TaskWithRelations, SmartFollowupState } from "@/types/domain";

export type TaskFilters = {
  q?: string;
  status?: string[];
  priority?: string[];
  department_id?: string[];
  owner_id?: string[];
  mine?: boolean;
  dueThisWeek?: boolean;
  overdue?: boolean;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type TaskRow = TaskWithRelations & {
  smartFollowup: SmartFollowupState;
  // Derived Task Engine (task detail view only — the list endpoint doesn't include these).
  children?: TaskWithRelations[];
  parent?: TaskWithRelations | null;
};

function buildSearchParams(filters: TaskFilters) {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  if (filters.status?.length) sp.set("status", filters.status.join(","));
  if (filters.priority?.length) sp.set("priority", filters.priority.join(","));
  if (filters.department_id?.length) sp.set("department_id", filters.department_id.join(","));
  if (filters.owner_id?.length) sp.set("owner_id", filters.owner_id.join(","));
  if (filters.mine) sp.set("mine", "true");
  if (filters.dueThisWeek) sp.set("dueThisWeek", "true");
  if (filters.overdue) sp.set("overdue", "true");
  if (filters.sortBy) sp.set("sortBy", filters.sortBy);
  if (filters.sortDir) sp.set("sortDir", filters.sortDir);
  sp.set("page", String(filters.page ?? 1));
  sp.set("pageSize", String(filters.pageSize ?? 20));
  return sp;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? `發生錯誤（${res.status}）`);
  }
  return body as T;
}

export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => fetchJson<{ data: TaskRow[]; total: number; page: number; pageSize: number }>(
      `/api/tasks?${buildSearchParams(filters).toString()}`
    ),
    placeholderData: (prev) => prev,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => fetchJson<TaskRow>(`/api/tasks/${id}`),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: TaskFormValues) =>
      fetchJson<TaskRow>("/api/tasks", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success("任務已建立");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TaskUpdateValues }) =>
      fetchJson<TaskRow>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: (_data, variables) => {
      toast.success("任務已更新");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.id] });
      // Task 到期日可能在 Calendar Planning Center 被拖曳改期，這裡一併讓行事
      // 曆重新抓取，不然拖完還要手動重新整理才看得到新位置。
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson<TaskRow>(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("任務已刪除");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Bulk delete: reuses the same single-task DELETE endpoint (soft delete, permission
 * checks, activity log all still apply per task) via parallel requests. */
export function useDeleteTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => fetchJson<TaskRow>(`/api/tasks/${id}`, { method: "DELETE" }))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { total: ids.length, failed };
    },
    onSuccess: ({ total, failed }) => {
      if (failed > 0) {
        toast.error(`已刪除 ${total - failed} 筆，${failed} 筆失敗（可能已無權限或已被刪除）`);
      } else {
        toast.success(`已刪除 ${total} 筆任務`);
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
