import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as lookupsRepo from "@/lib/repositories/lookups-repository";

type DB = SupabaseClient<Database, "taskflow">;

export type DepartmentWorkloadRow = {
  id: string;
  department: string;
  managerName: string | null;
  taskCount: number;
  completedCount: number;
  completionRate: number;
  overdueCount: number;
};

export async function getDepartmentWorkload(supabase: DB): Promise<DepartmentWorkloadRow[]> {
  const [taskRows, departments, users] = await Promise.all([
    lookupsRepo.findDepartmentWorkload(supabase),
    lookupsRepo.findAllDepartments(supabase),
    lookupsRepo.findAllUsers(supabase),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const userNameById = new Map(users.map((u) => [u.id, u.name ?? u.email]));

  const byDept = new Map<string, { id: string; name: string; total: number; completed: number; overdue: number }>();

  // Seed every real department so ones with zero tasks still show a row.
  for (const d of departments) {
    byDept.set(d.id, { id: d.id, name: d.department_name, total: 0, completed: 0, overdue: 0 });
  }

  for (const r of taskRows as unknown as {
    status: string;
    due_date: string | null;
    department: { id: string; department_name: string } | null;
  }[]) {
    const dept = r.department;
    const key = dept?.id ?? "unassigned";
    const name = dept?.department_name ?? "未分配";
    const entry = byDept.get(key) ?? { id: key, name, total: 0, completed: 0, overdue: 0 };
    entry.total += 1;
    if (r.status === "Completed") entry.completed += 1;
    if (r.due_date && r.due_date < today && r.status !== "Completed" && r.status !== "Cancelled") {
      entry.overdue += 1;
    }
    byDept.set(key, entry);
  }

  return Array.from(byDept.values())
    .map((e) => {
      const dept = departments.find((d) => d.id === e.id);
      return {
        id: e.id,
        department: e.name,
        managerName: dept?.manager ? (userNameById.get(dept.manager) ?? null) : null,
        taskCount: e.total,
        completedCount: e.completed,
        completionRate: e.total === 0 ? 0 : Math.round((e.completed / e.total) * 100),
        overdueCount: e.overdue,
      };
    })
    .sort((a, b) => b.taskCount - a.taskCount);
}
