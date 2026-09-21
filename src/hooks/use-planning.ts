"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
  DailyChecklistWithItems,
  MonthlyChecklistWithItems,
  WaitingItemWithTask,
  SupervisorTaskWithUsers,
  ProjectSummary,
  PlanningKpis,
  PlanningAnalytics,
  PlanningBriefing,
} from "@/types/domain";
import type { WaitingItemValues, SupervisorTaskValues } from "@/lib/validations/planning";

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `發生錯誤（${res.status}）`);
  return body as T;
}

type ChecklistWithRate = DailyChecklistWithItems & { completionRate: number };

// --- Today Center: Daily Checklist ------------------------------------------

export function useTodayChecklist() {
  return useQuery({
    queryKey: ["planning", "checklist", "today"],
    queryFn: () => fetchJson<ChecklistWithRate>("/api/planning/checklist"),
  });
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_completed, note }: { id: string; is_completed: boolean; note?: string | null }) =>
      fetchJson(`/api/planning/checklist-items/${id}`, { method: "PATCH", body: JSON.stringify({ is_completed, note }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planning", "checklist"] }),
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Monthly Center: Planning Timeline 完成勾選 -------------------------------

export function useMonthlyChecklist() {
  return useQuery({
    queryKey: ["planning", "monthly-checklist"],
    queryFn: () => fetchJson<MonthlyChecklistWithItems>("/api/planning/monthly-checklist"),
  });
}

export function useUpdateMonthlyChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_completed }: { id: string; is_completed: boolean }) =>
      fetchJson(`/api/planning/monthly-checklist-items/${id}`, { method: "PATCH", body: JSON.stringify({ is_completed }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planning", "monthly-checklist"] }),
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Waiting Center ----------------------------------------------------------

export function useWaitingItems(status?: string) {
  return useQuery({
    queryKey: ["planning", "waiting", status ?? "Waiting"],
    queryFn: () => fetchJson<WaitingItemWithTask[]>(`/api/planning/waiting?status=${status ?? "Waiting"}`),
  });
}

export function useUpdateWaitingItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchJson(`/api/planning/waiting/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast.success("等待事項已更新");
      queryClient.invalidateQueries({ queryKey: ["planning", "waiting"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Waiting Center 原本只能看、只能改狀態——這支補上「新增」，讓等待回覆數
 * KPI 真的能有資料進來。 */
export function useCreateWaitingItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: WaitingItemValues) =>
      fetchJson<WaitingItemWithTask>("/api/planning/waiting", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success("等待事項已新增");
      queryClient.invalidateQueries({ queryKey: ["planning", "waiting"] });
      queryClient.invalidateQueries({ queryKey: ["planning", "kpi"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Supervisor Assignment Center --------------------------------------------

export function useSupervisorTasks(status?: string) {
  return useQuery({
    queryKey: ["planning", "supervisor-tasks", status ?? "open"],
    queryFn: () => fetchJson<SupervisorTaskWithUsers[]>(`/api/planning/supervisor-tasks${status ? `?status=${status}` : ""}`),
  });
}

export function useUpdateSupervisorTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchJson(`/api/planning/supervisor-tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast.success("主管交辦事項已更新");
      queryClient.invalidateQueries({ queryKey: ["planning", "supervisor-tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Supervisor Center 原本只能看、只能標記完成——這支補上「新增」，讓主管交辦
 * 完成率 KPI 真的能有資料進來。 */
export function useCreateSupervisorTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: SupervisorTaskValues) =>
      fetchJson<SupervisorTaskWithUsers>("/api/planning/supervisor-tasks", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success("主管交辦事項已新增");
      queryClient.invalidateQueries({ queryKey: ["planning", "supervisor-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["planning", "kpi"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Project Center ------------------------------------------------------------

export function useProjectSummaries() {
  return useQuery({
    queryKey: ["planning", "projects"],
    queryFn: () => fetchJson<ProjectSummary[]>("/api/planning/projects"),
  });
}

// --- Planning KPI / Analytics / AI Briefing ----------------------------------

export function usePlanningKpis() {
  return useQuery({
    queryKey: ["planning", "kpi"],
    queryFn: () => fetchJson<PlanningKpis>("/api/planning/kpi"),
  });
}

export function usePlanningAnalytics() {
  return useQuery({
    queryKey: ["planning", "analytics"],
    queryFn: () => fetchJson<PlanningAnalytics>("/api/planning/analytics"),
  });
}

export function useDailyBriefing() {
  return useQuery({
    queryKey: ["planning", "briefing"],
    queryFn: () => fetchJson<PlanningBriefing>("/api/planning/briefing"),
  });
}
