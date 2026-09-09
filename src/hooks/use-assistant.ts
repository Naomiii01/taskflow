"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ChatMessage, ChatResponse, ConversationSummary } from "@/types/domain";
import type { ReportRequestValues } from "@/lib/validations/assistant";

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `發生錯誤（${res.status}）`);
  return body as T;
}

export function useConversations() {
  return useQuery({
    queryKey: ["assistant", "conversations"],
    queryFn: () => fetchJson<{ conversations: ConversationSummary[] }>("/api/assistant/history"),
    select: (data) => data.conversations,
  });
}

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["assistant", "messages", conversationId],
    queryFn: () => fetchJson<{ messages: ChatMessage[] }>(`/api/assistant/history?conversation_id=${conversationId}`),
    select: (data) => data.messages,
    enabled: Boolean(conversationId),
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { conversation_id?: string; message: string }) =>
      fetchJson<ChatResponse>("/api/assistant/chat", { method: "POST", body: JSON.stringify(params) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assistant", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["assistant", "messages", data.conversationId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: (values: ReportRequestValues) =>
      fetchJson<Record<string, unknown>>("/api/assistant/report", { method: "POST", body: JSON.stringify(values) }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export type AssistantSearchResult = {
  semantic_search_configured: boolean;
  mode: "keyword";
  notice: string;
  tasks: { task_number: string; title: string; status: string; due_date: string | null }[];
  documents: { file_name: string; task_number: string | null; task_title: string | null; matched_in: string[] }[];
};

export function useAssistantSearch() {
  return useMutation({
    mutationFn: (q: string) =>
      fetchJson<AssistantSearchResult>("/api/assistant/search", { method: "POST", body: JSON.stringify({ q }) }),
    onError: (err: Error) => toast.error(err.message),
  });
}
