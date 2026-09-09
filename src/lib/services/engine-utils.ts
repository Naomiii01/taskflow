import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as notificationsRepo from "@/lib/repositories/notifications-repository";

type DB = SupabaseClient<Database, "taskflow">;

/** Shared helpers for the scheduled engines (reminder/overdue/follow-up/
 * escalation/department-delay) — kept in one place so the daily-run dedup
 * logic can't drift between engines. */

export function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** Creates a notification unless the same (user, task, type) already fired
 * since `since` (defaults to start of today) — the cron-rerun dedup guard.
 * Pass a longer `since` (e.g. `daysAgoIso(7)`) for weekly/costlier checks. */
export async function notifyOnce(
  supabase: DB,
  params: {
    userId: string;
    relatedTaskId: string | null;
    type: string;
    title: string;
    message: string;
    since?: string;
  }
) {
  const exists = await notificationsRepo.notificationExistsSince(supabase, {
    userId: params.userId,
    relatedTaskId: params.relatedTaskId,
    type: params.type,
    since: params.since ?? startOfTodayIso(),
  });
  if (exists) return false;
  await notificationsRepo.createNotification(supabase, {
    user_id: params.userId,
    related_task_id: params.relatedTaskId,
    type: params.type as Database["taskflow"]["Tables"]["notifications"]["Insert"]["type"],
    title: params.title,
    message: params.message,
  });
  return true;
}
