"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { CalendarEventFormValues, CalendarEventUpdateValues } from "@/lib/validations/calendar";
import type { CalendarItem } from "@/types/domain";

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `發生錯誤（${res.status}）`);
  return body as T;
}

export type CalendarFilters = {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  aircraft_type?: string;
  station?: string;
  project_code?: string;
};

function buildParams(filters: CalendarFilters) {
  const params = new URLSearchParams();
  params.set("start", filters.start);
  params.set("end", filters.end);
  if (filters.aircraft_type) params.set("aircraft_type", filters.aircraft_type);
  if (filters.station) params.set("station", filters.station);
  if (filters.project_code) params.set("project_code", filters.project_code);
  return params;
}

export function useCalendarItems(filters: CalendarFilters) {
  return useQuery({
    queryKey: ["calendar", filters],
    queryFn: () => fetchJson<{ data: CalendarItem[] }>(`/api/calendar?${buildParams(filters).toString()}`),
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CalendarEventFormValues) =>
      fetchJson("/api/calendar", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success("已新增行事曆事件");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: CalendarEventUpdateValues }) =>
      fetchJson(`/api/calendar/${id}`, { method: "PUT", body: JSON.stringify(values) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/calendar/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("已刪除行事曆事件");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
