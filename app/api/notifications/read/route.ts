import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { markReadSchema } from "@/lib/validations/notification";
import * as notificationsService from "@/lib/services/notifications-service";

/** Marks one notification read/unread (`{ id, is_read }`), or everything read (`{ all: true }`). */
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = markReadSchema.parse(body);

    const supabase = await createClient();
    const result = await notificationsService.markNotificationRead(supabase, currentUser, values);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
