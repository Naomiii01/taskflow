import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { documentSearchQuerySchema } from "@/lib/validations/attachment";
import * as attachmentsService from "@/lib/services/attachments-service";

/** Document Search: full-text search across OCR text, AI summaries, filenames, Email/Teams/LINE content. */
export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const { q } = documentSearchQuerySchema.parse({ q: request.nextUrl.searchParams.get("q") ?? "" });

    const supabase = await createClient();
    const data = await attachmentsService.searchDocuments(supabase, q);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
