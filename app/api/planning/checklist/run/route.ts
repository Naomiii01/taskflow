import { NextResponse, type NextRequest } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireSchedulerAccess } from "@/lib/scheduler-auth";
import { handleApiError } from "@/lib/api-utils";
import * as checklistService from "@/lib/services/checklist-service";
import { runRecurringTaskEngine } from "@/lib/services/recurring-task-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 00:00 daily init: creates today's Daily Checklist (8 default items) and
 * runs the Recurring Task Engine (Monthly Planning Templates on the
 * 1st/15th, plus any other active Daily/Weekly/Quarterly/Yearly template
 * due today). GET is what Vercel Cron calls; POST is the same handler for a
 * manual Admin-triggered run.
 */
async function run(request: NextRequest) {
  try {
    await requireSchedulerAccess(request);
    const supabase = createServiceRoleClient();
    const checklist = await checklistService.getTodayChecklist(supabase);
    const recurring = await runRecurringTaskEngine(supabase);
    return NextResponse.json({ ran: true, checklistDate: checklist.checklist_date, recurring });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = run;
export const POST = run;
