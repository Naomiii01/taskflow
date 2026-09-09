"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { NotificationType } from "@/types/database.types";
import type { NotificationsListResponse } from "@/types/domain";

export type NotificationFilters = {
  type?: string[];
  is_read?: boolean;
  q?: string;
  mine?: boolean;
  page?: number;
  pageSize?: number;
};

function buildSearchParams(filters: NotificationFilters) {
  const sp = new URLSearchParams();
  if (filters.type?.length) sp.set("type", filters.type.join(","));
  if (filters.is_read !== undefined) sp.set("is_read", String(filters.is_read));
  if (filters.q) sp.set("q", filters.q);
  if (filters.mine) sp.set("mine", "true");
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
  if (!res.ok) throw new Error(body?.error ?? `發生錯誤（${res.status}）`);
  return body as T;
}

export function useNotifications(filters: NotificationFilters) {
  return useQuery({
    queryKey: ["notifications", "list", filters],
    queryFn: () => fetchJson<NotificationsListResponse>(`/api/notifications?${buildSearchParams(filters).toString()}`),
    placeholderData: (prev) => prev,
  });
}

/** Lightweight poll for the navbar bell badge — refreshed instantly on
 * mutation, and live-pushed via `useNotificationsRealtime` on new inserts. */
export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => fetchJson<NotificationsListResponse>("/api/notifications?pageSize=1"),
    select: (data) => data.unreadCount,
    staleTime: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; is_read?: boolean }) =>
      fetchJson("/api/notifications/read", { method: "PATCH", body: JSON.stringify(params) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson("/api/notifications/read", { method: "PATCH", body: JSON.stringify({ all: true }) }),
    onSuccess: () => {
      toast.success("已將全部通知標記為已讀");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/notifications/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("已刪除通知");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

type NotificationSettings = {
  user_id: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  push_enabled: boolean;
  daily_summary_enabled: boolean;
  weekly_summary_enabled: boolean;
};

export function useNotificationSettings() {
  return useQuery({
    queryKey: ["notification-settings"],
    queryFn: () => fetchJson<NotificationSettings>("/api/notification-settings"),
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: Partial<NotificationSettings>) =>
      fetchJson<NotificationSettings>("/api/notification-settings", { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success("通知設定已更新");
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

const TOAST_KIND: Record<NotificationType, "success" | "warning" | "error" | "info"> = {
  task_assigned: "info",
  task_updated: "info",
  task_overdue: "error",
  task_due_soon: "warning",
  followup_due: "warning",
  department_delay: "error",
  ai_recommendation: "info",
  document_processed: "success",
  escalation: "error",
  daily_summary: "info",
  weekly_summary: "info",
};

/**
 * Real-time Notification (Supabase Realtime): subscribes to INSERTs on this
 * user's own notification rows and surfaces each as a Toast, live-refreshing
 * the bell badge / list — mount once near the app root (Topbar) so it fires
 * no matter which page is open.
 */
export function useNotificationsRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "taskflow", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { title: string; message: string | null; type: NotificationType };
          const kind = TOAST_KIND[row.type] ?? "info";
          const toastFn = kind === "error" ? toast.error : kind === "warning" ? toast.warning : kind === "success" ? toast.success : toast.info;
          toastFn(row.title, { description: row.message ?? undefined });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
