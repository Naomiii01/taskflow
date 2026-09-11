import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { TaskQuery } from "@/lib/validations/task";
import type { TaskFormValues, TaskUpdateValues } from "@/lib/validations/task";

type DB = SupabaseClient<Database, "taskflow">;

const TASK_SELECT =
  "*, owner:users!tasks_owner_id_fkey(id, name, email, avatar_url), department:departments!tasks_department_id_fkey(id, department_name), created_by_user:users!tasks_created_by_fkey(id, name, email, avatar_url), project:projects!tasks_project_id_fkey(id, code, name)";

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * tasks.planning_month is a Postgres `date` column (stored as the 1st of the
 * target month), but not every caller sends a full date: the task form's
 * <input type="month"> and the recurring task engine's monthly templates
 * both produce a bare "YYYY-MM" string, which Postgres rejects outright
 * ("invalid input syntax for type date") and previously surfaced as a
 * generic 500 on task creation. Normalizing here, at the repository
 * boundary, fixes every caller (UI form, recurring task engine, future ones)
 * in one place instead of relying on each one to format it correctly.
 */
function normalizePlanningMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
}

/**
 * Builds the filtered/sorted/paginated Supabase query for the task list +
 * search center. RLS still governs what a given user can actually see;
 * these filters are the user-facing narrowing on top of that.
 */
