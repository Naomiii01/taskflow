import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as aiRepo from "@/lib/repositories/ai-summaries-repository";

const querySchema = z
  .object({
    attachment_id: z.string().uuid().optional(),
    task_id: z.string().uuid().optional(),
  })
  .refine((v) => v.attachment_id || v.task_id, { message: "請提供 attachment_id 或 task_id" });

export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const sp = request.nextUrl.searchParams;
    const query = querySchema.parse({
      attachment_id: sp.get("attachment_id") ?? undefined,
      task_id: sp.get("task_id") ?? undefined,
    });

    const supabase = await createClient();
    const data = await aiRepo.findAiSummaries(supabase, { attachmentId: query.attachment_id, taskId: query.task_id });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
