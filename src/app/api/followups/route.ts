import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { followupFormSchema } from "@/lib/validations/followup";
import * as followupsService from "@/lib/services/followups-service";

export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const taskId = request.nextUrl.searchParams.get("task_id");
    if (!taskId) return NextResponse.json({ error: "缺少 task_id" }, { status: 400 });

    const supabase = await createClient();
    const followups = await followupsService.listFollowupsForTask(supabase, taskId);
    return NextResponse.json({ data: followups });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = followupFormSchema.parse(body);

    const supabase = await createClient();
    const followup = await followupsService.addFollowup(supabase, values, currentUser.id);
    return NextResponse.json(followup, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
