import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { PermissionError } from "@/lib/errors";
import { milestoneSchema } from "@/lib/validations/planning";
import * as projectService from "@/lib/services/project-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireCurrentUser();
    if (currentUser.role !== "Manager" && currentUser.role !== "Admin") {
      throw new PermissionError("只有主管或管理員可以新增里程碑");
    }
    const { id } = await params;
    const body = await request.json();
    const values = milestoneSchema.parse({ ...body, project_id: id });
    const supabase = await createClient();
    const milestone = await projectService.createMilestone(supabase, values);
    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
