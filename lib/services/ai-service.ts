import "server-only";

import { AI_MODEL, extractJson, getAnthropicClient } from "@/lib/ai/anthropic-client";
import { SCREEN_TYPES } from "@/lib/constants";
import type { AiAnalysisResult } from "@/types/domain";

export type AnalyzeAttachmentParams = {
  rawText: string;
  fileName: string;
  /** Existing task numbers (e.g. "T-2026-00042") this attachment could belong to. */
  candidateTaskNumbers: string[];
  /** Existing department names in this system, so the AI only picks real ones. */
  knownDepartments: string[];
  /** Server "today" (YYYY-MM-DD) so the model can compute a real suggested_followup_date. */
  today: string;
};

/**
 * Single Claude call that does the "AI Analysis Module" + "Screenshot
 * Intelligence" work from the Phase 3 spec: classifies the screenshot/
 * document type, writes a summary/key points/action items/risk items,
 * suggests a follow-up date + involved departments, tries to match an
 * existing task, and — depending on the detected screen_type — extracts
 * Email/Teams/LINE/SAP specific fields.
 */
export async function analyzeAttachment(params: AnalyzeAttachmentParams): Promise<AiAnalysisResult> {
  const anthropic = getAnthropicClient();
  const { rawText, fileName, candidateTaskNumbers, knownDepartments, today } = params;

  const prompt = `你是航空維修跨部門任務追蹤系統的文件智慧分析助理。今天日期是 ${today}。
以下是一份已透過 OCR/文字擷取的檔案內容（檔名：${fileName}）：
"""
${rawText.slice(0, 20_000) || "(無可辨識文字)"}
"""

請完成以下分析並以單一 JSON 物件回覆（不要有 JSON 以外的文字、不要使用 markdown code fence）：

{
  "screen_type": 從 [${SCREEN_TYPES.join(", ")}] 選一個，判斷這是哪種畫面/文件類型,
  "summary": 以繁體中文寫 2-3 句重點摘要,
  "key_points": string[]，條列 2-6 個重點,
  "action_items": string[]，條列建議的待辦事項（若無則為空陣列）,
  "risk_items": string[]，條列潛在風險或需注意事項（若無則為空陣列）,
  "suggested_followup_date": 若內容顯示需要追蹤，請回傳 YYYY-MM-DD 格式的建議追蹤日期（以今天 ${today} 為基準推算，例如「3 天後」= 今天 + 3 天）；若不需追蹤則為 null,
  "departments": string[]，從這些已存在的部門中挑選與此內容相關者：[${knownDepartments.join(", ")}]（不確定則回傳空陣列，不要自創部門名稱）,
  "matched_task_number": 若內容明確提到以下任一任務編號，請回傳該編號字串；否則為 null。候選任務編號：[${candidateTaskNumbers.slice(0, 300).join(", ") || "(無)"}],
  "email": 若 screen_type 為 "Email"，請填 {"sender": string, "recipient": string, "subject": string, "sent_at": string, "content": string}（欄位不確定可留空字串）；否則省略此欄位,
  "teams": 若 screen_type 為 "Teams"，請填一個陣列 [{"speaker": string, "message_time": string, "content": string}, ...]，依對話中每則訊息各一筆；否則省略此欄位,
  "line": 若 screen_type 為 "LINE"，請填一個陣列 [{"group_name": string, "speaker": string, "message": string, "message_time": string}, ...]；否則省略此欄位,
  "sap": 若 screen_type 為 "SAP"，請填 {"work_order_number": string, "part_number": string, "aircraft_registration": string, "work_card_info": string, "status_info": string}（欄位不確定可留空字串）；否則省略此欄位
}`;

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("AI 分析沒有回傳文字內容");

  const parsed = extractJson<Record<string, unknown>>(textBlock.text);

  const screenType = SCREEN_TYPES.includes(parsed.screen_type as (typeof SCREEN_TYPES)[number])
    ? (parsed.screen_type as AiAnalysisResult["screen_type"])
    : "Other";

  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

  const result: AiAnalysisResult = {
    screen_type: screenType,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    key_points: asStringArray(parsed.key_points),
    action_items: asStringArray(parsed.action_items),
    risk_items: asStringArray(parsed.risk_items),
    suggested_followup_date:
      typeof parsed.suggested_followup_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.suggested_followup_date)
        ? parsed.suggested_followup_date
        : null,
    departments: asStringArray(parsed.departments).filter((d) => knownDepartments.includes(d)),
    matched_task_number:
      typeof parsed.matched_task_number === "string" && candidateTaskNumbers.includes(parsed.matched_task_number)
        ? parsed.matched_task_number
        : null,
  };

  if (screenType === "Email" && parsed.email && typeof parsed.email === "object") {
    const e = parsed.email as Record<string, unknown>;
    result.email = {
      sender: typeof e.sender === "string" ? e.sender : undefined,
      recipient: typeof e.recipient === "string" ? e.recipient : undefined,
      subject: typeof e.subject === "string" ? e.subject : undefined,
      sent_at: typeof e.sent_at === "string" ? e.sent_at : undefined,
      content: typeof e.content === "string" ? e.content : undefined,
    };
  }

  if (screenType === "Teams" && Array.isArray(parsed.teams)) {
    result.teams = (parsed.teams as Record<string, unknown>[]).map((m) => ({
      speaker: typeof m.speaker === "string" ? m.speaker : undefined,
      message_time: typeof m.message_time === "string" ? m.message_time : undefined,
      content: typeof m.content === "string" ? m.content : undefined,
    }));
  }

  if (screenType === "LINE" && Array.isArray(parsed.line)) {
    result.line = (parsed.line as Record<string, unknown>[]).map((m) => ({
      group_name: typeof m.group_name === "string" ? m.group_name : undefined,
      speaker: typeof m.speaker === "string" ? m.speaker : undefined,
      message: typeof m.message === "string" ? m.message : undefined,
      message_time: typeof m.message_time === "string" ? m.message_time : undefined,
    }));
  }

  if (screenType === "SAP" && parsed.sap && typeof parsed.sap === "object") {
    const s = parsed.sap as Record<string, unknown>;
    result.sap = {
      work_order_number: typeof s.work_order_number === "string" ? s.work_order_number : undefined,
      part_number: typeof s.part_number === "string" ? s.part_number : undefined,
      aircraft_registration: typeof s.aircraft_registration === "string" ? s.aircraft_registration : undefined,
      work_card_info: typeof s.work_card_info === "string" ? s.work_card_info : undefined,
      status_info: typeof s.status_info === "string" ? s.status_info : undefined,
    };
  }

  return result;
}
