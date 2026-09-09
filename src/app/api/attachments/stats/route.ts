import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as attachmentsService from "@/lib/services/attachments-service";

/** Dashboard "Document Intelligence Widget": 附件數量 / OCR完成數 / 待分析數 / AI分析完成數. */
export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = await createClient();
    const stats = await attachmentsService.getDocumentIntelligenceStats(supabase);
    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
