import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { computeWeeklySummary } from "@/lib/services/weekly-summary";

/**
 * On-demand, live-computed Weekly Summary for the logged-in user (新增任務/
 * 完成任務/超期任務/部門排行/工作量分析). Admins can pass `?scope=org` for the
 * organization-wide view. Separate from `/api/weekly-summary/run`, which
 * files the Monday 09:00 digest notification.
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const scope = request.nextUrl.searchParams.get("scope");
    const orgWide = scope === "org" && currentUser.role === "Admin";

    const supabase = await createClient();
    const summary = await computeWeeklySummary(supabase, orgWide ? undefined : currentUser.id);
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
