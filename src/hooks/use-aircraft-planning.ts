"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
  GroundWindowValues,
  GroundWindowUpdateValues,
  PlanningBoardSettingsValues,
  DepartmentWindowValues,
  DepartmentWindowUpdateValues,
} from "@/lib/validations/planning";

export type PlanningBoardWindow = {
  id: string;
  station: string;
  arrivalAt: string;
  departureAt: string;
  groundTimeMinutes: number;
  isOvernight: boolean;
  isDayStop: boolean;
  needsConfirmation: boolean;
  notes: string | null;
  // Planning Information — null when this ground stay has no major work planned.
  currentStatus: string | null;
  majorWorkPlanned: string | null;
  estimatedMh: number | null;
  requiredSkill: string | null;
  requiredEquipment: string | null;
  requiredAuthorization: string | null;
  planningStatus: string | null;
  shift: string | null;
};

export type PlanningBoardResidencyWindow = {
  id: string;
  station: string;
  startDate: string;
  endDate: string;
  notes: string | null;
};

export type MaintenanceDepartment = "機坪" | "基地";

/** end 是「含當天」（inclusive）——跟 PlanningBoardResidencyWindow 的半開
 * 區間不同，比對日期時要用 <= 而不是 <。 */
export type PlanningBoardDepartmentWindow = {
  id: string;
  department: MaintenanceDepartment;
  startDate: string;
  endDate: string;
  description: string | null;
};

export type PlanningBoardAircraft = {
  aircraftRegistration: string;
  aircraftType: string;
  homeStation: string;
  windows: PlanningBoardWindow[];
  residencyWindows: PlanningBoardResidencyWindow[];
  departmentWindows: PlanningBoardDepartmentWindow[];
};

export type DailyCapacity = {
  date: string;
  majorWorkCount: number;
  mhTotal: number;
  rmqAircraftCount: number;
  khhAircraftCount: number;
  tpeAircraftCount: number;
  rmqGroundHours: number;
  khhGroundHours: number;
  tpeGroundHours: number;
};

export type DashboardSummary = {
  todayMajorWorkCount: number;
  weekMajorWorkCount: number;
  rmqResidentCount: number;
  khhResidentCount: number;
  overnightAircraftCount: number;
  unscheduledTaskCount: number;
  rmqGroundHoursToday: number;
  khhGroundHoursToday: number;
  tpeGroundHoursToday: number;
};

export type BoardCapacitySettings = { yellowThreshold: number; redThreshold: number };

export type PlanningBoard = {
  start: string;
  end: string;
  aircraft: PlanningBoardAircraft[];
  dailyCapacity: DailyCapacity[];
  dashboardSummary: DashboardSummary;
  capacitySettings: BoardCapacitySettings;
};

export type AffectedPlanWindow = {
  id: string;
  aircraftRegistration: string;
  station: string;
  changeType: "time_changed" | "orphaned";
  oldArrivalAt: string;
  oldDepartureAt: string;
  newArrivalAt: string | null;
  newDepartureAt: string | null;
};

export type ImportResult = {
  imported: number;
  skipped: { row: number; reason: string }[];
  affectedPlanWindows: AffectedPlanWindow[];
};

export type GroundWindowChangeLogEntry = {
  id: string;
  groundWindowId: string;
  aircraftRegistration: string;
  station: string;
  changeType: "time_changed" | "orphaned";
  oldArrivalAt: string;
  oldDepartureAt: string;
  newArrivalAt: string | null;
  newDepartureAt: string | null;
  planSnapshot: { majorWorkPlanned: string | null; shift: string | null; estimatedMh: number | null };
  changedBy: { id: string; name: string | null; email: string } | null;
  createdAt: string;
};

export type GroundWindowSearchResult = PlanningBoardWindow & {
  aircraftRegistration: string;
  matchedIn: ("aircraft" | "station" | "work")[];
};

export type LinkableTask = {
  id: string;
  taskNumber: string;
  title: string;
  linkedGroundWindowId: string | null;
};

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `發生錯誤（${res.status}）`);
  return body as T;
}

/** `end` is exclusive — pass the day after the last visible column. */
export function useAircraftPlanningBoard(start: string, end: string) {
  return useQuery({
    queryKey: ["planning", "aircraft-board", start, end],
    queryFn: () => fetchJson<PlanningBoard>(`/api/planning/aircraft-board?start=${start}&end=${end}`),
    placeholderData: (prev) => prev,
  });
}

