import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { followupUpdateSchema } from "@/lib/validations/followup";
import * as followupsService from "@/lib/services/followups-service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const values = followupUpdateSchema.parse(body);

    const supabase = await createClient();
    const followup = await followupsService.updateFollowup(supabase, id, values);
    return NextResponse.json(followup);
  } catch (error) {
    return handleApiError(error);
  }
}
