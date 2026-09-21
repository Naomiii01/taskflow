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

// 儀表板即時度（混合做法）：多數清單/KPI 頁面用簡單輪詢，每分鐘自動重新
// 抓一次資料，畫面會自己更新、不用手動重新整理——只在分頁還開著、瀏覽器
// 分頁在前景時才會抓（TanStack Query 預設行為），不會一直在背景空轉。真正
// 逐秒即時的 Supabase Realtime 留給最常盯著看的機隊看板（見
// useAircraftBoardRealtime），這裡不需要到那麼即時。
const DASHBOARD_POLL_INTERVAL_MS = 60_000;

// --- Today Center: Daily Checklist ------------------------------------------

export function useTodayChecklist() {
  return useQuery({
    queryKey: ["planning", "checklist", "today"],
    queryFn: () => fetchJson<ChecklistWithRate>("/api/planning/checklist"),
    refetchInterval: DASHBOARD_POLL_INTERVAL_MS,
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

const MONTHLY_CHECKLIST_KEY = ["planning", "monthly-checklist"];

export function useMonthlyChecklist() {
  return useQuery({
    queryKey: MONTHLY_CHECKLIST_KEY,
    queryFn: () => fetchJson<MonthlyChecklistWithItems>("/api/planning/monthly-checklist"),
    refetchInterval: DASHBOARD_POLL_INTERVAL_MS,
  });
}

/** Optimistic: 打勾當下就立刻顯示完成/取消，不用等伺服器回應——背景仍會送出
 * PATCH 並在完成後跟伺服器同步，失敗的話會自動退回原狀並跳出錯誤提示。 */
export function useUpdateMonthlyChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_completed }: { id: string; is_completed: boolean }) =>
      fetchJson(`/api/planning/monthly-checklist-items/${id}`, { method: "PATCH", body: JSON.stringify({ is_completed }) }),
    onMutate: async ({ id, is_completed }) => {
      await queryClient.cancelQueries({ queryKey: MONTHLY_CHECKLIST_KEY });
      const previous = queryClient.getQueryData<MonthlyChecklistWithItems>(MONTHLY_CHECKLIST_KEY);
      if (previous) {
        queryClient.setQueryData<MonthlyChecklistWithItems>(MONTHLY_CHECKLIST_KEY, {
          ...previous,
          items: previous.items.map((item) => (item.id === id ? { ...item, is_completed } : item)),
        });
      }
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(MONTHLY_CHECKLIST_KEY, context.previous);
      toast.error(err.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: MONTHLY_CHECKLIST_KEY }),
  });
}

// --- Waiting Center ----------------------------------------------------------

export function useWaitingItems(status?: string) {
  return useQuery({
    queryKey: ["planning", "waiting", status ?? "Waiting"],
    queryFn: () => fetchJson<WaitingItemWithTask[]>(`/api/planning/waiting?status=${status ?? "Waiting"}`),
    refetchInterval: DASHBOARD_POLL_INTERVAL_MS,
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
    refetchInterval: DASHBOARD_POLL_INTERVAL_MS,
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
    refetchInterval: DASHBOARD_POLL_INTERVAL_MS,
  });
}

// --- Planning KPI / Analytics / AI Briefing ----------------------------------

export function usePlanningKpis() {
  return useQuery({
    queryKey: ["planning", "kpi"],
    queryFn: () => fetchJson<PlanningKpis>("/api/planning/kpi"),
    refetchInterval: DASHBOARD_POLL_INTERVAL_MS,
  });
}

export function usePlanningAnalytics() {
  return useQuery({
    queryKey: ["planning", "analytics"],
    queryFn: () => fetchJson<PlanningAnalytics>("/api/planning/analytics"),
    refetchInterval: DASHBOARD_POLL_INTERVAL_MS,
  });
}

export function useDailyBriefing() {
  return useQuery({
    queryKey: ["planning", "briefing"],
    queryFn: () => fetchJson<PlanningBriefing>("/api/planning/briefing"),
  });
}
