import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { ocrTriggerSchema } from "@/lib/validations/attachment";
import * as attachmentsService from "@/lib/services/attachments-service";

export const runtime = "nodejs";

/** Manually (re-)triggers the OCR step for one attachment — e.g. a "重新辨識" retry after a failure. */
export async function POST(request: NextRequest) {
  try {
    await requireCurrentUser();
    const body = await request.json();
    const { attachment_id } = ocrTriggerSchema.parse(body);

    const supabase = await createClient();
    const result = await attachmentsService.runOcr(supabase, attachment_id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
