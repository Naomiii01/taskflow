import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { canEditPlanningBoard } from "@/lib/auth";
import { PermissionError } from "@/lib/errors";
import * as aircraftPlanningService from "@/lib/services/aircraft-planning-service";

export const runtime = "nodejs";
// 大檔案（幾千列）逐列比對＋寫入異動紀錄需要一點時間，預設的伺服器逾時
// 太短可能會在處理到一半時被中斷、前端完全沒收到任何回應。拉長到 120 秒。
export const maxDuration = 120;

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".xlsx", ".csv"];

/** 班表匯入：接受 .xlsx / .csv，欄位用寬鬆的別名比對（機號/站別/進站/離站/
 * 備註），逐列驗證後批次寫入，錯誤的列不會擋住其他列。閱覽者不能匯入。 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    if (!canEditPlanningBoard(currentUser)) throw new PermissionError("您沒有 Aircraft Planning Board 的編輯權限");
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

    // 大部分匯出檔（STD/STA）是 Zulu 時間，預設會轉台北時間；有些匯出（例如
    // LTD/LTA 命名的檔案）本身已經是台北當地時間，這種要勾選「時間已經是台北
    // 當地時間」跳過轉換，否則會多轉一次、把每個時間都往後多推 8 小時。
    const alreadyLocal = form.get("already_local") === "true";

    const supabase = await createClient();
    const longHaulRegistrations = await aircraftPlanningService.findLongHaulRegistrations(supabase);

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await aircraftPlanningService.parseImportFile(buffer, file.type, file.name, longHaulRegistrations, alreadyLocal);
    if (rows.length === 0) {
      return NextResponse.json({ error: "檔案裡沒有可匯入的資料列" }, { status: 400 });
    }

    const result = await aircraftPlanningService.importGroundWindows(supabase, rows, currentUser.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
