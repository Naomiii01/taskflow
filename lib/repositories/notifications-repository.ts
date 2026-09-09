import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, NotificationType } from "@/types/database.types";
import type { NotificationQuery } from "@/lib/validations/notification";

type DB = SupabaseClient<Database, "taskflow">;

const NOTIFICATION_SELECT = "*, task:tasks!notifications_task_id_fkey(id, task_number, title)";

export async function createNotification(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["notifications"]["Insert"]
) {
  const { data, error } = await supabase.from("notifications").insert(values).select("*").single();
  if (error) throw error;
  return data;
}

export async function createNotifications(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["notifications"]["Insert"][]
) {
  if (!values.length) return [];
  const { data, error } = await supabase.from("notifications").insert(values).select("*");
  if (error) throw error;
  return data ?? [];
}

/** Dedup guard for the scheduled engines: has this (user, task, type) combo already fired since `since`? */
export async function notificationExistsSince(
  supabase: DB,
  params: { userId: string; relatedTaskId: string | null; type: string; since: string }
) {
  let q = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .eq("type", params.type as NotificationType)
    .gte("created_at", params.since);
  q = params.relatedTaskId ? q.eq("related_task_id", params.relatedTaskId) : q.is("related_task_id", null);
  const { count, error } = await q;
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * `viewer.role` decides the default breadth: a User is always scoped to
 * their own notifications (belt-and-suspenders with the RLS policy, which
 * enforces the same thing); a Manager/Admin sees everything RLS allows them
 * (own + department, or everything, respectively) unless `query.mine`
 * narrows it back down to just their own inbox.
 */
export async function findNotifications(
  supabase: DB,
  viewer: { id: string; role: Database["taskflow"]["Enums"]["user_role"] },
  query: NotificationQuery
) {
  let q = supabase.from("notifications").select(NOTIFICATION_SELECT, { count: "exact" });

  if (viewer.role === "User" || query.mine) q = q.eq("user_id", viewer.id);

  if (query.type?.length) q = q.in("type", query.type as NotificationType[]);
  if (query.is_read !== undefined) q = q.eq("is_read", query.is_read);
  if (query.q && query.q.trim()) {
    const term = query.q.trim().replace(/[%_]/g, (m) => `\\${m}`);
    q = q.or(`title.ilike.%${term}%,message.ilike.%${term}%`);
  }

  q = q.order("created_at", { ascending: false });
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function countUnread(supabase: DB, userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markRead(supabase: DB, userId: string, id: string, isRead: boolean) {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: isRead })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function markAllRead(supabase: DB, userId: string) {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
  if (error) throw error;
}

export async function deleteNotification(supabase: DB, userId: string, id: string) {
  const { error } = await supabase.from("notifications").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}
