import "server-only";

import { differenceInCalendarDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import type { EngineTaskSnapshot } from "@/lib/repositories/tasks-repository";
import * as followupsRepo from "@/lib/repositories/followups-repository";
import * as notificationSettingsRepo from "@/lib/repositories/notification-settings-repository";
import { notifyOnce, startOfTodayIso } from "@/lib/services/engine-utils";
import { FOLLOWUP_MONITOR_THRESHOLDS } from "@/lib/constants";
import type { DailySummary, EngineRunResult } from "@/types/domain";

type DB = SupabaseClient<Database, "taskflow">;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function latestActivityFor(task: EngineTaskSnapshot, latestActivityMap: Map<string, string>) {
  const latestFollowupAt = latestActivityMap.get(task.id);
  return latestFollowupAt && latestFollowupAt > task.updated_at ? latestFollowupAt : task.updated_at;
}

async function findRecentAiSuggestions(supabase: DB, userId?: string) {
  let q = supabase
    .from("notifications")
    .select("related_task_id, message, task:tasks!notifications_task_id_fkey(task_number, title)")
    .eq("type", "ai_recommendation")
    .gte("created_at", startOfTodayIso())
    .order("created_at", { ascending: false })
    .limit(20);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;

  return (data ?? [])
    .filter((n): n is typeof n & { related_task_id: string; task: NonNullable<(typeof n)["task"]> } =>
      Boolean(n.related_task_id && n.task)
    )
    .map((n) => {
      const dateMatch = n.message?.match(/建議追蹤日：(\d{4}-\d{2}-\d{2})/);
      return {
        taskId: n.related_task_id,
        taskNumber: n.task.task_number,
        title: n.task.title,
        suggestion: n.message ?? "",
        suggestedDate: dateMatch ? dateMatch[1] : null,
      };
    });
}

/**
 * Live-computed Daily Summary: 今日待辦 (due today) / 今日到期 (due tomorrow,
 * as an early-warning companion) / 超期事項 / 待追蹤事項 / AI建議事項.
 * Pass `userId` for a personal view (their own open tasks); omit it for the
 * org-wide Admin view.
 */
export async function computeDailySummary(supabase: DB, userId?: string): Promise<DailySummary> {
  const allTasks = await tasksRepo.findOpenTasksForEngines(supabase);
  const tasks = userId ? allTasks.filter((t) => t.owner_id === userId) : allTasks;

  const followups = await followupsRepo.findFollowupsByTasks(
    supabase,
    tasks.map((t) => t.id)
  );
  const latestActivityMap = new Map<string, string>();
  for (const f of followups) {
    const existing = latestActivityMap.get(f.task_id);
    if (!existing || f.created_at > existing) latestActivityMap.set(f.task_id, f.created_at);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dueToday = 0;
  let dueTomorrow = 0;
  let overdue = 0;
  let needsFollowup = 0;

  for (const t of tasks) {
    if (t.due_date) {
      const diff = differenceInCalendarDays(new Date(`${t.due_date}T00:00:00`), today);
      if (diff === 0) dueToday++;
      else if (diff === 1) dueTomorrow++;
      else if (diff < 0) overdue++;
    }
    const daysSinceActivity = differenceInCalendarDays(new Date(), new Date(latestActivityFor(t, latestActivityMap)));
    if (daysSinceActivity >= FOLLOWUP_MONITOR_THRESHOLDS.reminder) needsFollowup++;
  }

  const aiSuggestions = await findRecentAiSuggestions(supabase, userId);

  return { date: todayIso(), dueToday, dueTomorrow, overdue, needsFollowup, aiSuggestions };
}

/**
 * Scheduler entry point: for every user opted into 每日摘要, computes their
 * personal Daily Summary and files it as a `daily_summary` notification.
 * Requires a service-role client, since it writes on behalf of every user.
 */
export async function runDailySummaryEngine(supabase: DB): Promise<EngineRunResult> {
  const userIds = await notificationSettingsRepo.findUsersOptedIntoDigest(supabase, "daily_summary_enabled");
  let created = 0;

  for (const userId of userIds) {
    const summary = await computeDailySummary(supabase, userId);
    if (summary.dueToday + summary.overdue + summary.needsFollowup + summary.aiSuggestions.length === 0) continue;

    const message =
      `今日待辦到期 ${summary.dueToday} 件、明日到期 ${summary.dueTomorrow} 件、` +
      `超期 ${summary.overdue} 件、待追蹤 ${summary.needsFollowup} 件` +
      (summary.aiSuggestions.length ? `、AI 建議 ${summary.aiSuggestions.length} 件` : "") +
      "。";

    const ok = await notifyOnce(supabase, {
      userId,
      relatedTaskId: null,
      type: "daily_summary",
      title: `📋 每日摘要（${summary.date}）`,
      message,
    });
    if (ok) created++;
  }

  return { ran: true, notificationsCreated: created, details: { usersNotified: created } };
}
