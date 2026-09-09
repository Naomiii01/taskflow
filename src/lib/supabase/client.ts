"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

/**
 * Browser-side Supabase client. All app tables live in the `taskflow`
 * Postgres schema (kept separate from other apps sharing this project),
 * so we point PostgREST at it via `db.schema`.
 */
export function createClient() {
  return createBrowserClient<Database, "taskflow">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "taskflow" },
    }
  );
}
