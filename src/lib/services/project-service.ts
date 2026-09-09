import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as planningLookupsRepo from "@/lib/repositories/planning-lookups-repository";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import { OPEN_STATUSES, type PlanningTaskSnapshot } from "@/lib/repositories/tasks-repository";
import { computeRiskScores } from "@/lib/services/risk-detection";
import type { ProjectSummary } from "@/types/domain";
import type { ProjectValues, MilestoneValues } from "@/lib/validations/planning";

type DB = SupabaseClient<Database, "taskflow">;

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Project Center summary: 任務數/完成率/待追蹤/超期/風險指數/里程碑 per project.
 * Risk Index reuses the same deterministic Risk Detection Engine as the
 * dashboard (averaged across the project's open tasks), rather than a
 * separate ad-hoc formula, so "high risk" means the same thing everywhere.
 */
export async function listProjectSummaries(supabase: DB): Promise<ProjectSummary[]> {
  const [projects, allTasks] = await Promise.all([
    planningLookupsRepo.findAllProjects(supabase),
    tasksRepo.findAllTasksForPlanning(supabase),
  ]);
  const milestones = await planningLookupsRepo.findMilestonesByProjects(
    supabase,
    projects.map((p) => p.id)
  );
  const milestonesByProject = new Map<string, typeof milestones>();
  for (const m of milestones) {
    const list = milestonesByProject.get(m.project_id);
    if (list) list.push(m);
    else milestonesByProject.set(m.project_id, [m]);
  }

  const today = todayDateOnly();
  const tasksByProject = new Map<string, PlanningTaskSnapshot[]>();
  for (const t of allTasks) {
    if (!t.project_id) continue;
    const list = tasksByProject.get(t.project_id);
    if (list) list.push(t);
    else tasksByProject.set(t.project_id, [t]);
  }

  const summaries: ProjectSummary[] = [];
  for (const project of projects) {
    const tasks = tasksByProject.get(project.id) ?? [];
    const taskCount = tasks.length;
    const completed = tasks.filter((t) => t.status === "Completed").length;
    const completionRate = taskCount ? Math.round((completed / taskCount) * 100) : 0;
    const waiting = tasks.filter((t) => t.planning_status === "Waiting" || t.planning_status === "Follow-Up").length;
    const overdue = tasks.filter(
      (t) => t.due_date && !["Completed", "Cancelled"].includes(t.status) && t.due_date < today
    ).length;

    const openTasks = tasks.filter((t) => OPEN_STATUSES.includes(t.status));
    let riskIndex = 0;
    if (openTasks.length) {
      const scores = await computeRiskScores(supabase, { tasks: openTasks });
      riskIndex = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
    }

    summaries.push({
      ...project,
      taskCount,
      completed,
      completionRate,
      waiting,
      overdue,
      riskIndex,
      milestones: milestonesByProject.get(project.id) ?? [],
    });
  }

  return summaries;
}

export async function getProjectSummary(supabase: DB, projectId: string): Promise<ProjectSummary | null> {
  const summaries = await listProjectSummaries(supabase);
  return summaries.find((s) => s.id === projectId) ?? null;
}

export async function createProject(supabase: DB, values: ProjectValues) {
  return planningLookupsRepo.createProject(supabase, {
    code: values.code,
    name: values.name,
    description: values.description || null,
    status: values.status || "Active",
  });
}

export async function createMilestone(supabase: DB, values: MilestoneValues) {
  return planningLookupsRepo.createMilestone(supabase, {
    project_id: values.project_id,
    title: values.title,
    target_date: values.target_date || null,
  });
}

export async function setMilestoneCompleted(supabase: DB, id: string, isCompleted: boolean) {
  return planningLookupsRepo.setMilestoneCompleted(supabase, id, isCompleted);
}
