import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { taskUpdateSchema } from "@/lib/validations/task";
import * as tasksService from "@/lib/services/tasks-service";
import * as lookupsRepo from "@/lib/repositories/lookups-repository";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    const supabase = await createClient();
    const task = await tasksService.getTask(supabase, id);
    if (!task) return NextResponse.json({ error: "找不到任務" }, { status: 404 });
    return NextResponse.json(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const values = taskUpdateSchema.parse(body);

    const supabase = await createClient();
    const departments = await lookupsRepo.findAllDepartments(supabase);
    const task = await tasksService.updateTask(supabase, id, values, currentUser, departments);
    if (!task) return NextResponse.json({ error: "找不到任務" }, { status: 404 });
    return NextResponse.json(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireCurrentUser();
    const { id } = await params;
    const supabase = await createClient();
    const departments = await lookupsRepo.findAllDepartments(supabase);
    const task = await tasksService.softDeleteTask(supabase, id, currentUser, departments);
    if (!task) return NextResponse.json({ error: "找不到任務" }, { status: 404 });
    return NextResponse.json(task);
  } catch (error) {
    return handleApiError(error);
  }
}
