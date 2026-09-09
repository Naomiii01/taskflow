import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { notificationSettingsSchema } from "@/lib/validations/notification";
import * as notificationsService from "@/lib/services/notifications-service";

export async function GET() {
  try {
    const currentUser = await requireCurrentUser();
    const supabase = await createClient();
    const settings = await notificationsService.getNotificationSettings(supabase, currentUser);
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = notificationSettingsSchema.parse(body);

    const supabase = await createClient();
    const settings = await notificationsService.updateNotificationSettings(supabase, currentUser, values);
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
