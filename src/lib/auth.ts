import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type CurrentUser = Tables<"users">;

/**
 * Returns the signed-in user's `taskflow.users` profile row (role, name,
 * etc.), or null if there is no session. Safe to call from Server
 * Components / Server Actions / Route Handlers.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  return profile ?? null;
}

/** Aircraft Planning Board 專用的編輯者/閱覽者判斷——跟系統其他功能用的 role
 * (Admin/Manager/User) 分開，只影響地面時間新增/編輯、匯入班表、容量警示門檻
 * 這幾個地方。Admin 永遠視為 editor，不受 planning_board_role 限制（跟資料庫
 * 那邊 taskflow.can_edit_planning_board() 的邏輯保持一致）。 */
export function canEditPlanningBoard(user: Pick<CurrentUser, "role" | "planning_board_role">): boolean {
  return user.role === "Admin" || user.planning_board_role === "editor";
}
