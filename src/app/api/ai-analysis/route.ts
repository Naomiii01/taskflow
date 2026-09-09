import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { aiAnalysisTriggerSchema } from "@/lib/validations/attachment";
import * as attachmentsService from "@/lib/services/attachments-service";

export const runtime = "nodejs";

/** Manually (re-)triggers the AI analysis step for one attachment — e.g. a "重新分析" retry after a failure. */
export async function POST(request: NextRequest) {
  try {
    await requireCurrentUser();
    const body = await request.json();
    const { attachment_id } = aiAnalysisTriggerSchema.parse(body);

    const supabase = await createClient();
    const result = await attachmentsService.runAiAnalysis(supabase, attachment_id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
