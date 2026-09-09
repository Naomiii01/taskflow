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

export async function findDepartmentWorkload(supabase: DB) {
  const { data, error } = await supabase
    .from("tasks")
    .select("status, due_date, department:departments!tasks_department_id_fkey(id, department_name)")
    .is("deleted_at", null);
  if (error) throw error;
  return data ?? [];
}
