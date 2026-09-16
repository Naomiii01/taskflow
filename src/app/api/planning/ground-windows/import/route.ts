import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import * as aircraftPlanningService from "@/lib/services/aircraft-planning-service";

export const runtime = "nodejs";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".xlsx", ".csv"];

/** 班表匯入：接受 .xlsx / .csv，欄位用寬鬆的別名比對（機號/站別/進站/離站/
 * 備註），逐列驗證後批次寫入，錯誤的列不會擋住其他列。 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "請提供要匯入的檔案" }, { status: 400 });
    }
    const lowerName = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      return NextResponse.json({ error: "只支援 .xlsx 或 .csv 檔案" }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: "檔案太大，請控制在 10MB 以內" }, { status: 400 });
    }

    const supabase = await createClient();
    const longHaulRegistrations = await aircraftPlanningService.findLongHaulRegistrations(supabase);

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await aircraftPlanningService.parseImportFile(buffer, file.type, file.name, longHaulRegistrations);
    if (rows.length === 0) {
      return NextResponse.json({ error: "檔案裡沒有可匯入的資料列" }, { status: 400 });
    }

    const result = await aircraftPlanningService.importGroundWindows(supabase, rows, currentUser.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
