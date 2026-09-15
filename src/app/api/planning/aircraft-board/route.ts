import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { groundWindowQuerySchema } from "@/lib/validations/planning";
import * as aircraftPlanningService from "@/lib/services/aircraft-planning-service";

/** Aircraft Planning Board Lite. `end` is exclusive — the client passes the
 * day after the last visible column so a window overlapping midnight of the
 * last day still shows up. */
export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const sp = request.nextUrl.searchParams;
    const query = groundWindowQuerySchema.parse({ start: sp.get("start"), end: sp.get("end") });
    const supabase = await createClient();
    const board = await aircraftPlanningService.getPlanningBoard(supabase, query.start, query.end);
    return NextResponse.json(board);
  } catch (error) {
    return handleApiError(error);
  }
}
