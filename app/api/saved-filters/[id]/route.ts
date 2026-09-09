import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as savedFiltersService from "@/lib/services/saved-filters-service";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireCurrentUser();
    const { id } = await params;
    const supabase = await createClient();
    await savedFiltersService.removeSavedFilter(supabase, currentUser.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
