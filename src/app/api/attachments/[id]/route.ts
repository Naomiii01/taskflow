import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as attachmentsService from "@/lib/services/attachments-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    const supabase = await createClient();
    const attachment = await attachmentsService.getAttachment(supabase, id);
    if (!attachment) return NextResponse.json({ error: "找不到附件" }, { status: 404 });
    return NextResponse.json(attachment);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireCurrentUser();
    const { id } = await params;
    const supabase = await createClient();
    const attachment = await attachmentsService.deleteAttachment(supabase, id, currentUser);
    if (!attachment) return NextResponse.json({ error: "找不到附件" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
