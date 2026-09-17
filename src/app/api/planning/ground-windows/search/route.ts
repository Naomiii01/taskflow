import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as aircraftPlanningService from "@/lib/services/aircraft-planning-service";

/** 搜尋中心「計畫看板」分頁——閱覽者也看得到（跟其他 GET 一樣只要求登入，
 * 不要求編輯權限）。 */
export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const term = request.nextUrl.searchParams.get("q") ?? "";

    const supabase = await createClient();
    const data = await aircraftPlanningService.searchGroundWindows(supabase, term);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
