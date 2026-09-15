import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { planningBoardSettingsSchema } from "@/lib/validations/planning";
import * as aircraftPlanningService from "@/lib/services/aircraft-planning-service";

/** Capacity Warning 門檻——單一列全域設定，任何登入使用者都可以調整（目前僅
 * 一人使用，不特別限管理員）。 */
export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = await createClient();
    const settings = await aircraftPlanningService.getBoardSettings(supabase);
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = planningBoardSettingsSchema.parse(body);
    const supabase = await createClient();
    const settings = await aircraftPlanningService.updateBoardSettings(supabase, values, currentUser.id);
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
