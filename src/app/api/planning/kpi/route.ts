import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { computePlanningKpis } from "@/lib/services/planning-kpi-service";

/** Planning KPI: 追蹤完成率/等待回覆數/超期事項/主管交辦完成率/月計畫完成率/
 * RMQ完成率/KHH完成率 (the latter two read off `projectCompletion` by code). */
export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = await createClient();
    const kpis = await computePlanningKpis(supabase);
    return NextResponse.json(kpis);
  } catch (error) {
    return handleApiError(error);
  }
}
