import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { CurrentUser } from "@/lib/auth";
import * as notificationsRepo from "@/lib/repositories/notifications-repository";
import * as notificationSettingsRepo from "@/lib/repositories/notification-settings-repository";
import type { NotificationQuery, NotificationSettingsValues } from "@/lib/validations/notification";
import type { MarkReadValues } from "@/lib/validations/notification";
import { PermissionError } from "@/lib/errors";

export { PermissionError };

type DB = SupabaseClient<Database, "taskflow">;

/** Notification Center list: honors the viewer's role-based visibility
 * (User: own only; Manager: own + department; Admin: everything — enforced
 * again at the RLS layer, this just picks the right query shape) and always
 * includes the viewer's own unread count for the navbar bell badge. */
export async function listNotifications(supabase: DB, currentUser: CurrentUser, query: NotificationQuery) {
  const [{ data, total }, unreadCount] = await Promise.all([
    notificationsRepo.findNotifications(supabase, { id: currentUser.id, role: currentUser.role }, query),
    notificationsRepo.countUnread(supabase, currentUser.id),
  ]);
  return { data, total, unreadCount, page: query.page, pageSize: query.pageSize };
}

export async function getUnreadCount(supabase: DB, currentUser: CurrentUser) {
  return notificationsRepo.countUnread(supabase, currentUser.id);
}

export async function markNotificationRead(supabase: DB, currentUser: CurrentUser, values: MarkReadValues) {
  if (values.all) {
    await notificationsRepo.markAllRead(supabase, currentUser.id);
    return { all: true };
  }
  if (!values.id) throw new PermissionError("請提供要標記的通知 id，或設定 all: true");
  const data = await notificationsRepo.markRead(supabase, currentUser.id, values.id, values.is_read);
  return { all: false, notification: data };
}

export async function deleteNotification(supabase: DB, currentUser: CurrentUser, id: string) {
  await notificationsRepo.deleteNotification(supabase, currentUser.id, id);
}

export async function getNotificationSettings(supabase: DB, currentUser: CurrentUser) {
  return notificationSettingsRepo.findSettings(supabase, currentUser.id);
}

export async function updateNotificationSettings(
  supabase: DB,
  currentUser: CurrentUser,
  values: NotificationSettingsValues
) {
  return notificationSettingsRepo.upsertSettings(supabase, currentUser.id, values);
}
