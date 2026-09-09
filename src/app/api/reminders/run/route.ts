import { NextResponse, type NextRequest } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireSchedulerAccess } from "@/lib/scheduler-auth";
import { handleApiError } from "@/lib/api-utils";
import { runReminderEngine } from "@/lib/services/reminder-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Reminder Engine sweep: due-soon (今日/明日/3天內) + overdue (超期) +
 * follow-up monitoring (7/14/30 天未更新) + AI 追蹤建議.
 * GET is what Vercel Cron calls (daily 09:00, see vercel.json); POST is the
 * same handler for a manual Admin-triggered run. Both require
 * `requireSchedulerAccess` (CRON_SECRET bearer token, or a logged-in Admin).
 */
async function run(request: NextRequest) {
  try {
    await requireSchedulerAccess(request);
    const supabase = createServiceRoleClient();
    const result = await runReminderEngine(supabase);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = run;
export const POST = run;
