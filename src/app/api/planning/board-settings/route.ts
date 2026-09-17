import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { canEditPlanningBoard } from "@/lib/auth";
import { PermissionError } from "@/lib/errors";
import { planningBoardSettingsSchema } from "@/lib/validations/planning";
import * as aircraftPlanningService from "@/lib/services/aircraft-planning-service";

/** Capacity Warning 門檻——單一列全域設定，任何有 Aircraft Planning Board
 * 編輯權限的使用者都可以調整；閱覽者可以看但不能改（RLS 那邊也有一樣的
 * 限制，這裡先擋一次是為了給出比較友善的錯誤訊息）。 */
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
    if (!canEditPlanningBoard(currentUser)) throw new PermissionError("您沒有 Aircraft Planning Board 的編輯權限");
    const body = await request.json();
    const values = planningBoardSettingsSchema.parse(body);
    const supabase = await createClient();
    const settings = await aircraftPlanningService.updateBoardSettings(supabase, values, currentUser.id);
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
