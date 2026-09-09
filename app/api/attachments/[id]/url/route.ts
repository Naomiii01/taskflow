import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as attachmentsService from "@/lib/services/attachments-service";
import { createSignedAttachmentUrl } from "@/lib/storage/attachments";

type Params = { params: Promise<{ id: string }> };

/** Short-lived signed URL for previewing/downloading one attachment. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    const supabase = await createClient();
    const attachment = await attachmentsService.getAttachment(supabase, id);
    if (!attachment) return NextResponse.json({ error: "找不到附件" }, { status: 404 });

    const url = await createSignedAttachmentUrl(supabase, attachment.storage_path);
    return NextResponse.json({ url });
  } catch (error) {
    return handleApiError(error);
  }
}
