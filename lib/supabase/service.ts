import "server-only";

import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/** Thrown when SUPABASE_SERVICE_ROLE_KEY is missing. The reminder/escalation/
 * summary engines need it because they write notifications for OTHER users
 * (e.g. escalating to a manager who isn't the current request's user), which
 * a normal request-scoped (RLS-restricted, "own rows only") client can't do. */
export class ServiceRoleNotConfiguredError extends Error {
  constructor() {
    super(
      "SUPABASE_SERVICE_ROLE_KEY 尚未設定，排程引擎（提醒/升級/摘要）需要此金鑰才能為其他使用者建立通知。"
    );
    this.name = "ServiceRoleNotConfiguredError";
  }
}

let client: SupabaseClient<Database, "taskflow"> | null = null;

/**
 * Service-role Supabase client — bypasses RLS entirely. Use ONLY in trusted
 * server-only code that never runs on behalf of a single logged-in user's
 * request (the scheduled engines, and their cron-protected API routes).
 * Never expose this client, or anything built from it, to the browser.
 */
export function createServiceRoleClient(): SupabaseClient<Database, "taskflow"> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ServiceRoleNotConfiguredError();
  if (!client) {
    client = createSupabaseJsClient<Database, "taskflow">(url, key, {
      db: { schema: "taskflow" },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
