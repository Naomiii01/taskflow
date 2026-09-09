import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, FollowUpEntityType } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

const FOLLOW_UP_SELECT = "*, author:users!follow_up_records_created_by_fkey(id, name, email, avatar_url)";

export async function findFollowUpsForEntity(supabase: DB, entityType: FollowUpEntityType, entityId: string) {
  const { data, error } = await supabase
    .from("follow_up_records")
    .select(FOLLOW_UP_SELECT)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("attempt_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Batches follow-up history for many entities of the same type at once
 * (used by the Waiting/Supervisor Center list views to avoid N+1 queries). */
export async function findFollowUpsForEntities(supabase: DB, entityType: FollowUpEntityType, entityIds: string[]) {
  if (!entityIds.length) return [];
  const { data, error } = await supabase
    .from("follow_up_records")
    .select(FOLLOW_UP_SELECT)
    .eq("entity_type", entityType)
    .in("entity_id", entityIds)
    .order("attempt_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createFollowUpRecord(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["follow_up_records"]["Insert"]
) {
  const { data, error } = await supabase.from("follow_up_records").insert(values).select(FOLLOW_UP_SELECT).single();
  if (error) throw error;
  return data;
}

/** Next attempt_number for a given entity (1 if it has no follow-ups yet). */
export async function nextAttemptNumber(supabase: DB, entityType: FollowUpEntityType, entityId: string) {
  const { data, error } = await supabase
    .from("follow_up_records")
    .select("attempt_number")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.attempt_number ?? 0) + 1;
}

/** Follow-ups due today or earlier whose entity hasn't had a later attempt
 * recorded yet — used by the Reminder Engine's "到期自動提醒". */
export async function findDueFollowUps(supabase: DB, onOrBefore: string) {
  const { data, error } = await supabase
    .from("follow_up_records")
    .select("*")
    .not("next_follow_up_date", "is", null)
    .lte("next_follow_up_date", onOrBefore)
    .order("next_follow_up_date", { ascending: true });
  if (error) throw error;

  // Keep only each entity's latest attempt (an earlier attempt's
  // next_follow_up_date is moot once a later attempt has been logged).
  const latestByEntity = new Map<string, (typeof data)[number]>();
  for (const row of data ?? []) {
    const key = `${row.entity_type}:${row.entity_id}`;
    const existing = latestByEntity.get(key);
    if (!existing || row.attempt_number > existing.attempt_number) latestByEntity.set(key, row);
  }
  return Array.from(latestByEntity.values());
}
