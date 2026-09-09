import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, parseListParam, handleApiError } from "@/lib/api-utils";
import { attachmentQuerySchema } from "@/lib/validations/attachment";
import * as attachmentsService from "@/lib/services/attachments-service";

export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const sp = request.nextUrl.searchParams;

    const query = attachmentQuerySchema.parse({
      task_id: sp.get("task_id") ?? undefined,
      inbox: sp.get("inbox") ?? undefined,
      category: parseListParam(sp, "category"),
      screen_type: parseListParam(sp, "screen_type"),
      ocr_status: parseListParam(sp, "ocr_status"),
      ai_status: parseListParam(sp, "ai_status"),
      q: sp.get("q") ?? undefined,
      page: sp.get("page") ?? undefined,
      pageSize: sp.get("pageSize") ?? undefined,
    });

    const supabase = await createClient();
    const result = await attachmentsService.listAttachments(supabase, query);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
