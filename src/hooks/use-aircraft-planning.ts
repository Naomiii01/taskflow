"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { GroundWindowValues, GroundWindowUpdateValues } from "@/lib/validations/planning";

export type PlanningBoardWindow = {
  id: string;
  station: string;
  arrivalAt: string;
  departureAt: string;
  groundTimeMinutes: number;
  isOvernight: boolean;
  notes: string | null;
};

export type PlanningBoardAircraft = {
  aircraftRegistration: string;
  aircraftType: string;
  homeStation: string;
  windows: PlanningBoardWindow[];
};

export type PlanningBoard = {
  start: string;
  end: string;
  aircraft: PlanningBoardAircraft[];
};

export type ImportResult = {
  imported: number;
  skipped: { row: number; reason: string }[];
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
    },
    onError: (err: Error) => toast.error(err.message),
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
      queryClient.invalidateQueries({ queryKey: ["planning", "aircraft-board"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
