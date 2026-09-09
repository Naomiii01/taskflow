import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { waitingItemSchema, waitingQuerySchema } from "@/lib/validations/planning";
import * as waitingService from "@/lib/services/waiting-service";

export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const sp = request.nextUrl.searchParams;
    const query = waitingQuerySchema.parse({
      status: sp.get("status") ?? undefined,
      waiting_unit: sp.get("waiting_unit") ?? undefined,
    });
    const supabase = await createClient();
    const items = await waitingService.listWaitingItems(supabase, query);
    return NextResponse.json(items);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = waitingItemSchema.parse(body);
    const supabase = await createClient();
    const item = await waitingService.createWaitingItem(supabase, values, currentUser.id);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
