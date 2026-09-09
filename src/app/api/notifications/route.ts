import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, parseListParam, handleApiError } from "@/lib/api-utils";
import { notificationQuerySchema } from "@/lib/validations/notification";
import * as notificationsService from "@/lib/services/notifications-service";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const sp = request.nextUrl.searchParams;

    const query = notificationQuerySchema.parse({
      type: parseListParam(sp, "type"),
      is_read: sp.get("is_read") ?? undefined,
      q: sp.get("q") ?? undefined,
      mine: sp.get("mine") ?? undefined,
      page: sp.get("page") ?? undefined,
      pageSize: sp.get("pageSize") ?? undefined,
    });

    const supabase = await createClient();
    const result = await notificationsService.listNotifications(supabase, currentUser, query);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
