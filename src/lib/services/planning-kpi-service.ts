import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import * as waitingRepo from "@/lib/repositories/waiting-repository";
import * as supervisorRepo from "@/lib/repositories/supervisor-repository";
import { listProjectSummaries } from "@/lib/services/project-service";
import { AIRCRAFT_TYPES, STATIONS, STATION_LABELS, WORK_CATEGORIES, WORK_CATEGORY_LABELS } from "@/lib/constants";
import type { PlanningKpis, PlanningAnalytics, PlanningAnalyticsBreakdown } from "@/types/domain";

type DB = SupabaseClient<Database, "taskflow">;

function currentPlanningMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Planning KPI: 追蹤完成率/等待回覆數/超期事項/主管交辦完成率/月計畫完成率/
 * RMQ完成率/KHH完成率. RMQ/KHH completion rates are read off `projectCompletion`
 * by project code rather than being separate fields, since Project Center
 * already computes per-project completion for every project (not just those
 * two) and this avoids two near-duplicate code paths.
 */
export async function computePlanningKpis(supabase: DB): Promise<PlanningKpis> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const thisMonth = currentPlanningMonth();

  const [tasks, waitingItems, supervisorTasks, projectSummaries] = await Promise.all([
    tasksRepo.findAllTasksForPlanning(supabase),
    waitingRepo.findWaitingItems(supabase, { status: "Waiting" }),
    supervisorRepo.findSupervisorTasks(supabase),
    listProjectSummaries(supabase),
  ]);

  const trackedTasks = tasks.filter((t) => t.planning_status !== null);
  const trackingCompletionRate = trackedTasks.length
    ? Math.round((trackedTasks.filter((t) => t.planning_status === "Completed").length / trackedTasks.length) * 100)
    : 0;

  const overdueCount = tasks.filter(
    (t) => t.due_date && !["Completed", "Cancelled"].includes(t.status) && t.due_date < todayStr
  ).length;

  const supervisorCompletionRate = supervisorTasks.length
    ? Math.round((supervisorTasks.filter((t) => t.status === "Completed").length / supervisorTasks.length) * 100)
    : 0;

  const monthlyPlanTasks = tasks.filter((t) => t.planning_month === thisMonth);
  const monthlyPlanCompletionRate = monthlyPlanTasks.length
    ? Math.round((monthlyPlanTasks.filter((t) => t.status === "Completed").length / monthlyPlanTasks.length) * 100)
    : 0;

  return {
    trackingCompletionRate,
    waitingCount: waitingItems.length,
    overdueCount,
    supervisorCompletionRate,
    monthlyPlanCompletionRate,
    projectCompletion: projectSummaries.map((p) => ({ code: p.code, name: p.name, completionRate: p.completionRate })),
  };
}

function breakdown<T extends string>(tasks: { value: T | null }[], keys: readonly T[], labels?: Record<T, string>): PlanningAnalyticsBreakdown {
  return keys.map((key) => ({
    label: labels ? labels[key] : key,
    count: tasks.filter((t) => t.value === key).length,
  }));
}

/** Same as `breakdown`, but for the now multi-select aircraft_type/station
 * columns — a task with more than one selected value counts toward each of
 * its buckets (a job spanning A321+A339 adds one to both, not neither). */
function breakdownMulti<T extends string>(tasks: { values: T[] }[], keys: readonly T[], labels?: Record<T, string>): PlanningAnalyticsBreakdown {
  return keys.map((key) => ({
    label: labels ? labels[key] : key,
    count: tasks.filter((t) => t.values.includes(key)).length,
  }));
}

/** Analytics Enhancement: A321/A339/A351/A359工作量, TPE/TSA/RMQ/KHH工作量,
 * 長工時/短天期/額外工單(以及其餘 Work Category)工作量 — counts every
 * non-deleted task by aircraft type / station / work category. */
export async function computePlanningAnalytics(supabase: DB): Promise<PlanningAnalytics> {
  const tasks = await tasksRepo.findAllTasksForPlanning(supabase);

  return {
    byAircraftType: breakdownMulti(
      tasks.map((t) => ({ values: t.aircraft_type })),
      AIRCRAFT_TYPES
    ),
    byStation: breakdownMulti(
      tasks.map((t) => ({ values: t.station })),
      STATIONS,
      STATION_LABELS
    ),
    byWorkCategory: breakdown(
      tasks.map((t) => ({ value: t.work_category })),
      WORK_CATEGORIES,
      WORK_CATEGORY_LABELS
    ),
  };
}
