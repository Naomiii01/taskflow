import { NextResponse, type NextRequest } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireSchedulerAccess } from "@/lib/scheduler-auth";
import { handleApiError } from "@/lib/api-utils";
import { runWeeklySummaryEngine } from "@/lib/services/weekly-summary";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Scheduler entry point (weekly, Monday 09:00, see vercel.json): files a
 * personal Weekly Summary digest notification for every user opted into
 * 每週摘要. */
async function run(request: NextRequest) {
  try {
    await requireSchedulerAccess(request);
    const supabase = createServiceRoleClient();
    const result = await runWeeklySummaryEngine(supabase);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = run;
export const POST = run;
