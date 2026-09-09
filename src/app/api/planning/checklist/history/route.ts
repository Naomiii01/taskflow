import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as checklistService from "@/lib/services/checklist-service";

export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const limitParam = request.nextUrl.searchParams.get("limit");
    const supabase = await createClient();
    const history = await checklistService.listChecklistHistory(supabase, limitParam ? Number(limitParam) : undefined);
    return NextResponse.json(history);
  } catch (error) {
    return handleApiError(error);
  }
}
