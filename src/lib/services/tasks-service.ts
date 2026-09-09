import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { CurrentUser } from "@/lib/auth";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import * as followupsRepo from "@/lib/repositories/followups-repository";
import * as lookupsRepo from "@/lib/repositories/lookups-repository";
import { computeSmartFollowup } from "@/lib/smart-followup";
import { taskQuerySchema, type TaskQuery } from "@/lib/validations/task";
import type { TaskFormValues, TaskUpdateValues } from "@/lib/validations/task";
import type { TaskWithRelations } from "@/types/domain";
import { PermissionError } from "@/lib/errors";

export { PermissionError };

type DB = SupabaseClient<Database, "taskflow">;

/** App-layer permission check mirroring the RLS policy (defense in depth —
 * RLS is still the source of truth, this just gives a clean 403 + message
 * instead of letting a write silently no-op against Postgres). */
function assertCanWriteTask(
  currentUser: CurrentUser,
  task: { owner_id: string | null; created_by: string | null; department_id: string | null },
  departments: { id: string; manager: string | null }[]
) {
  if (currentUser.role === "Admin") return;
  if (task.owner_id === currentUser.id || task.created_by === currentUser.id) return;
  if (currentUser.role === "Manager") {
    const dept = departments.find((d) => d.id === task.department_id);
    if (dept?.manager === currentUser.id) return;
  }
  throw new PermissionError();
}

export async function listTasks(supabase: DB, query: TaskQuery, currentUser: CurrentUser) {
  const { data, total } = await tasksRepo.findTasks(supabase, query, currentUser.id);
  const rows = data as unknown as TaskWithRelations[];

  const followups = await followupsRepo.findFollowupsByTasks(
    supabase,
    rows.map((t) => t.id)
  );
  const latestFollowupByTask = new Map<string, string>();
  for (const f of followups) {
    const existing = latestFollowupByTask.get(f.task_id);
    if (!existing || f.created_at > existing) latestFollowupByTask.set(f.task_id, f.created_at);
  }

  const withIndicator = rows.map((t) => {
    const latestFollowupAt = latestFollowupByTask.get(t.id);
    const lastActivity = latestFollowupAt && latestFollowupAt > t.updated_at ? latestFollowupAt : t.updated_at;
    return { ...t, smartFollowup: computeSmartFollowup(lastActivity) };
  });

  return { data: withIndicator, total, page: query.page, pageSize: query.pageSize };
}

export async function getTask(supabase: DB, id: string) {
  const task = await tasksRepo.findTaskById(supabase, id);
  if (!task) return null;

  const latest = await followupsRepo.findLatestFollowupForTask(supabase, id);
  const t = task as unknown as TaskWithRelations;
  const lastActivity =
    latest && latest.created_at > t.updated_at ? latest.created_at : t.updated_at;

  // Derived Task Engine: children shown as a simple Parent Task/Child Task
  // listing (the "Task Relationship Graph") on the task detail page.
  const [children, parent] = await Promise.all([
    tasksRepo.findChildTasks(supabase, id),
    t.parent_task_id ? tasksRepo.findTaskById(supabase, t.parent_task_id) : Promise.resolve(null),
  ]);

  return {
    ...t,
    smartFollowup: computeSmartFollowup(lastActivity),
    children: children as unknown as TaskWithRelations[],
    parent: parent as unknown as TaskWithRelations | null,
  };
}

export async function createTask(supabase: DB, values: TaskFormValues, currentUser: CurrentUser) {
  return tasksRepo.createTask(supabase, values, currentUser.id);
}

export async function updateTask(
  supabase: DB,
  id: string,
  values: TaskUpdateValues,
  currentUser: CurrentUser,
  departments: { id: string; manager: string | null }[]
) {
  const existing = await tasksRepo.findTaskById(supabase, id);
  if (!existing) return null;
  assertCanWriteTask(currentUser, existing, departments);
  return tasksRepo.updateTask(supabase, id, values);
}

/**
 * Global Search Center: matches Task Number / Title / Description directly,
 * plus Department name and Owner name/email — the latter two require
 * resolving matching department/user ids first since PostgREST can't OR
 * across an embedded relation in a single filter string.
 */
export async function searchTasks(supabase: DB, term: string, currentUser: CurrentUser) {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const [departments, users] = await Promise.all([
    lookupsRepo.findAllDepartments(supabase),
    lookupsRepo.findAllUsers(supabase),
  ]);

  const lower = trimmed.toLowerCase();
  const matchingDeptIds = departments.filter((d) => d.department_name.toLowerCase().includes(lower)).map((d) => d.id);
  const matchingUserIds = users
    .filter((u) => (u.name ?? "").toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower))
    .map((u) => u.id);

  const baseQuery = { sortBy: "updated_at" as const, sortDir: "desc" as const, page: 1, pageSize: 25 };
  const queries: TaskQuery[] = [taskQuerySchema.parse({ ...baseQuery, q: trimmed })];
  if (matchingDeptIds.length) queries.push(taskQuerySchema.parse({ ...baseQuery, department_id: matchingDeptIds }));
  if (matchingUserIds.length) queries.push(taskQuerySchema.parse({ ...baseQuery, owner_id: matchingUserIds }));

  const results = await Promise.all(queries.map((q) => tasksRepo.findTasks(supabase, q, currentUser.id)));

  const merged = new Map<string, TaskWithRelations>();
  for (const r of results) {
    for (const row of r.data as unknown as TaskWithRelations[]) merged.set(row.id, row);
  }

  return Array.from(merged.values()).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function softDeleteTask(
  supabase: DB,
  id: string,
  currentUser: CurrentUser,
  departments: { id: string; manager: string | null }[]
) {
  const existing = await tasksRepo.findTaskById(supabase, id);
  if (!existing) return null;
  // Soft delete is intentionally stricter than a normal edit: only the
  // department's manager or an Admin may delete (not just the owner).
  if (currentUser.role !== "Admin") {
    const dept = departments.find((d) => d.id === existing.department_id);
    if (!(currentUser.role === "Manager" && dept?.manager === currentUser.id)) {
      throw new PermissionError("只有部門主管或管理員可以刪除任務");
    }
  }
  return tasksRepo.softDeleteTask(supabase, id);
}
