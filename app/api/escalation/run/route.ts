import { NextResponse, type NextRequest } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireSchedulerAccess } from "@/lib/scheduler-auth";
import { handleApiError } from "@/lib/api-utils";
import { runEscalationEngine } from "@/lib/services/escalation-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Escalation Engine sweep: Level 1/2/3 overdue escalation (owner → manager →
 * admins) plus the Department Delay Analysis notification pass.
 * GET is what Vercel Cron calls (daily 09:00, see vercel.json); POST is the
 * same handler for a manual Admin-triggered run.
 */
async function run(request: NextRequest) {
  try {
    await requireSchedulerAccess(request);
    const supabase = createServiceRoleClient();
    const result = await runEscalationEngine(supabase);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = run;
export const POST = run;
