import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { linkTaskSchema } from "@/lib/validations/attachment";
import * as attachmentsService from "@/lib/services/attachments-service";

type Params = { params: Promise<{ id: string }> };

/** Manually confirms/overrides which task an inbox attachment belongs to
 * (the "建立新Task" flow: create the task via POST /api/tasks, then call
 * this to link the just-uploaded attachment to it). */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const { task_id } = linkTaskSchema.parse({ attachment_id: id, ...body });

    const supabase = await createClient();
    const attachment = await attachmentsService.linkAttachmentToTask(supabase, id, task_id);
    return NextResponse.json(attachment);
  } catch (error) {
    return handleApiError(error);
  }
}
