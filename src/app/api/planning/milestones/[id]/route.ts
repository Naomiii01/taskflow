import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as projectService from "@/lib/services/project-service";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({ is_completed: z.boolean() });

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const { is_completed } = patchSchema.parse(body);
    const supabase = await createClient();
    const milestone = await projectService.setMilestoneCompleted(supabase, id, is_completed);
    return NextResponse.json(milestone);
  } catch (error) {
    return handleApiError(error);
  }
}
