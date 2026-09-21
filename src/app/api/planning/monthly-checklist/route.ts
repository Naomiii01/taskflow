import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as monthlyChecklistService from "@/lib/services/monthly-checklist-service";

/** Monthly Center / Planning Timeline: this calendar month's checklist for
 * the 3 PLANNING_MONTHLY_MILESTONES items (created lazily if not seen yet). */
export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = await createClient();
    const checklist = await monthlyChecklistService.getCurrentMonthChecklist(supabase);
    return NextResponse.json(checklist);
  } catch (error) {
    return handleApiError(error);
  }
}
