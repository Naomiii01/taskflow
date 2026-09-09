import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { supervisorTaskUpdateSchema } from "@/lib/validations/planning";
import * as supervisorService from "@/lib/services/supervisor-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    const supabase = await createClient();
    const task = await supervisorService.getSupervisorTask(supabase, id);
    if (!task) return NextResponse.json({ error: "找不到此主管交辦事項" }, { status: 404 });
    return NextResponse.json(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const values = supervisorTaskUpdateSchema.parse(body);
    const supabase = await createClient();
    const task = await supervisorService.updateSupervisorTask(supabase, id, values);
    return NextResponse.json(task);
  } catch (error) {
    return handleApiError(error);
  }
}
