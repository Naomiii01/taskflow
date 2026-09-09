import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { savedFilterSchema } from "@/lib/validations/followup";
import * as savedFiltersService from "@/lib/services/saved-filters-service";

export async function GET() {
  try {
    const currentUser = await requireCurrentUser();
    const supabase = await createClient();
    const filters = await savedFiltersService.listSavedFilters(supabase, currentUser.id);
    return NextResponse.json({ data: filters });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = savedFilterSchema.parse(body);

    const supabase = await createClient();
    const filter = await savedFiltersService.saveFilter(supabase, currentUser.id, values);
    return NextResponse.json(filter, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
