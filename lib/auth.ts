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
