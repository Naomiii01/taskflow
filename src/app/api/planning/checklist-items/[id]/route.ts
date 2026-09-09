import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { checklistItemUpdateSchema } from "@/lib/validations/planning";
import * as checklistService from "@/lib/services/checklist-service";

type Params = { params: Promise<{ id: string }> };

/** Toggles a checklist item's 完成勾選/備註 (完成 also stamps completed_by/at). */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const values = checklistItemUpdateSchema.parse(body);
    const supabase = await createClient();
    const item = await checklistService.updateChecklistItem(supabase, id, values, currentUser.id);
    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error);
  }
}
