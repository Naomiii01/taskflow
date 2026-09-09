"use client";

import { useQuery } from "@tanstack/react-query";

import type { TaskWithRelations } from "@/types/domain";

export function useSearchTasks(term: string) {
  return useQuery({
    queryKey: ["search", term],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "搜尋失敗");
      return body.data as TaskWithRelations[];
    },
    enabled: term.trim().length > 0,
  });
}
