import "server-only";

import { differenceInCalendarDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import type { AnalysisTaskSnapshot } from "@/lib/repositories/tasks-repository";
import * as lookupsRepo from "@/lib/repositories/lookups-repository";
import * as notificationSettingsRepo from "@/lib/repositories/notification-settings-repository";
import { computeDepartmentDelay } from "@/lib/services/department-delay";
import { notifyOnce } from "@/lib/services/engine-utils";
import type { EngineRunResult, WeeklySummary } from "@/types/domain";

type DB = SupabaseClient<Database, "taskflow">;

/** Monday 00:00:00 through Sunday 23:59:59 of the current week — matches the
 * `dueThisWeek` convention already used by the task search filters. */
function currentWeekRange() {
  const today = new Date();
  const diffToMonday = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function within(dateIso: string, start: Date, end: Date) {
  const d = new Date(dateIso);
  return d >= start && d <= end;
}

/**
 * Live-computed Weekly Summary: 新增任務 / 完成任務 / 超期任務 for the
 * current Mon–Sun week, plus 部門排行 + 工作量分析 (department ranking by
 * completions and overdue rate — always org-wide, since it's a comparative
 * view). Pass `userId` to scope created/completed/overdue to one user's own
 * tasks; omit it for the org-wide Admin/Manager view.
 */
export async function computeWeeklySummary(supabase: DB, userId?: string): Promise<WeeklySummary> {
  const { start, end } = currentWeekRange();
  const allTasks = await tasksRepo.findAllTasksForAnalysis(supabase);
  const tasks: AnalysisTaskSnapshot[] = userId ? allTasks.filter((t) => t.owner_id === userId) : allTasks;

  const created = tasks.filter((t) => within(t.created_at, start, end)).length;
  const completed = tasks.filter((t) => t.status === "Completed" && within(t.updated_at, start, end)).length;
  const overdue = tasks.filter(
    (t) =>
      t.due_date &&
      t.status !== "Completed" &&
      t.status !== "Cancelled" &&
      differenceInCalendarDays(end, new Date(`${t.due_date}T00:00:00`)) > 0
  ).length;

  const departments = await lookupsRepo.findAllDepartments(supabase);
  const delays = await computeDepartmentDelay(supabase, departments);
  const departmentCompleted = new Map<string, number>();
  for (const t of allTasks) {
    if (t.status === "Completed" && t.department_id && within(t.updated_at, start, end)) {
      departmentCompleted.set(t.department_id, (departmentCompleted.get(t.department_id) ?? 0) + 1);
    }
  }

  const departmentRanking = delays
    .map((d) => ({
      departmentName: d.departmentName,
      completed: departmentCompleted.get(d.departmentId) ?? 0,
      overdueRate: d.overdueRate,
    }))
    .sort((a, b) => b.completed - a.completed);

  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
    created,
    completed,
    overdue,
    departmentRanking,
  };
}

/**
 * Scheduler entry point (weekly, Monday 09:00): for every user opted into
 * 每週摘要, computes their personal Weekly Summary and files it as a
 * `weekly_summary` notification. Requires a service-role client.
 */
export async function runWeeklySummaryEngine(supabase: DB): Promise<EngineRunResult> {
  const userIds = await notificationSettingsRepo.findUsersOptedIntoDigest(supabase, "weekly_summary_enabled");
  let created = 0;

  for (const userId of userIds) {
    const summary = await computeWeeklySummary(supabase, userId);
    const topDepartment = summary.departmentRanking[0];

    const message =
      `本週新增 ${summary.created} 件、完成 ${summary.completed} 件、超期 ${summary.overdue} 件。` +
      (topDepartment ? `本週完成最多的部門：${topDepartment.departmentName}（${topDepartment.completed} 件）。` : "");

    const ok = await notifyOnce(supabase, {
      userId,
      relatedTaskId: null,
      type: "weekly_summary",
      title: `🗓️ 每週摘要（${summary.weekStart} ~ ${summary.weekEnd}）`,
      message,
    });
    if (ok) created++;
  }

  return { ran: true, notificationsCreated: created, details: { usersNotified: created } };
}
