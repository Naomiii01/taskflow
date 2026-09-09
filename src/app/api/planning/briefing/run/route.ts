import { NextResponse, type NextRequest } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireSchedulerAccess } from "@/lib/scheduler-auth";
import { handleApiError } from "@/lib/api-utils";
import { runDailyBriefingEngine } from "@/lib/services/daily-briefing";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily AI Briefing sweep (08:00, see vercel.json): computes the briefing
 * and files it as a `daily_summary` notification for every user opted into
 * 每日摘要. GET is what Vercel Cron calls; POST is the same handler for a
 * manual Admin-triggered run.
 */
async function run(request: NextRequest) {
  try {
    await requireSchedulerAccess(request);
    const supabase = createServiceRoleClient();
    const result = await runDailyBriefingEngine(supabase);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = run;
export const POST = run;
