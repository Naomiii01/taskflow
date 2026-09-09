import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as ocrRepo from "@/lib/repositories/ocr-repository";

const querySchema = z.object({ attachment_id: z.string().uuid() });

export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const { attachment_id } = querySchema.parse({
      attachment_id: request.nextUrl.searchParams.get("attachment_id"),
    });

    const supabase = await createClient();
    const result = await ocrRepo.findOcrResult(supabase, attachment_id);
    if (!result) return NextResponse.json({ error: "尚無 OCR 結果" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
