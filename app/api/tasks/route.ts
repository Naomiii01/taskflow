import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, parseListParam, handleApiError } from "@/lib/api-utils";
import { taskFormSchema, taskQuerySchema } from "@/lib/validations/task";
import * as tasksService from "@/lib/services/tasks-service";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const sp = request.nextUrl.searchParams;

    const query = taskQuerySchema.parse({
      q: sp.get("q") ?? undefined,
      status: parseListParam(sp, "status"),
      priority: parseListParam(sp, "priority"),
      department_id: parseListParam(sp, "department_id"),
      owner_id: parseListParam(sp, "owner_id"),
      dueBefore: sp.get("dueBefore") ?? undefined,
      dueAfter: sp.get("dueAfter") ?? undefined,
      mine: sp.get("mine") ?? undefined,
      dueThisWeek: sp.get("dueThisWeek") ?? undefined,
      overdue: sp.get("overdue") ?? undefined,
      includeDeleted: sp.get("includeDeleted") ?? undefined,
      sortBy: sp.get("sortBy") ?? undefined,
      sortDir: sp.get("sortDir") ?? undefined,
      page: sp.get("page") ?? undefined,
      pageSize: sp.get("pageSize") ?? undefined,
    });

    const supabase = await createClient();
    const result = await tasksService.listTasks(supabase, query, currentUser);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = taskFormSchema.parse(body);

    const supabase = await createClient();
    const task = await tasksService.createTask(supabase, values, currentUser);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