export function useCreateGroundWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: GroundWindowValues) =>
      fetchJson<PlanningBoardWindow>("/api/planning/ground-windows", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success("地面時間已新增");
      queryClient.invalidateQueries({ queryKey: ["planning", "aircraft-board"] });
      queryClient.invalidateQueries({ queryKey: ["planning", "linkable-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateGroundWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: GroundWindowUpdateValues }) =>
      fetchJson<PlanningBoardWindow>(`/api/planning/ground-windows/${id}`, { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success("地面時間已更新");
      queryClient.invalidateQueries({ queryKey: ["planning", "aircraft-board"] });
      queryClient.invalidateQueries({ queryKey: ["planning", "linkable-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteGroundWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/planning/ground-windows/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("地面時間已刪除");
      queryClient.invalidateQueries({ queryKey: ["planning", "aircraft-board"] });
      queryClient.invalidateQueries({ queryKey: ["planning", "linkable-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// 機坪／基地部門標示——通常從年度維修計畫表匯入，但臨時計畫（例如 HMV 提前/
// 延後）常會變動，所以也開放直接在畫面上新增／編輯／刪除。
export function useCreateDepartmentWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: DepartmentWindowValues) =>
      fetchJson<PlanningBoardDepartmentWindow>("/api/planning/department-windows", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success("部門標示已新增");
      queryClient.invalidateQueries({ queryKey: ["planning", "aircraft-board"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateDepartmentWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: DepartmentWindowUpdateValues }) =>
      fetchJson<PlanningBoardDepartmentWindow>(`/api/planning/department-windows/${id}`, { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success("部門標示已更新");
      queryClient.invalidateQueries({ queryKey: ["planning", "aircraft-board"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteDepartmentWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/planning/department-windows/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("部門標示已刪除");
      queryClient.invalidateQueries({ queryKey: ["planning", "aircraft-board"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Capacity Warning 門檻——先用預設值，畫面上可以自己調。 */
export function useBoardSettings() {
  return useQuery({
    queryKey: ["planning", "board-settings"],
    queryFn: () => fetchJson<BoardCapacitySettings>("/api/planning/board-settings"),
  });
}

export function useUpdateBoardSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: PlanningBoardSettingsValues) =>
      fetchJson<BoardCapacitySettings>("/api/planning/board-settings", { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success("警示門檻已更新");
      queryClient.invalidateQueries({ queryKey: ["planning", "board-settings"] });
      queryClient.invalidateQueries({ queryKey: ["planning", "aircraft-board"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Todo 工單清單——供地面時間視窗的「排入此窗口的工單」勾選器使用。 */
export function useLinkableTasks() {
  return useQuery({
    queryKey: ["planning", "linkable-tasks"],
    queryFn: () => fetchJson<LinkableTask[]>("/api/planning/linkable-tasks"),
  });
}

export function useImportGroundWindows() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.set("file", file);
      return fetchJson<ImportResult>("/api/planning/ground-windows/import", { method: "POST", body: form });
    },
    onSuccess: (result) => {
      if (result.imported > 0) toast.success(`已匯入 ${result.imported} 筆地面時間`);
      if (result.skipped.length > 0) toast.warning(`有 ${result.skipped.length} 列無法匯入，請查看明細`);
      if (result.affectedPlanWindows.length > 0) {
        toast.warning(`有 ${result.affectedPlanWindows.length} 筆已排工的地停時間有異動，請查看明細確認`);
      }
      queryClient.invalidateQueries({ queryKey: ["planning", "aircraft-board"] });
      queryClient.invalidateQueries({ queryKey: ["planning", "ground-window-changes"] });
      queryClient.invalidateQueries({ queryKey: ["planning", "ground-window-change-log"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** 單一地停的異動歷史——編輯視窗裡的「異動紀錄」用，只在有 windowId 時才查。 */
export function useGroundWindowChangeLog(windowId?: string) {
  return useQuery({
    queryKey: ["planning", "ground-window-change-log", windowId],
    queryFn: () => fetchJson<GroundWindowChangeLogEntry[]>(`/api/planning/ground-windows/${windowId}/change-log`),
    enabled: !!windowId,
  });
}

/** 全機隊最近的異動紀錄——看板工具列的「異動紀錄」列表用。 */
export function useRecentGroundWindowChanges(enabled: boolean) {
  return useQuery({
    queryKey: ["planning", "ground-window-changes"],
    queryFn: () => fetchJson<GroundWindowChangeLogEntry[]>("/api/planning/ground-window-changes"),
    enabled,
  });
}

/** 搜尋中心「計畫看板」分頁——用機號／站別／工作內容關鍵字搜尋地停紀錄。 */
export function useSearchGroundWindows(term: string) {
  return useQuery({
    queryKey: ["planning", "ground-windows-search", term],
    queryFn: () => fetchJson<{ data: GroundWindowSearchResult[] }>(`/api/planning/ground-windows/search?q=${encodeURIComponent(term)}`),
    enabled: term.trim().length > 0,
  });
}
