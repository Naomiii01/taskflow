import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { SUPERVISOR_TASK_STATUSES } from "@/lib/constants";
import { supervisorTaskSchema } from "@/lib/validations/planning";
import * as supervisorService from "@/lib/services/supervisor-service";
import type { SupervisorTaskStatus } from "@/types/database.types";

/** Supervisor Assignment Center — 獨立顯示於首頁, so this list is fetched
 * separately from the general task list rather than piggy-backing on
 * /api/tasks. */
export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const statusParam = request.nextUrl.searchParams.get("status");
    const status =
      statusParam && (SUPERVISOR_TASK_STATUSES as string[]).includes(statusParam)
        ? (statusParam as SupervisorTaskStatus)
        : undefined;
    const supabase = await createClient();
    const tasks = await supervisorService.listSupervisorTasks(supabase, status);
    return NextResponse.json(tasks);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = supervisorTaskSchema.parse(body);
    const supabase = await createClient();
    const task = await supervisorService.createSupervisorTask(supabase, values, currentUser.id);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
