import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { canEditPlanningBoard } from "@/lib/auth";
import { PermissionError } from "@/lib/errors";
import { departmentWindowSchema } from "@/lib/validations/planning";
import * as aircraftPlanningService from "@/lib/services/aircraft-planning-service";

/** 機坪／基地部門標示——新增一段「哪個部門正在執行這架飛機的工作」的日期
 * 區間。通常從年度維修計畫表匯入，但臨時計畫常會變動，所以也開放手動新增。 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    if (!canEditPlanningBoard(currentUser)) throw new PermissionError("您沒有 Aircraft Planning Board 的編輯權限");
    const body = await request.json();
    const values = departmentWindowSchema.parse(body);
    const supabase = await createClient();
    const window = await aircraftPlanningService.createDepartmentWindow(supabase, values, currentUser.id);
    return NextResponse.json(window, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
