import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { uploadMetadataSchema, validateAttachmentFile } from "@/lib/validations/attachment";
import * as attachmentsService from "@/lib/services/attachments-service";
import type { AttachmentCategory } from "@/types/database.types";

export const runtime = "nodejs";

/**
 * Upload step of the Phase 3 pipeline. Accepts multipart/form-data with a
 * `file` field and optional `task_id` / `category` fields. Stores the file
 * in Supabase Storage, inserts the attachments row, and queues OCR + AI
 * analysis to run in the background (see attachments-service.uploadAttachment)
 * — this handler returns as soon as the upload itself is done.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "請提供要上傳的檔案" }, { status: 400 });
    }

    const invalidReason = validateAttachmentFile(file);
    if (invalidReason) return NextResponse.json({ error: invalidReason }, { status: 400 });

    const meta = uploadMetadataSchema.parse({
      task_id: (form.get("task_id") as string | null) || null,
      category: (form.get("category") as string | null) || undefined,
    });

    const supabase = await createClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const attachment = await attachmentsService.uploadAttachment(
      supabase,
      {
        fileBuffer: buffer,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        taskId: meta.task_id ?? null,
        category: meta.category as AttachmentCategory | undefined,
      },
      currentUser
    );

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
