import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

const CHANGE_LOG_SELECT =
  "id, ground_window_id, aircraft_registration, station, change_type, old_arrival_at, old_departure_at, new_arrival_at, new_departure_at, plan_snapshot, created_at, changed_by, changed_by_user:users!ground_window_change_log_changed_by_fkey(id, name, email)";

/** 重新匯入班表時，一次可能同時異動好幾筆已排工的地停——批次寫入這些歷史
 * 紀錄，供之後查核用（不會回頭影響地停本身的計畫內容）。 */
export async function insertChangeLogEntries(
  supabase: DB,
  entries: Database["taskflow"]["Tables"]["ground_window_change_log"]["Insert"][]
) {
  if (!entries.length) return;
  const { error } = await supabase.from("ground_window_change_log").insert(entries);
  if (error) throw error;
}

/** 單一地停的異動歷史——編輯視窗裡的「異動紀錄」區塊用這個。 */
export async function findChangeLogForWindow(supabase: DB, groundWindowId: string) {
  const { data, error } = await supabase
    .from("ground_window_change_log")
    .select(CHANGE_LOG_SELECT)
    .eq("ground_window_id", groundWindowId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** 全機隊最近的異動紀錄——看板工具列的「異動紀錄」列表用這個。 */
export async function findRecentChangeLog(supabase: DB, limit = 200) {
  const { data, error } = await supabase
    .from("ground_window_change_log")
    .select(CHANGE_LOG_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
