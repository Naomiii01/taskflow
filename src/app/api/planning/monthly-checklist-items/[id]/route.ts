import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { monthlyChecklistItemUpdateSchema } from "@/lib/validations/planning";
import * as monthlyChecklistService from "@/lib/services/monthly-checklist-service";

type Params = { params: Promise<{ id: string }> };

/** Toggles a Planning Timeline monthly milestone's 完成勾選 (also stamps
 * completed_by/at, mirroring the Daily Checklist item toggle). */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const values = monthlyChecklistItemUpdateSchema.parse(body);
    const supabase = await createClient();
    const item = await monthlyChecklistService.updateChecklistItem(supabase, id, values, currentUser.id);
    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error);
  }
}
