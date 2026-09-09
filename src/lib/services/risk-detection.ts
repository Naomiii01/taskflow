import "server-only";

import { differenceInCalendarDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import type { EngineTaskSnapshot } from "@/lib/repositories/tasks-repository";
import * as followupsRepo from "@/lib/repositories/followups-repository";
import * as lookupsRepo from "@/lib/repositories/lookups-repository";
import type { RiskLevel, TaskRiskScore } from "@/types/domain";

type DB = SupabaseClient<Database, "taskflow">;

/**
 * Risk Detection Engine — a deterministic, explainable 0-100 score rather
 * than an AI-guessed number, so it's cheap to compute for every open task
 * (dashboard/reports/AI tool all reuse this) and the same inputs always
 * produce the same score. Four signals, matching the Phase 6 spec exactly:
 * overdue days, days since last activity, cross-department follow-up churn
 * (a task bouncing between departments = stuck), and repeated tracking
 * without resolution.
 */

function overdueScore(daysOverdue: number) {
  if (daysOverdue <= 0) return 0;
  return Math.min(40, 10 + daysOverdue * 2);
}

function staleScore(daysSinceActivity: number) {
  if (daysSinceActivity >= 30) return 30;
  if (daysSinceActivity >= 14) return 20;
  if (daysSinceActivity >= 7) return 10;
  return 0;
}

function multiDepartmentScore(distinctDepartments: number) {
  if (distinctDepartments >= 3) return 20;
  if (distinctDepartments >= 2) return 10;
  return 0;
}

function repeatedTrackingScore(followupCount: number) {
  if (followupCount >= 5) return 15;
  if (followupCount >= 3) return 8;
  return 0;
}

function levelFor(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

type FollowupDetail = { task_id: string; followup_date: string; created_at: string; department_name: string | null };

function scoreOne(
  task: EngineTaskSnapshot,
  followups: FollowupDetail[],
  departmentName: string | null
): TaskRiskScore {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysOverdue = task.due_date ? differenceInCalendarDays(today, new Date(`${task.due_date}T00:00:00`)) : 0;

  const latestActivityAt = followups.reduce(
    (latest, f) => (f.created_at > latest ? f.created_at : latest),
    task.updated_at
  );
  const daysSinceActivity = differenceInCalendarDays(new Date(), new Date(latestActivityAt));

  const distinctDepartments = new Set(followups.map((f) => f.department_name).filter((d): d is string => !!d)).size;

  const oScore = overdueScore(daysOverdue);
  const sScore = staleScore(daysSinceActivity);
  const mScore = multiDepartmentScore(distinctDepartments);
  const rScore = repeatedTrackingScore(followups.length);
  const score = Math.min(100, oScore + sScore + mScore + rScore);

  const reasons: string[] = [];
  if (oScore > 0) reasons.push(`已超期 ${daysOverdue} 天`);
  if (sScore > 0) reasons.push(`已 ${daysSinceActivity} 天沒有更新`);
  if (mScore > 0) reasons.push(`追蹤紀錄橫跨 ${distinctDepartments} 個部門，可能卡在多部門之間`);
  if (rScore > 0) reasons.push(`已追蹤 ${followups.length} 次仍未結案`);
  if (!reasons.length) reasons.push("目前無明顯風險訊號");

  return {
    taskId: task.id,
    taskNumber: task.task_number,
    title: task.title,
    departmentName,
    score,
    level: levelFor(score),
    reasons,
  };
}

/** Scores every open task. Pass a subset of `tasks` (e.g. one department) to scope it. */
export async function computeRiskScores(
  supabase: DB,
  options?: { tasks?: EngineTaskSnapshot[]; departmentNameById?: Map<string, string> }
): Promise<TaskRiskScore[]> {
  const tasks = options?.tasks ?? (await tasksRepo.findOpenTasksForEngines(supabase));
  const followups = await followupsRepo.findFollowupDetailsByTasks(
    supabase,
    tasks.map((t) => t.id)
  );

  const followupsByTask = new Map<string, FollowupDetail[]>();
  for (const f of followups) {
    const list = followupsByTask.get(f.task_id);
    if (list) list.push(f);
    else followupsByTask.set(f.task_id, [f]);
  }

  return tasks.map((t) =>
    scoreOne(
      t,
      followupsByTask.get(t.id) ?? [],
      t.department_id ? options?.departmentNameById?.get(t.department_id) ?? null : null
    )
  );
}

/** Top N riskiest open tasks, sorted highest score first — used by the
 * dashboard, reports, and the AI Assistant's "最近有哪些高風險事項" tool. */
export async function findTopRiskTasks(supabase: DB, limit = 10): Promise<TaskRiskScore[]> {
  const departments = await lookupsRepo.findAllDepartments(supabase);
  const departmentNameById = new Map(departments.map((d) => [d.id, d.department_name]));
  const scores = await computeRiskScores(supabase, { departmentNameById });
  return scores.sort((a, b) => b.score - a.score).slice(0, limit);
}
