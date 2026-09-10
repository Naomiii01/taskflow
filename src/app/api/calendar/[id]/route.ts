import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { calendarEventUpdateSchema } from "@/lib/validations/calendar";
import * as calendarService from "@/lib/services/calendar-service";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const values = calendarEventUpdateSchema.parse(body);

    const supabase = await createClient();
    const event = await calendarService.updateCalendarEvent(supabase, id, values);
    return NextResponse.json(event);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    const supabase = await createClient();
    await calendarService.deleteCalendarEvent(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
