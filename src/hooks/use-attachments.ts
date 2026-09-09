"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AttachmentWithRelations, DocumentSearchResult } from "@/types/domain";
import type { AttachmentCategory } from "@/types/database.types";

export type AttachmentFilters = {
  task_id?: string;
  inbox?: boolean;
  category?: string[];
  screen_type?: string[];
  ocr_status?: string[];
  ai_status?: string[];
  q?: string;
  page?: number;
  pageSize?: number;
};

type AttachmentsResponse = { data: AttachmentWithRelations[]; total: number; page: number; pageSize: number };

function buildSearchParams(filters: AttachmentFilters) {
  const sp = new URLSearchParams();
  if (filters.task_id) sp.set("task_id", filters.task_id);
  if (filters.inbox) sp.set("inbox", "true");
  if (filters.category?.length) sp.set("category", filters.category.join(","));
  if (filters.screen_type?.length) sp.set("screen_type", filters.screen_type.join(","));
  if (filters.ocr_status?.length) sp.set("ocr_status", filters.ocr_status.join(","));
  if (filters.ai_status?.length) sp.set("ai_status", filters.ai_status.join(","));
  if (filters.q) sp.set("q", filters.q);
  sp.set("page", String(filters.page ?? 1));
  sp.set("pageSize", String(filters.pageSize ?? 50));
  return sp;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `發生錯誤（${res.status}）`);
  return body as T;
}

/** True while any row in the page is still being processed — used to drive polling. */
function hasPendingWork(data: AttachmentsResponse | undefined) {
  return !!data?.data.some((a) => a.ocr_status === "pending" || a.ocr_status === "processing" || a.ai_status === "pending" || a.ai_status === "processing");
}

export function useAttachments(filters: AttachmentFilters) {
  return useQuery({
    queryKey: ["attachments", filters],
    queryFn: () => fetchJson<AttachmentsResponse>(`/api/attachments?${buildSearchParams(filters).toString()}`),
    placeholderData: (prev) => prev,
    refetchInterval: (query) => (hasPendingWork(query.state.data) ? 3000 : false),
  });
}

export function useAttachment(id: string | undefined) {
  return useQuery({
    queryKey: ["attachment", id],
    queryFn: () => fetchJson<AttachmentWithRelations>(`/api/attachments/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const a = query.state.data;
      const pending = a && (a.ocr_status === "pending" || a.ocr_status === "processing" || a.ai_status === "pending" || a.ai_status === "processing");
      return pending ? 3000 : false;
    },
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, taskId, category }: { file: File; taskId?: string | null; category?: AttachmentCategory }) => {
      const form = new FormData();
      form.set("file", file);
      if (taskId) form.set("task_id", taskId);
      if (category) form.set("category", category);
      return fetchJson<AttachmentWithRelations>("/api/upload", { method: "POST", body: form });
    },
    onSuccess: () => {
      toast.success("附件已上傳，正在背景進行 OCR 與 AI 分析");
      queryClient.invalidateQueries({ queryKey: ["attachments"] });
      queryClient.invalidateQueries({ queryKey: ["document-intelligence-stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson<{ ok: true }>(`/api/attachments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("附件已刪除");
      queryClient.invalidateQueries({ queryKey: ["attachments"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRetryOcr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => fetchJson("/api/ocr", { method: "POST", body: JSON.stringify({ attachment_id: attachmentId }) }),
    onSuccess: () => {
      toast.success("已重新送出 OCR 辨識");
      queryClient.invalidateQueries({ queryKey: ["attachments"] });
      queryClient.invalidateQueries({ queryKey: ["attachment"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRetryAiAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => fetchJson("/api/ai-analysis", { method: "POST", body: JSON.stringify({ attachment_id: attachmentId }) }),
    onSuccess: () => {
      toast.success("已重新送出 AI 分析");
      queryClient.invalidateQueries({ queryKey: ["attachments"] });
      queryClient.invalidateQueries({ queryKey: ["attachment"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useLinkAttachmentToTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attachmentId, taskId }: { attachmentId: string; taskId: string }) =>
      fetchJson(`/api/attachments/${attachmentId}/link`, { method: "POST", body: JSON.stringify({ task_id: taskId }) }),
    onSuccess: () => {
      toast.success("已連結至任務");
      queryClient.invalidateQueries({ queryKey: ["attachments"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export async function fetchAttachmentSignedUrl(id: string) {
  const { url } = await fetchJson<{ url: string }>(`/api/attachments/${id}/url`);
  return url;
}

export function useDocumentSearch(term: string) {
  return useQuery({
    queryKey: ["document-search", term],
    queryFn: () => fetchJson<{ data: DocumentSearchResult[] }>(`/api/document-search?q=${encodeURIComponent(term)}`),
    enabled: term.trim().length > 0,
  });
}

export function useDocumentIntelligenceStats() {
  return useQuery({
    queryKey: ["document-intelligence-stats"],
    queryFn: () => fetchJson<{ totalAttachments: number; ocrCompleted: number; pendingAnalysis: number; aiCompleted: number }>(
      "/api/attachments/stats"
    ),
  });
}
