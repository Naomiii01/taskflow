import "server-only";

import { differenceInCalendarDays } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { getDocumentIntelligenceStats as getDocumentIntelligenceStatsService } from "@/lib/services/attachments-service";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import * as followupsRepo from "@/lib/repositories/followups-repository";
import { getDepartmentDelayRanking } from "@/lib/services/escalation-engine";
import { ESCALATION_LEVELS, FOLLOWUP_MONITOR_THRESHOLDS } from "@/lib/constants";
import type { TaskStatus } from "@/types/database.types";
import type { DepartmentDelay } from "@/types/domain";

const ACTIVE_STATUSES: TaskStatus[] = ["Todo", "In Progress", "Waiting Response", "Pending Approval"];

export type DashboardStats = {
  dueToday: number;
  dueThisWeek: number;
  tracking: number;
  waitingResponse: number;
  completed: number;
  overdue: number;
};

export type DepartmentWorkload = { department: string; active: number; completed: number };
export type CompletionRate = { completed: number; total: number };
export type MonthlyCompleted = { month: string; count: number };
export type WeeklyTrend = { week: string; created: number; completed: number };

type TaskRow = {
  status: TaskStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  department: { department_name: string } | null;
};

/**
 * Loads the raw task rows once and derives every dashboard figure from the
 * same snapshot. Demo-scale data (hundreds/low-thousands of tasks) is fine
 * to aggregate in JS; past that, replace these with SQL views/RPCs.
 */
async function loadTasks(): Promise<TaskRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("status, due_date, created_at, updated_at, department:departments(department_name)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[dashboard] failed to load tasks", error.message);
    return [];
  }

  return (data ?? []) as unknown as TaskRow[];
}

function toDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date) {
  const date = toDateOnly(d);
  const day = date.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // Monday-start week
  date.setDate(date.getDate() - diff);
  return date;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const tasks = await loadTasks();
  const today = toDateOnly(new Date());
  const weekStart = startOfWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  let dueToday = 0;
  let dueThisWeek = 0;
  let tracking = 0;
  let waitingResponse = 0;
  let completed = 0;
  let overdue = 0;

  for (const t of tasks) {
    const isActive = ACTIVE_STATUSES.includes(t.status);
    const due = t.due_date ? toDateOnly(new Date(t.due_date)) : null;

    if (t.status === "Completed") completed += 1;
    if (t.status === "Waiting Response") waitingResponse += 1;
    if (isActive && (t.status === "In Progress" || t.status === "Waiting Response" || t.status === "Pending Approval")) {
      tracking += 1;
    }

    if (due && isActive) {
      if (due.getTime() === today.getTime()) dueToday += 1;
      if (due >= weekStart && due <= weekEnd) dueThisWeek += 1;
      if (due < today) overdue += 1;
    }
  }

  return { dueToday, dueThisWeek, tracking, waitingResponse, completed, overdue };
}

export async function getDepartmentWorkload(): Promise<DepartmentWorkload[]> {
  const tasks = await loadTasks();
  const byDept = new Map<string, { active: number; completed: number }>();

  for (const t of tasks) {
    const name = t.department?.department_name ?? "未分配";
    const entry = byDept.get(name) ?? { active: 0, completed: 0 };
    if (ACTIVE_STATUSES.includes(t.status)) entry.active += 1;
    if (t.status === "Completed") entry.completed += 1;
    byDept.set(name, entry);
  }

  return Array.from(byDept.entries())
    .map(([department, v]) => ({ department, ...v }))
    .sort((a, b) => b.active + b.completed - (a.active + a.completed));
}

export async function getCompletionRate(): Promise<CompletionRate> {
  const tasks = await loadTasks();
  const relevant = tasks.filter((t) => t.status !== "Cancelled");
  const completed = relevant.filter((t) => t.status === "Completed").length;
  return { completed, total: relevant.length };
}

const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

export async function getMonthlyCompleted(months = 6): Promise<MonthlyCompleted[]> {
  const tasks = await loadTasks();
  const now = new Date();
  const buckets: MonthlyCompleted[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ month: MONTH_LABELS[d.getMonth()], count: 0 });
  }

  for (const t of tasks) {
    if (t.status !== "Completed") continue;
    const updated = new Date(t.updated_at);
    const monthsAgo =
      (now.getFullYear() - updated.getFullYear()) * 12 + (now.getMonth() - updated.getMonth());
    if (monthsAgo >= 0 && monthsAgo < months) {
      buckets[months - 1 - monthsAgo].count += 1;
    }
  }

  return buckets;
}