export async function findTasks(
  supabase: DB,
  query: TaskQuery,
  currentUserId: string
) {
  let q = supabase.from("tasks").select(TASK_SELECT, { count: "exact" });

  q = query.includeDeleted ? q : q.is("deleted_at", null);

  if (query.q && query.q.trim()) {
    const term = query.q.trim().replace(/[%_]/g, (m) => `\\${m}`);
    q = q.or(`task_number.ilike.%${term}%,title.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (query.status?.length)
    q = q.in("status", query.status as Database["taskflow"]["Enums"]["task_status"][]);
  if (query.priority?.length)
    q = q.in("priority", query.priority as Database["taskflow"]["Enums"]["task_priority"][]);
  if (query.department_id?.length) q = q.in("department_id", query.department_id);
  if (query.owner_id?.length) q = q.in("owner_id", query.owner_id);
  if (query.mine) q = q.or(`owner_id.eq.${currentUserId},created_by.eq.${currentUserId}`);
  // aircraft_type/station are now array columns (a task can cover more than
  // one type/station) — "match any of the requested values" is an overlap
  // check (&&), not an `in` membership test against a scalar column.
  if (query.aircraft_type?.length)
    q = q.overlaps("aircraft_type", query.aircraft_type as Database["taskflow"]["Enums"]["aircraft_type_enum"][]);
  if (query.station?.length)
    q = q.overlaps("station", query.station as Database["taskflow"]["Enums"]["station_enum"][]);
  if (query.work_category?.length)
    q = q.in("work_category", query.work_category as Database["taskflow"]["Enums"]["work_category_enum"][]);
  if (query.planning_status?.length)
    q = q.in("planning_status", query.planning_status as Database["taskflow"]["Enums"]["planning_status_enum"][]);
  if (query.project_id?.length) q = q.in("project_id", query.project_id);
  if (query.dueAfter) q = q.gte("due_date", query.dueAfter);
  if (query.dueBefore) q = q.lte("due_date", query.dueBefore);

  if (query.dueThisWeek) {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = (day + 6) % 7;
    const start = new Date(today);
    start.setDate(start.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    q = q.gte("due_date", toDateOnly(start)).lte("due_date", toDateOnly(end));
  }

  if (query.overdue) {
    q = q.lt("due_date", toDateOnly(new Date())).not("status", "in", "(Completed,Cancelled)");
  }

  q = q.order(query.sortBy, { ascending: query.sortDir === "asc" });

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;

  return { data: data ?? [], total: count ?? 0 };
}

export async function findTaskById(supabase: DB, id: string) {
  const { data, error } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Derived Task Engine: a task's direct children (Task Relationship Graph is
 * rendered as this parent/children listing on the task detail page). */
export async function findChildTasks(supabase: DB, parentTaskId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("parent_task_id", parentTaskId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTask(supabase: DB, values: TaskFormValues, createdBy: string | null) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: values.title,
      description: values.description || null,
      priority: values.priority as Database["taskflow"]["Enums"]["task_priority"],
      status: (values.status ?? "Todo") as Database["taskflow"]["Enums"]["task_status"],
      department_id: values.department_id || null,
      owner_id: values.owner_id || null,
      owner_name: values.owner_name || null,
      due_date: values.due_date || null,
      followup_date: values.followup_date || null,
      tags: values.tags ?? [],
      created_by: createdBy,
      aircraft_type: (values.aircraft_type ?? []) as Database["taskflow"]["Enums"]["aircraft_type_enum"][],
      aircraft_registration: values.aircraft_registration ?? [],
      station: (values.station ?? []) as Database["taskflow"]["Enums"]["station_enum"][],
      work_category: (values.work_category || null) as Database["taskflow"]["Enums"]["work_category_enum"] | null,
      planning_month: normalizePlanningMonth(values.planning_month),
      source_department: (values.source_department || null) as Database["taskflow"]["Enums"]["cross_dept_unit_enum"] | null,
      waiting_owner: (values.waiting_owner || null) as Database["taskflow"]["Enums"]["cross_dept_unit_enum"] | null,
      planning_status: (values.planning_status || null) as Database["taskflow"]["Enums"]["planning_status_enum"] | null,
      impact_level: (values.impact_level || null) as Database["taskflow"]["Enums"]["impact_level_enum"] | null,
      parent_task_id: values.parent_task_id || null,
      project_id: values.project_id || null,
      source_template_id: values.source_template_id || null,
      source_channel: (values.source_channel || null) as Database["taskflow"]["Enums"]["task_source_channel_enum"] | null,
      source_note: values.source_note || null,
    })
    .select(TASK_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(supabase: DB, id: string, values: TaskUpdateValues) {
  const patch: Database["taskflow"]["Tables"]["tasks"]["Update"] = {};
  if (values.title !== undefined) patch.title = values.title;
  if (values.description !== undefined) patch.description = values.description || null;
  if (values.priority !== undefined)
    patch.priority = values.priority as Database["taskflow"]["Enums"]["task_priority"];
  if (values.status !== undefined) patch.status = values.status as Database["taskflow"]["Enums"]["task_status"];
  if (values.department_id !== undefined) patch.department_id = values.department_id || null;
  if (values.owner_id !== undefined) patch.owner_id = values.owner_id || null;
  if (values.owner_name !== undefined) patch.owner_name = values.owner_name || null;
  if (values.due_date !== undefined) patch.due_date = values.due_date || null;
  if (values.followup_date !== undefined) patch.followup_date = values.followup_date || null;
  if (values.tags !== undefined) patch.tags = values.tags;
  if (values.aircraft_type !== undefined)
    patch.aircraft_type = (values.aircraft_type ?? []) as Database["taskflow"]["Enums"]["aircraft_type_enum"][];
  if (values.aircraft_registration !== undefined) patch.aircraft_registration = values.aircraft_registration ?? [];
  if (values.station !== undefined)
    patch.station = (values.station ?? []) as Database["taskflow"]["Enums"]["station_enum"][];
  if (values.work_category !== undefined)
    patch.work_category = (values.work_category || null) as Database["taskflow"]["Enums"]["work_category_enum"] | null;
  if (values.planning_month !== undefined) patch.planning_month = normalizePlanningMonth(values.planning_month);
  if (values.source_department !== undefined)
    patch.source_department = (values.source_department || null) as Database["taskflow"]["Enums"]["cross_dept_unit_enum"] | null;
  if (values.waiting_owner !== undefined)
    patch.waiting_owner = (values.waiting_owner || null) as Database["taskflow"]["Enums"]["cross_dept_unit_enum"] | null;
  if (values.planning_status !== undefined)
    patch.planning_status = (values.planning_status || null) as Database["taskflow"]["Enums"]["planning_status_enum"] | null;
  if (values.impact_level !== undefined)
    patch.impact_level = (values.impact_level || null) as Database["taskflow"]["Enums"]["impact_level_enum"] | null;
  if (values.parent_task_id !== undefined) patch.parent_task_id = values.parent_task_id || null;
  if (values.project_id !== undefined) patch.project_id = values.project_id || null;
  if (values.source_channel !== undefined)
    patch.source_channel = (values.source_channel || null) as Database["taskflow"]["Enums"]["task_source_channel_enum"] | null;
  if (values.source_note !== undefined) patch.source_note = values.source_note || null;

  const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select(TASK_SELECT).single();
  if (error) throw error;
  return data;
}

export async function softDeleteTask(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select(TASK_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export type EngineTaskSnapshot = {
  id: string;
  task_number: string;
  title: string;
  status: Database["taskflow"]["Enums"]["task_status"];
  priority: Database["taskflow"]["Enums"]["task_priority"];
  due_date: string | null;
  owner_id: string | null;
  department_id: string | null;
  created_at: string;
  updated_at: string;
};

export const OPEN_STATUSES: Database["taskflow"]["Enums"]["task_status"][] = [
  "Todo",
  "In Progress",
  "Waiting Response",
  "Pending Approval",
];

/** Snapshot of every open (non-deleted, non-Completed/Cancelled) task, for
 * the reminder/escalation/follow-up-monitoring engines to scan in one pass. */
export async function findOpenTasksForEngines(supabase: DB): Promise<EngineTaskSnapshot[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, task_number, title, status, priority, due_date, owner_id, department_id, created_at, updated_at")
    .is("deleted_at", null)
    .in("status", OPEN_STATUSES);
  if (error) throw error;
  return data ?? [];
}

export type AnalysisTaskSnapshot = {
  id: string;
  owner_id: string | null;
  department_id: string | null;
  status: Database["taskflow"]["Enums"]["task_status"];
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

/** All non-deleted tasks (every status) — used by Department Delay Analysis
 * and the Weekly Summary, both of which need Completed/Cancelled tasks too
 * (unlike `findOpenTasksForEngines`, which only scans open ones). */
export async function findAllTasksForAnalysis(supabase: DB): Promise<AnalysisTaskSnapshot[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, owner_id, department_id, status, due_date, created_at, updated_at")
    .is("deleted_at", null);
  if (error) throw error;
  return data ?? [];
}

export type PlanningTaskSnapshot = EngineTaskSnapshot & {
  project_id: string | null;
  planning_status: Database["taskflow"]["Enums"]["planning_status_enum"] | null;
  // Arrays — a task can span more than one aircraft type/station.
  aircraft_type: Database["taskflow"]["Enums"]["aircraft_type_enum"][];
  station: Database["taskflow"]["Enums"]["station_enum"][];
  work_category: Database["taskflow"]["Enums"]["work_category_enum"] | null;
  waiting_owner: Database["taskflow"]["Enums"]["cross_dept_unit_enum"] | null;
  source_department: Database["taskflow"]["Enums"]["cross_dept_unit_enum"] | null;
  planning_month: string | null;
  parent_task_id: string | null;
  source_template_id: string | null;
  source_channel: Database["taskflow"]["Enums"]["task_source_channel_enum"] | null;
  source_note: string | null;
};

/** All non-deleted tasks (every status) with the Phase 6.5 planning columns —
 * feeds Project Center summaries, Planning KPI/Analytics, and the Daily AI
 * Briefing, all of which need to slice tasks by project/aircraft/station/
 * work category/planning status in different ways. */
const PLANNING_TASK_SNAPSHOT_SELECT =
  "id, task_number, title, status, priority, due_date, owner_id, department_id, created_at, updated_at, project_id, planning_status, aircraft_type, station, work_category, waiting_owner, source_department, planning_month, parent_task_id, source_template_id, source_channel, source_note";

export async function findAllTasksForPlanning(supabase: DB): Promise<PlanningTaskSnapshot[]> {
  const { data, error } = await supabase.from("tasks").select(PLANNING_TASK_SNAPSHOT_SELECT).is("deleted_at", null);
  if (error) throw error;
  return (data ?? []) as unknown as PlanningTaskSnapshot[];
}

export async function restoreTask(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("tasks")
    .update({ deleted_at: null })
    .eq("id", id)
    .select(TASK_SELECT)
    .single();
  if (error) throw error;
  return data;
}
