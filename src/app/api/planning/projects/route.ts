import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { PermissionError } from "@/lib/errors";
import { projectSchema } from "@/lib/validations/planning";
import * as projectService from "@/lib/services/project-service";

/** Project Center: RMQ/KHH/其他專案 with 任務數/完成率/待追蹤/超期/風險指數/里程碑. */
export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = await createClient();
    const summaries = await projectService.listProjectSummaries(supabase);
    return NextResponse.json(summaries);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    if (currentUser.role !== "Manager" && currentUser.role !== "Admin") {
      throw new PermissionError("只有主管或管理員可以新增專案");
    }
    const body = await request.json();
    const values = projectSchema.parse(body);
    const supabase = await createClient();
    const project = await projectService.createProject(supabase, values);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
