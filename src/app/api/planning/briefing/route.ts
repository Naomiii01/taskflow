import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { computeDailyBriefing } from "@/lib/services/daily-briefing";

/** AI Briefing Center: on-demand, live-computed version of the 08:00 Daily
 * AI Briefing (separate from `/api/planning/briefing/run`, which files the
 * scheduled notification). */
export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = await createClient();
    const briefing = await computeDailyBriefing(supabase);
    return NextResponse.json(briefing);
  } catch (error) {
    return handleApiError(error);
  }
}
