import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { computeDailySummary } from "@/lib/services/daily-summary";

/**
 * On-demand, live-computed Daily Summary for the logged-in user (今日待辦/
 * 今日到期/超期事項/待追蹤事項/AI建議事項). Admins can pass `?scope=org` for
 * the organization-wide view. This is separate from the scheduler's
 * `/api/daily-summary/run`, which files the 09:00 digest notification.
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const scope = request.nextUrl.searchParams.get("scope");
    const orgWide = scope === "org" && currentUser.role === "Admin";

    const supabase = await createClient();
    const summary = await computeDailySummary(supabase, orgWide ? undefined : currentUser.id);
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
