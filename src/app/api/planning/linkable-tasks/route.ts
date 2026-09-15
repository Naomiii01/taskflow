import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as aircraftPlanningService from "@/lib/services/aircraft-planning-service";

/** Every open (Todo) task, for the ground-window dialog's "排入此窗口的工單"
 * picker — includes tasks already linked to another window so re-assigning
 * is possible. */
export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = await createClient();
    const tasks = await aircraftPlanningService.getLinkableTasks(supabase);
    return NextResponse.json(tasks);
  } catch (error) {
    return handleApiError(error);
  }
}
