import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as tasksService from "@/lib/services/tasks-service";

/** Search Center: matches task number / title / description / department / owner. */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const term = request.nextUrl.searchParams.get("q") ?? "";

    const supabase = await createClient();
    const data = await tasksService.searchTasks(supabase, term, currentUser);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
