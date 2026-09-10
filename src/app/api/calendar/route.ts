import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { calendarEventFormSchema, calendarQuerySchema } from "@/lib/validations/calendar";
import * as calendarService from "@/lib/services/calendar-service";

export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const searchParams = request.nextUrl.searchParams;
    const query = calendarQuerySchema.parse({
      start: searchParams.get("start") ?? undefined,
      end: searchParams.get("end") ?? undefined,
      aircraft_type: searchParams.get("aircraft_type") ?? undefined,
      station: searchParams.get("station") ?? undefined,
      project_code: searchParams.get("project_code") ?? undefined,
    });

    const supabase = await createClient();
    const items = await calendarService.listCalendarItems(supabase, query);
    return NextResponse.json({ data: items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = calendarEventFormSchema.parse(body);

    const supabase = await createClient();
    const event = await calendarService.createCalendarEvent(supabase, values, currentUser.id);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
