import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { FOLLOW_UP_ENTITY_TYPES } from "@/lib/constants";
import { followUpRecordSchema } from "@/lib/validations/planning";
import * as followUpService from "@/lib/services/follow-up-service";
import type { FollowUpEntityType } from "@/types/database.types";

const querySchema = z.object({
  entity_type: z.enum(FOLLOW_UP_ENTITY_TYPES as [string, ...string[]]),
  entity_id: z.string().uuid(),
});

/** Follow-up Center history for one entity (task/waiting_item/supervisor_task)
 * — preserves 第一次/第二次/第三次追蹤 (all attempts, never overwritten). */
export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const sp = request.nextUrl.searchParams;
    const { entity_type, entity_id } = querySchema.parse({
      entity_type: sp.get("entity_type"),
      entity_id: sp.get("entity_id"),
    });
    const supabase = await createClient();
    const records = await followUpService.listFollowUpsForEntity(supabase, entity_type as FollowUpEntityType, entity_id);
    return NextResponse.json(records);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = followUpRecordSchema.parse(body);
    const supabase = await createClient();
    const record = await followUpService.createFollowUp(supabase, values, currentUser.id);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
