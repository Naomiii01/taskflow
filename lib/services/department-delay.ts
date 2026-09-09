import "server-only";

import { differenceInCalendarDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import type { AnalysisTaskSnapshot } from "@/lib/repositories/tasks-repository";
import * as followupsRepo from "@/lib/repositories/followups-repository";
import { daysAgoIso, notifyOnce } from "@/lib/services/engine-utils";
import type { DepartmentDelay } from "@/types/domain";

type DB = SupabaseClient<Database, "taskflow">;
type DepartmentLookup = { id: string; department_name: string; manager: string | null };
type AdminLookup = { id: string; name: string | null; email: string };

const OPEN_STATUSES: Database["taskflow"]["Enums"]["task_status"][] = [
  "Todo",
  "In Progress",
  "Waiting Response",
  "Pending Approval",
];

/** A department counts as a delay hotspot once at least this many open tasks
 * exist AND this share of them are overdue — avoids flagging a department
 * with e.g. 1 overdue task out of 1. */
const OVERDUE_RATE_ALERT_THRESHOLD = 0.3;
const MIN_OPEN_TASKS_FOR_ALERT = 3;

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/**
 * Department Delay Analysis: per department, average response time
 * (task creation → first follow-up), average resolution time (task
 * creation → updated_at, Completed tasks only), and the overdue rate
 * among that department's currently-open tasks.
 */
export async function computeDepartmentDelay(
  supabase: DB,
  departments: DepartmentLookup[]
): Promise<DepartmentDelay[]> {
  const tasks = await tasksRepo.findAllTasksForAnalysis(supabase);
  const followups = await followupsRepo.findFollowupsByTasks(
    supabase,
    tasks.map((t) => t.id)
  );

  const firstFollowupByTask = new Map<string, string>();
  for (const f of followups) {
    const existing = firstFollowupByTask.get(f.task_id);
    if (!existing || f.created_at < existing) firstFollowupByTask.set(f.task_id, f.created_at);
  }

  const byDepartment = new Map<string, AnalysisTaskSnapshot[]>();
  for (const t of tasks) {
    if (!t.department_id) continue;
    const list = byDepartment.get(t.department_id);
    if (list) list.push(t);
    else byDepartment.set(t.department_id, [t]);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return departments.map((d) => {
    const deptTasks = byDepartment.get(d.id) ?? [];
    const openTasks = deptTasks.filter((t) => OPEN_STATUSES.includes(t.status));

    const responseDays = deptTasks
      .map((t) => {
        const first = firstFollowupByTask.get(t.id);
        return first ? differenceInCalendarDays(new Date(first), new Date(t.created_at)) : null;
      })
      .filter((n): n is number => n !== null && n >= 0);

    const resolutionDays = deptTasks
      .filter((t) => t.status === "Completed")
      .map((t) => differenceInCalendarDays(new Date(t.updated_at), new Date(t.created_at)))
      .filter((n) => n >= 0);

    const overdueOpen = openTasks.filter(
      (t) => t.due_date && differenceInCalendarDays(today, new Date(`${t.due_date}T00:00:00`)) > 0
    );

    return {
      departmentId: d.id,
      departmentName: d.department_name,
      managerId: d.manager,
      avgResponseDays: average(responseDays),
      avgResolutionDays: average(resolutionDays),
      overdueRate: openTasks.length ? Math.round((overdueOpen.length / openTasks.length) * 100) / 100 : 0,
      openTasks: openTasks.length,
    };
  });
}

/**
 * Notifies each delayed department's manager (or every Admin, if the
 * department has no manager set) once per week when its overdue rate
 * crosses the alert threshold. Invoked from the Escalation Engine's daily
 * run, since the spec defines no separate department-delay endpoint.
 */
export async function notifyTopDelayDepartments(
  supabase: DB,
  departments: DepartmentLookup[],
  admins: AdminLookup[]
) {
  const delays = await computeDepartmentDelay(supabase, departments);
  const weeklyCooldown = daysAgoIso(7);
  let created = 0;

  for (const d of delays) {
    if (d.openTasks < MIN_OPEN_TASKS_FOR_ALERT || d.overdueRate < OVERDUE_RATE_ALERT_THRESHOLD) continue;

    const recipients = d.managerId ? [d.managerId] : admins.map((a) => a.id);
    const title = `⚠️ 部門延遲警示：${d.departmentName}`;
    const message = `${d.departmentName} 目前有 ${d.openTasks} 件進行中任務，超期率達 ${Math.round(
      d.overdueRate * 100
    )}%，請留意工作分配與資源調度。`;

    for (const userId of recipients) {
      const ok = await notifyOnce(supabase, {
        userId,
        relatedTaskId: null,
        type: "department_delay",
        title,
        message,
        since: weeklyCooldown,
      });
      if (ok) created++;
    }
  }
  return created;
}
