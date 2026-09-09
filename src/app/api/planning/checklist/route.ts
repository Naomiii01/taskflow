import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as checklistService from "@/lib/services/checklist-service";

/** Today Center: today's Daily Checklist (created lazily if the 00:00 cron
 * hasn't run yet). Pass ?date=YYYY-MM-DD for a past date (History view) —
 * returns null (no auto-create) if that date has no checklist. */
export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const date = request.nextUrl.searchParams.get("date");
    const supabase = await createClient();
    const checklist = date ? await checklistService.getChecklistForDate(supabase, date) : await checklistService.getTodayChecklist(supabase);
    return NextResponse.json(checklist);
  } catch (error) {
    return handleApiError(error);
  }
}
