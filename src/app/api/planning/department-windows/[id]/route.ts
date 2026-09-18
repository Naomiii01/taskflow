import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { canEditPlanningBoard } from "@/lib/auth";
import { PermissionError } from "@/lib/errors";
import { departmentWindowUpdateSchema } from "@/lib/validations/planning";
import * as aircraftPlanningService from "@/lib/services/aircraft-planning-service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireCurrentUser();
    if (!canEditPlanningBoard(currentUser)) throw new PermissionError("您沒有 Aircraft Planning Board 的編輯權限");
    const { id } = await params;
    const body = await request.json();
    const values = departmentWindowUpdateSchema.parse(body);
    const supabase = await createClient();
    const window = await aircraftPlanningService.updateDepartmentWindow(supabase, id, values);
    return NextResponse.json(window);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireCurrentUser();
    if (currentUser.role !== "Admin") throw new PermissionError("只有管理員可以刪除部門標示紀錄");
    const { id } = await params;
    const supabase = await createClient();
    await aircraftPlanningService.deleteDepartmentWindow(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
