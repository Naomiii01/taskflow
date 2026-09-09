import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { taskFormSchema } from "@/lib/validations/task";
import * as waitingService from "@/lib/services/waiting-service";

type Params = { params: Promise<{ id: string }> };

/** Derived Task Engine: creates a Child Task from a Waiting Center reply
 * (e.g. 工程部回覆需新增工卡) and marks the waiting item Replied. */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const values = taskFormSchema.parse(body);
    const supabase = await createClient();
    const task = await waitingService.createDerivedTask(supabase, id, values, currentUser.id);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
