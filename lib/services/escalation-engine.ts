import "server-only";

import { differenceInCalendarDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import * as lookupsRepo from "@/lib/repositories/lookups-repository";
import { notifyOnce } from "@/lib/services/engine-utils";
import { computeDepartmentDelay, notifyTopDelayDepartments } from "@/lib/services/department-delay";
import { ESCALATION_LEVELS } from "@/lib/constants";
import type { EngineRunResult } from "@/types/domain";

type DB = SupabaseClient<Database, "taskflow">;
type EscalationLevel = (typeof ESCALATION_LEVELS)[number];

/**
 * Escalation Engine: a task overdue past 7 / 14 / 30 days escalates to
 * Level 1 (task owner), Level 2 (department manager), Level 3 (all Admins).
 * Only the single highest tier that currently applies fires, so a task
 * that's 40 days overdue triggers Level 3 alone, not all three. Also runs
 * the Department Delay Analysis notification pass, since the spec defines
 * no separate endpoint for it.
 */
export async function runEscalationEngine(supabase: DB): Promise<EngineRunResult> {
  const [tasks, departments, admins] = await Promise.all([
    tasksRepo.findOpenTasksForEngines(supabase),
    lookupsRepo.findAllDepartments(supabase),
    lookupsRepo.findAdmins(supabase),
  ]);

  const departmentById = new Map(departments.map((d) => [d.id, d]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let level1 = 0;
  let level2 = 0;
  let level3 = 0;

  for (const t of tasks) {
    if (!t.due_date) continue;
    const due = new Date(`${t.due_date}T00:00:00`);
    const daysOverdue = differenceInCalendarDays(today, due);
    if (daysOverdue <= 0) continue;

    // Pick only the single highest matching tier (levels are ordered 1→3, ascending days).
    let tier: EscalationLevel | null = null;
    for (const level of ESCALATION_LEVELS) {
      if (daysOverdue >= level.days) tier = level;
    }
    if (!tier) continue;

    const department = t.department_id ? departmentById.get(t.department_id) : undefined;
    const title = `🔺 任務升級通知：${t.title}`;
    const message = `任務 ${t.task_number} 已超期 ${daysOverdue} 天，觸發 ${tier.label}。`;

    let recipients: string[];
    if (tier.level === 1) recipients = t.owner_id ? [t.owner_id] : [];
    else if (tier.level === 2) recipients = department?.manager ? [department.manager] : [];
    else recipients = admins.map((a) => a.id);

    for (const userId of recipients) {
      const ok = await notifyOnce(supabase, {
        userId,
        relatedTaskId: t.id,
        type: "escalation",
        title,
        message,
      });
      if (!ok) continue;

      if (tier.level === 1) level1++;
      else if (tier.level === 2) level2++;
      else level3++;

      await supabase.from("task_logs").insert({
        task_id: t.id,
        action_type: "escalation_triggered",
        new_value: { level: tier.level, days_overdue: daysOverdue, notified_user_id: userId } as never,
        user_id: userId,
      });
    }
  }

  const departmentDelayNotified = await notifyTopDelayDepartments(supabase, departments, admins);

  return {
    ran: true,
    notificationsCreated: level1 + level2 + level3 + departmentDelayNotified,
    details: { level1, level2, level3, departmentDelayNotified },
  };
}

/** Live-computed department delay ranking, for the dashboard widget / API — no notifications, no side effects. */
export async function getDepartmentDelayRanking(supabase: DB) {
  const departments = await lookupsRepo.findAllDepartments(supabase);
  const delays = await computeDepartmentDelay(supabase, departments);
  return delays.sort((a, b) => b.overdueRate - a.overdueRate);
}
