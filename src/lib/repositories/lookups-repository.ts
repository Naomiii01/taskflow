import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

/** Departments + users for select dropdowns (create/edit task, filters). */
export async function findAllDepartments(supabase: DB) {
  const { data, error } = await supabase
    .from("departments")
    .select("id, department_name, manager")
    .order("department_name");
  if (error) throw error;
  return data ?? [];
}

export async function findAllUsers(supabase: DB) {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, avatar_url")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function findAdmins(supabase: DB) {
  const { data, error } = await supabase.from("users").select("id, name, email").eq("role", "Admin");
  if (error) throw error;
  return data ?? [];
}

/** Everyone who can edit the Aircraft Planning Board — Admins (always
 * editors, regardless of planning_board_role) plus anyone explicitly set as
 * an "editor". Used to fan out schedule-change notifications after a班表
 * re-import so the whole planning team sees affected windows, not just
 * whoever happened to run the import. */
export async function findPlanningBoardEditors(supabase: DB) {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email")
    .or("role.eq.Admin,planning_board_role.eq.editor");
  if (error) throw error;
  return data ?? [];
}

export async function findDepartmentWorkload(supabase: DB) {
  const { data, error } = await supabase
    .from("tasks")
    .select("status, due_date, department:departments!tasks_department_id_fkey(id, department_name)")
    .is("deleted_at", null);
  if (error) throw error;
  return data ?? [];
}
