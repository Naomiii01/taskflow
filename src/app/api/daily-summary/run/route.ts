import { NextResponse, type NextRequest } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireSchedulerAccess } from "@/lib/scheduler-auth";
import { handleApiError } from "@/lib/api-utils";
import { runDailySummaryEngine } from "@/lib/services/daily-summary";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Scheduler entry point (daily 09:00, see vercel.json): files a personal
 * Daily Summary digest notification for every user opted into 每日摘要. */
async function run(request: NextRequest) {
  try {
    await requireSchedulerAccess(request);
    const supabase = createServiceRoleClient();
    const result = await runDailySummaryEngine(supabase);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = run;
export const POST = run;
