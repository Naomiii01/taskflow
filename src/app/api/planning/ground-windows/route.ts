import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { groundWindowSchema } from "@/lib/validations/planning";
import * as aircraftPlanningService from "@/lib/services/aircraft-planning-service";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = groundWindowSchema.parse(body);
    const supabase = await createClient();
    const window = await aircraftPlanningService.createGroundWindow(supabase, values, currentUser.id);
    return NextResponse.json(window, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
