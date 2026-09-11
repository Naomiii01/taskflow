import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

// --- Fleet Master ----------------------------------------------------------

/** Pass one or more aircraft types to filter registrations to those fleets —
 * the task form's Aircraft Type field is multi-select, so the Aircraft
 * Registration cascade needs to show the union of matching aircraft. */
export async function findAllFleet(supabase: DB, aircraftTypes?: string[]) {
  let q = supabase.from("fleet_master").select("*").order("aircraft_registration");
  if (aircraftTypes?.length)
    q = q.in("aircraft_type", aircraftTypes as Database["taskflow"]["Enums"]["aircraft_type_enum"][]);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createFleetAircraft(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["fleet_master"]["Insert"]
) {
  const { data, error } = await supabase.from("fleet_master").insert(values).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateFleetAircraft(
  supabase: DB,
  id: string,
  values: Database["taskflow"]["Tables"]["fleet_master"]["Update"]
) {
  const { data, error } = await supabase.from("fleet_master").update(values).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

// --- Project Center ----------------------------------------------------------

export async function findAllProjects(supabase: DB) {
  const { data, error } = await supabase.from("projects").select("*").order("code");
  if (error) throw error;
  return data ?? [];
}

export async function findProjectById(supabase: DB, id: string) {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProject(supabase: DB, values: Database["taskflow"]["Tables"]["projects"]["Insert"]) {
  const { data, error } = await supabase.from("projects").insert(values).select("*").single();
  if (error) throw error;
  return data;
}

export async function findMilestonesByProjects(supabase: DB, projectIds: string[]) {
  if (!projectIds.length) return [];
  const { data, error } = await supabase
    .from("project_milestones")
    .select("*")
    .in("project_id", projectIds)
    .order("target_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMilestone(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["project_milestones"]["Insert"]
) {
  const { data, error } = await supabase.from("project_milestones").insert(values).select("*").single();
  if (error) throw error;
  return data;
}

export async function setMilestoneCompleted(supabase: DB, id: string, isCompleted: boolean) {
  const { data, error } = await supabase
    .from("project_milestones")
    .update({ is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// --- Recurring Task Engine (templates) --------------------------------------

export async function findActiveRecurringTemplates(supabase: DB) {
  const { data, error } = await supabase
    .from("recurring_task_templates")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function findAllRecurringTemplates(supabase: DB) {
  const { data, error } = await supabase.from("recurring_task_templates").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createRecurringTemplate(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["recurring_task_templates"]["Insert"]
) {
  const { data, error } = await supabase.from("recurring_task_templates").insert(values).select("*").single();
  if (error) throw error;
  return data;
}

export async function markTemplateGenerated(supabase: DB, id: string, onDate: string) {
  const { error } = await supabase
    .from("recurring_task_templates")
    .update({ last_generated_on: onDate })
    .eq("id", id);
  if (error) throw error;
}

/** Has this template already generated a task for `onDate`? (idempotency guard
 * for the cron — the template's own `last_generated_on` is the fast check,
 * this is a defensive fallback checking the actual tasks table.) */
export async function templateGeneratedOn(supabase: DB, templateId: string, onDate: string) {
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("source_template_id", templateId)
    .gte("created_at", `${onDate}T00:00:00Z`)
    .lt("created_at", `${onDate}T23:59:59Z`);
  if (error) throw error;
  return (count ?? 0) > 0;
}
