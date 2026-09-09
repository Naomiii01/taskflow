import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { PermissionError } from "@/lib/errors";
import { waitingItemUpdateSchema } from "@/lib/validations/planning";
import * as waitingService from "@/lib/services/waiting-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    const supabase = await createClient();
    const item = await waitingService.getWaitingItem(supabase, id);
    if (!item) return NextResponse.json({ error: "找不到此等待事項" }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const values = waitingItemUpdateSchema.parse(body);
    const supabase = await createClient();
    const item = await waitingService.updateWaitingItem(supabase, id, values);
    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireCurrentUser();
    if (currentUser.role !== "Admin") throw new PermissionError("只有管理員可以刪除等待事項");
    const { id } = await params;
    const supabase = await createClient();
    await waitingService.deleteWaitingItem(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
