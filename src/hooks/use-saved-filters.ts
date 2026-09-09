"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { SavedFilterValues } from "@/lib/validations/followup";
import type { Tables } from "@/types/database.types";

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `發生錯誤（${res.status}）`);
  return body as T;
}

export function useSavedFilters() {
  return useQuery({
    queryKey: ["saved-filters"],
    queryFn: () => fetchJson<{ data: Tables<"saved_filters">[] }>("/api/saved-filters"),
  });
}

export function useCreateSavedFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: SavedFilterValues) =>
      fetchJson<Tables<"saved_filters">>("/api/saved-filters", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success("已儲存篩選條件");
      queryClient.invalidateQueries({ queryKey: ["saved-filters"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSavedFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson<{ ok: true }>(`/api/saved-filters/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-filters"] }),
  });
}
