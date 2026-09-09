import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { reportRequestSchema } from "@/lib/validations/assistant";
import * as reportGenerator from "@/lib/services/report-generator";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = reportRequestSchema.parse(body);

    const supabase = await createClient();

    switch (values.type) {
      case "daily": {
        const report = await reportGenerator.generateDailyReport(supabase, currentUser.id);
        return NextResponse.json(report);
      }
      case "weekly": {
        const report = await reportGenerator.generateWeeklyReport(supabase, currentUser.id);
        return NextResponse.json(report);
      }
      case "monthly": {
        const report = await reportGenerator.generateMonthlyReport(supabase, values.month);
        return NextResponse.json(report);
      }
      case "project": {
        const report = await reportGenerator.generateProjectReport(supabase, values.keyword);
        return NextResponse.json(report);
      }
      case "department": {
        const report = await reportGenerator.generateDepartmentReport(supabase, values.department_id);
        return NextResponse.json(report);
      }
    }
  } catch (error) {
    return handleApiError(error);
  }
}
