import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, SupervisorTaskStatus } from "@/types/database.types";
import * as supervisorRepo from "@/lib/repositories/supervisor-repository";
import * as followUpRepo from "@/lib/repositories/follow-up-repository";
import type { SupervisorTaskWithUsers } from "@/types/domain";
import type { SupervisorTaskValues, SupervisorTaskUpdateValues } from "@/lib/validations/planning";

type DB = SupabaseClient<Database, "taskflow">;

/** Supervisor Assignment Center: 交辦事項/交辦日期/截止日期/優先級/狀態/完成日期
 * + 追蹤紀錄 — the follow-up history is attached here via the generic
 * Follow-up Center (entity_type='supervisor_task') rather than a separate
 * tracking table, so a supervisor task's follow-ups show the same 第一次/
 * 第二次/第三次追蹤 history as Waiting Center items do. */
export async function listSupervisorTasks(supabase: DB, status?: SupervisorTaskStatus): Promise<SupervisorTaskWithUsers[]> {
  const tasks = await supervisorRepo.findSupervisorTasks(supabase, status);
  const followUps = await followUpRepo.findFollowUpsForEntities(supabase, "supervisor_task", tasks.map((t) => t.id));
  const followUpsByEntity = new Map<string, typeof followUps>();
  for (const f of followUps) {
    const list = followUpsByEntity.get(f.entity_id);
    if (list) list.push(f);
    else followUpsByEntity.set(f.entity_id, [f]);
  }
  return tasks.map((t) => ({ ...t, followUps: followUpsByEntity.get(t.id) ?? [] }));
}

export async function getSupervisorTask(supabase: DB, id: string): Promise<SupervisorTaskWithUsers | null> {
  const task = await supervisorRepo.findSupervisorTaskById(supabase, id);
  if (!task) return null;
  const followUps = await followUpRepo.findFollowUpsForEntity(supabase, "supervisor_task", id);
  return { ...task, followUps };
}

export async function createSupervisorTask(supabase: DB, values: SupervisorTaskValues, currentUserId: string) {
  return supervisorRepo.createSupervisorTask(supabase, {
    title: values.title,
    description: values.description || null,
    assigned_by: values.assigned_by || currentUserId,
    assigned_to: values.assigned_to || null,
    due_date: values.due_date || null,
    priority: (values.priority ?? "P2") as Database["taskflow"]["Enums"]["task_priority"],
  });
}

export async function updateSupervisorTask(supabase: DB, id: string, values: SupervisorTaskUpdateValues) {
  const patch: Database["taskflow"]["Tables"]["supervisor_tasks"]["Update"] = {};
  if (values.title !== undefined) patch.title = values.title;
  if (values.description !== undefined) patch.description = values.description || null;
  if (values.assigned_by !== undefined) patch.assigned_by = values.assigned_by || null;
  if (values.assigned_to !== undefined) patch.assigned_to = values.assigned_to || null;
  if (values.due_date !== undefined) patch.due_date = values.due_date || null;
  if (values.priority !== undefined) patch.priority = values.priority as Database["taskflow"]["Enums"]["task_priority"];
  if (values.status !== undefined) patch.status = values.status as SupervisorTaskStatus;
  return supervisorRepo.updateSupervisorTask(supabase, id, patch);
}