export async function getWeeklyTrend(weeks = 8): Promise<WeeklyTrend[]> {
  const tasks = await loadTasks();
  const today = toDateOnly(new Date());
  const currentWeekStart = startOfWeek(today);

  const buckets: WeeklyTrend[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - i * 7);
    buckets.push({ week: `${start.getMonth() + 1}/${start.getDate()}`, created: 0, completed: 0 });
  }

  const oldestStart = new Date(currentWeekStart);
  oldestStart.setDate(oldestStart.getDate() - (weeks - 1) * 7);

  for (const t of tasks) {
    const created = toDateOnly(new Date(t.created_at));
    if (created >= oldestStart) {
      const idx = Math.floor((created.getTime() - oldestStart.getTime()) / (7 * 86400000));
      if (idx >= 0 && idx < weeks) buckets[idx].created += 1;
    }

    if (t.status === "Completed") {
      const updated = toDateOnly(new Date(t.updated_at));
      if (updated >= oldestStart) {
        const idx = Math.floor((updated.getTime() - oldestStart.getTime()) / (7 * 86400000));
        if (idx >= 0 && idx < weeks) buckets[idx].completed += 1;
      }
    }
  }

  return buckets;
}

/** Dashboard "Document Intelligence Widget": 附件數量 / OCR完成數 / 待分析數 / AI分析完成數. */
export async function getDocumentIntelligenceStats() {
  const supabase = await createClient();
  return getDocumentIntelligenceStatsService(supabase);
}

// --- Phase 4: Notification Center + Reminder/Escalation Engines --------

export type NotificationWidgetStats = {
  /** 今日提醒: due today or tomorrow. */
  todayReminders: number;
  /** 超期數. */
  overdueCount: number;
  /** 待追蹤數: no activity for FOLLOWUP_MONITOR_THRESHOLDS.reminder+ days. */
  needsFollowupCount: number;
  /** 需升級數: overdue long enough to have hit the Escalation Engine's Level 1 threshold. */
  needsEscalationCount: number;
};

/** Dashboard "Notification Widget": today's reminders / overdue / needs-followup / needs-escalation —
 * read-only equivalents of what the Reminder + Escalation Engines check, without writing any notifications. */
export async function getNotificationWidgetStats(): Promise<NotificationWidgetStats> {
  const supabase = await createClient();
  const tasks = await tasksRepo.findOpenTasksForEngines(supabase);
  const followups = await followupsRepo.findFollowupsByTasks(
    supabase,
    tasks.map((t) => t.id)
  );

  const latestActivityMap = new Map<string, string>();
  for (const f of followups) {
    const existing = latestActivityMap.get(f.task_id);
    if (!existing || f.created_at > existing) latestActivityMap.set(f.task_id, f.created_at);
  }

  const today = toDateOnly(new Date());
  const escalationDays = ESCALATION_LEVELS[0].days;

  let todayReminders = 0;
  let overdueCount = 0;
  let needsFollowupCount = 0;
  let needsEscalationCount = 0;

  for (const t of tasks) {
    if (t.due_date) {
      const daysUntilDue = differenceInCalendarDays(new Date(`${t.due_date}T00:00:00`), today);
      if (daysUntilDue === 0 || daysUntilDue === 1) todayReminders += 1;
      if (daysUntilDue < 0) {
        overdueCount += 1;
        if (Math.abs(daysUntilDue) >= escalationDays) needsEscalationCount += 1;
      }
    }

    const latestFollowupAt = latestActivityMap.get(t.id);
    const lastActivity = latestFollowupAt && latestFollowupAt > t.updated_at ? latestFollowupAt : t.updated_at;
    const daysSinceActivity = differenceInCalendarDays(new Date(), new Date(lastActivity));
    if (daysSinceActivity >= FOLLOWUP_MONITOR_THRESHOLDS.reminder) needsFollowupCount += 1;
  }

  return { todayReminders, overdueCount, needsFollowupCount, needsEscalationCount };
}

export type ResponseResolutionStats = { avgResponseDays: number | null; avgResolutionDays: number | null };

/** Dashboard KPI: 平均回覆天數 (task creation → first follow-up) / 平均結案天數 (creation → Completed). */
export async function getResponseResolutionStats(): Promise<ResponseResolutionStats> {
  const supabase = await createClient();
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

  const responseDays = tasks
    .map((t) => {
      const first = firstFollowupByTask.get(t.id);
      return first ? differenceInCalendarDays(new Date(first), new Date(t.created_at)) : null;
    })
    .filter((n): n is number => n !== null && n >= 0);

  const resolutionDays = tasks
    .filter((t) => t.status === "Completed")
    .map((t) => differenceInCalendarDays(new Date(t.updated_at), new Date(t.created_at)))
    .filter((n) => n >= 0);

  const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

  return { avgResponseDays: avg(responseDays), avgResolutionDays: avg(resolutionDays) };
}

/** Dashboard "Top Delay Departments" table: department ranking by overdue rate. */
export async function getTopDelayDepartments(limit = 5): Promise<DepartmentDelay[]> {
  const supabase = await createClient();
  const ranking = await getDepartmentDelayRanking(supabase);
  return ranking.slice(0, limit);
}
