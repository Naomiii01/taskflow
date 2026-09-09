import "server-only";

import { differenceInCalendarDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import * as lookupsRepo from "@/lib/repositories/lookups-repository";
import { taskQuerySchema } from "@/lib/validations/task";
import { AI_MODEL, getAnthropicClient } from "@/lib/ai/anthropic-client";
import { computeDailySummary } from "@/lib/services/daily-summary";
import { computeWeeklySummary } from "@/lib/services/weekly-summary";
import { computeDepartmentDelay } from "@/lib/services/department-delay";
import { findTopRiskTasks } from "@/lib/services/risk-detection";
import type { AssistantReport } from "@/types/domain";

type DB = SupabaseClient<Database, "taskflow">;

/**
 * Turns structured report stats into a short zh-TW narrative paragraph.
 * Soft-fails to a plain templated sentence if the AI provider isn't
 * configured or the call errors — a report's numbers are still fully usable
 * without the AI-written prose (same soft-fail philosophy as the Smart
 * Follow-up suggestions in reminder-engine.ts).
 */
async function narrate(instruction: string, dataJson: unknown, fallback: string): Promise<string> {
  try {
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `${instruction}\n\n以下是統計資料（JSON）：\n${JSON.stringify(dataJson)}\n\n請用 2-4 句繁體中文摘要重點，不要條列、不要重複輸出 JSON、不要加上標題。`,
        },
      ],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}

/** 今日待辦/到期/超期/待追蹤 + AI 建議 — reuses the Phase 4 Daily Summary engine. */
export async function generateDailyReport(supabase: DB, userId?: string): Promise<AssistantReport> {
  const summary = await computeDailySummary(supabase, userId);
  const fallback =
    `今日到期 ${summary.dueToday} 件、明日到期 ${summary.dueTomorrow} 件、` +
    `超期 ${summary.overdue} 件、待追蹤 ${summary.needsFollowup} 件。`;
  const narrative = await narrate("你是任務追蹤系統的助理，請摘要以下每日工作報告的重點：", summary, fallback);
  return { type: "daily" as const, ...summary, narrative };
}

/** 新增/完成/超期任務 + 部門排行 — reuses the Phase 4 Weekly Summary engine. */
export async function generateWeeklyReport(supabase: DB, userId?: string): Promise<AssistantReport> {
  const summary = await computeWeeklySummary(supabase, userId);
  const top = summary.departmentRanking[0];
  const fallback =
    `本週新增 ${summary.created} 件、完成 ${summary.completed} 件、超期 ${summary.overdue} 件。` +
    (top ? `完成最多的部門是 ${top.departmentName}（${top.completed} 件）。` : "");
  const narrative = await narrate("你是任務追蹤系統的助理，請摘要以下每週工作報告的重點：", summary, fallback);
  return { type: "weekly" as const, ...summary, narrative };
}

/** 月度新增/完成/超期 + 部門排行。month 省略則為當月。 */
export async function generateMonthlyReport(supabase: DB, month?: string): Promise<AssistantReport> {
  const now = month ? new Date(`${month}-01T00:00:00`) : new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const monthLabel = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

  const tasks = await tasksRepo.findAllTasksForAnalysis(supabase);
  const within = (iso: string) => {
    const d = new Date(iso);
    return d >= monthStart && d <= monthEnd;
  };

  const created = tasks.filter((t) => within(t.created_at)).length;
  const completed = tasks.filter((t) => t.status === "Completed" && within(t.updated_at)).length;
  const overdue = tasks.filter(
    (t) =>
      t.due_date &&
      t.status !== "Completed" &&
      t.status !== "Cancelled" &&
      differenceInCalendarDays(monthEnd, new Date(`${t.due_date}T00:00:00`)) > 0
  ).length;

  const departments = await lookupsRepo.findAllDepartments(supabase);
  const delays = await computeDepartmentDelay(supabase, departments);
  const completedByDept = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === "Completed" && t.department_id && within(t.updated_at)) {
      completedByDept.set(t.department_id, (completedByDept.get(t.department_id) ?? 0) + 1);
    }
  }
  const departmentRanking = delays
    .map((d) => ({ departmentName: d.departmentName, completed: completedByDept.get(d.departmentId) ?? 0, overdueRate: d.overdueRate }))
    .sort((a, b) => b.completed - a.completed);

  const stats = { month: monthLabel, created, completed, overdue, departmentRanking };
  const fallback = `${monthLabel} 新增 ${created} 件、完成 ${completed} 件、超期 ${overdue} 件。`;
  const narrative = await narrate("你是任務追蹤系統的助理，請摘要以下月報的重點：", stats, fallback);

  return { type: "monthly" as const, ...stats, narrative };
}

