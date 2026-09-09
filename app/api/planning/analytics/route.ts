import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { computePlanningAnalytics } from "@/lib/services/planning-kpi-service";

/** Analytics Enhancement: A321/A339/A351/A359工作量, TPE/TSA/RMQ/KHH工作量,
 * 長工時/短天期/額外工單(等 Work Category)工作量. */
export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = await createClient();
    const analytics = await computePlanningAnalytics(supabase);
    return NextResponse.json(analytics);
  } catch (error) {
    return handleApiError(error);
  }
}
