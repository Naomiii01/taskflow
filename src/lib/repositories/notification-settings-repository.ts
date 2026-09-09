import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { NotificationSettingsValues } from "@/lib/validations/notification";

type DB = SupabaseClient<Database, "taskflow">;

/** A row is auto-created for every user by the `create_default_notification_settings`
 * trigger (Phase 4 migration), so this should normally find one — but falls
 * back to the column defaults if a row is somehow missing. */
export async function findSettings(supabase: DB, userId: string) {
  const { data, error } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (
    data ?? {
      user_id: userId,
      email_enabled: true,
      in_app_enabled: true,
      push_enabled: true,
      daily_summary_enabled: true,
      weekly_summary_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  );
}

export async function upsertSettings(supabase: DB, userId: string, values: NotificationSettingsValues) {
  const { data, error } = await supabase
    .from("notification_settings")
    .upsert({ user_id: userId, ...values }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** All users opted into a given digest, for the scheduler's fan-out — service-role only (crosses users). */
export async function findUsersOptedIntoDigest(supabase: DB, digest: "daily_summary_enabled" | "weekly_summary_enabled") {
  const { data, error } = await supabase.from("notification_settings").select("user_id").eq(digest, true);
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id);
}