/** 依關鍵字（專案代號/任務編號/標題）彙整專案進度、部門分布與風險事項。 */
export async function generateProjectReport(supabase: DB, keyword: string): Promise<AssistantReport> {
  const query = taskQuerySchema.parse({ q: keyword, pageSize: 200, includeDeleted: false });
  // currentUserId only affects the `mine` filter, which isn't set for this query.
  const { data, total } = await tasksRepo.findTasks(supabase, query, "");

  const completed = data.filter((t) => t.status === "Completed").length;
  const inProgress = data.filter((t) => !["Completed", "Cancelled"].includes(t.status)).length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = data.filter(
    (t) =>
      t.due_date &&
      !["Completed", "Cancelled"].includes(t.status) &&
      differenceInCalendarDays(today, new Date(`${t.due_date}T00:00:00`)) > 0
  ).length;

  const byDept = new Map<string, number>();
  for (const t of data) {
    const name = t.department?.department_name ?? "未分配";
    byDept.set(name, (byDept.get(name) ?? 0) + 1);
  }

  const taskIds = new Set(data.map((t) => t.id));
  const riskItems = (await findTopRiskTasks(supabase, 50)).filter((r) => taskIds.has(r.taskId)).slice(0, 10);

  const stats = {
    projectKeyword: keyword,
    totalTasks: total,
    completed,
    inProgress,
    overdue,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
    departmentBreakdown: Array.from(byDept.entries()).map(([departmentName, count]) => ({ departmentName, count })),
    riskItems,
  };
  const fallback = `專案「${keyword}」共 ${total} 件任務，完成率 ${stats.completionRate}%，進行中 ${inProgress} 件，超期 ${overdue} 件。`;
  const narrative = await narrate("你是任務追蹤系統的助理，請摘要以下專案進度報告的重點：", stats, fallback);

  return { type: "project" as const, ...stats, narrative };
}

/** 單一部門的任務量、完成/超期、平均回覆與結案天數。 */
export async function generateDepartmentReport(supabase: DB, departmentId: string): Promise<AssistantReport> {
  const departments = await lookupsRepo.findAllDepartments(supabase);
  const department = departments.find((d) => d.id === departmentId);
  if (!department) throw new Error("找不到指定的部門");

  const delays = await computeDepartmentDelay(supabase, departments);
  const delay = delays.find((d) => d.departmentId === departmentId);

  const tasks = await tasksRepo.findAllTasksForAnalysis(supabase);
  const deptTasks = tasks.filter((t) => t.department_id === departmentId);
  const completed = deptTasks.filter((t) => t.status === "Completed").length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = deptTasks.filter(
    (t) =>
      t.due_date &&
      t.status !== "Completed" &&
      t.status !== "Cancelled" &&
      differenceInCalendarDays(today, new Date(`${t.due_date}T00:00:00`)) > 0
  ).length;

  const stats = {
    departmentName: department.department_name,
    totalTasks: deptTasks.length,
    completed,
    overdue,
    avgResponseDays: delay?.avgResponseDays ?? null,
    avgResolutionDays: delay?.avgResolutionDays ?? null,
  };
  const fallback = `${department.department_name} 共 ${stats.totalTasks} 件任務，已完成 ${completed} 件，超期 ${overdue} 件。`;
  const narrative = await narrate("你是任務追蹤系統的助理，請摘要以下部門報告的重點：", stats, fallback);

  return { type: "department" as const, ...stats, narrative };
}
