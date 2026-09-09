import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { PermissionError } from "@/lib/errors";
import { recurringTemplateSchema } from "@/lib/validations/planning";
import * as planningLookupsRepo from "@/lib/repositories/planning-lookups-repository";
import type { Database } from "@/types/database.types";

/** Recurring Task Engine template management (A321短天期整理/A339短天期整理/
 * 額外工單整理/修管月計畫整理/長工時安排/人力安排/工期安排, plus any custom
 * Daily/Weekly/Monthly/Quarterly/Yearly template an Admin adds later). */
export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = await createClient();
    const templates = await planningLookupsRepo.findAllRecurringTemplates(supabase);
    return NextResponse.json(templates);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    if (currentUser.role !== "Manager" && currentUser.role !== "Admin") {
      throw new PermissionError("只有主管或管理員可以新增週期任務範本");
    }
    const body = await request.json();
    const values = recurringTemplateSchema.parse(body);
    const supabase = await createClient();
    const template = await planningLookupsRepo.createRecurringTemplate(supabase, {
      name: values.name,
      frequency: values.frequency as Database["taskflow"]["Enums"]["recurrence_frequency_enum"],
      day_of_week: values.day_of_week ?? null,
      day_of_month: values.day_of_month ?? null,
      month_of_year: values.month_of_year ?? null,
      quarter_start_month: values.quarter_start_month ?? null,
      due_day_of_month: values.due_day_of_month ?? null,
      default_title: values.default_title,
      default_description: values.default_description || null,
      default_department_id: values.default_department_id || null,
      default_priority: (values.default_priority ?? "P3") as Database["taskflow"]["Enums"]["task_priority"],
      is_active: values.is_active ?? true,
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
