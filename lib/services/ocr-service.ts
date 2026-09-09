import "server-only";

import mammoth from "mammoth";
import ExcelJS from "exceljs";

import { AI_MODEL, extractJson, getAnthropicClient } from "@/lib/ai/anthropic-client";
import type { OcrEntityType } from "@/types/database.types";

export type OcrExtractionResult = {
  raw_text: string;
  confidence_score: number | null;
  language: string | null;
};

export type OcrEntity = {
  entity_type: OcrEntityType;
  entity_value: string;
  confidence: number | null;
};

const MAX_RAW_TEXT_CHARS = 100_000;

function truncate(text: string) {
  return text.length > MAX_RAW_TEXT_CHARS ? text.slice(0, MAX_RAW_TEXT_CHARS) : text;
}

/**
 * Extracts raw text from an uploaded file.
 * - JPG/PNG/PDF: Claude vision reads the image/document directly (also
 *   reports language + a rough confidence score).
 * - DOCX: mammoth pulls the text layer directly (no AI call needed).
 * - XLSX: exceljs walks every sheet/row and flattens cell values to text.
 */
export async function extractRawText(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<OcrExtractionResult> {
  if (mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "application/pdf") {
    return extractViaVision(fileBuffer, mimeType);
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
    return { raw_text: truncate(value.trim()), confidence_score: 100, language: null };
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const workbook = new ExcelJS.Workbook();
    // exceljs's bundled .d.ts ambiently augments the global `Buffer` interface
    // with `extends ArrayBuffer` (index.d.ts:1), which — merged with
    // @types/node's newer generic Buffer<T> — makes the *name* `Buffer`
    // impossible for any real Buffer value to satisfy. This is a bug in
    // exceljs's types, not a real runtime concern (Buffer.from() still
    // returns a real Node Buffer), so route around it with `any`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(fileBuffer as any);
    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      lines.push(`# ${sheet.name}`);
      sheet.eachRow((row) => {
        const cells = (row.values as (string | number | boolean | null)[])
          .slice(1)
          .map((v) => (v === null || v === undefined ? "" : String(v)));
        if (cells.some((c) => c.trim() !== "")) lines.push(cells.join("\t"));
      });
    });
    return { raw_text: truncate(lines.join("\n")), confidence_score: 100, language: null };
  }

  throw new Error(`不支援的檔案格式：${mimeType}（檔名：${fileName}）`);
}

async function extractViaVision(fileBuffer: Buffer, mimeType: string): Promise<OcrExtractionResult> {
  const anthropic = getAnthropicClient();
  const base64 = fileBuffer.toString("base64");

  const contentBlock =
    mimeType === "application/pdf"
      ? ({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        } as const)
      : ({
          type: "image",
          source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png", data: base64 },
        } as const);

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          contentBlock,
          {
            type: "text",
            text:
              "請將這份文件/截圖中的所有文字逐字辨識出來（OCR），保留原始段落與版面順序。" +
              "以 JSON 回覆，格式為 {\"raw_text\": string, \"language\": string, \"confidence_score\": number}。" +
              "language 請填寫主要語言代碼（例如 zh-TW、en），confidence_score 為你對辨識準確度的信心（0-100 的數字）。" +
              "若圖片中沒有可辨識文字，raw_text 請填空字串。只回傳 JSON，不要有其他說明文字。",
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("AI OCR 沒有回傳文字內容");

  const parsed = extractJson<{ raw_text: string; language: string; confidence_score: number }>(
    textBlock.text
  );
  return {
    raw_text: truncate(parsed.raw_text ?? ""),
    confidence_score:
      typeof parsed.confidence_score === "number" ? Math.max(0, Math.min(100, parsed.confidence_score)) : null,
    language: parsed.language || null,
  };
}

const ENTITY_TYPES: OcrEntityType[] = [
  "date",
  "email",
  "phone",
  "task_number",
  "department",
  "due_date",
  "action_item",
];

/**
 * Runs a lightweight structured-extraction pass over already-OCR'd text to
 * pull out dates, emails, phone numbers, task numbers, departments, due
 * dates and action items. Works uniformly whether the text came from vision
 * OCR or a DOCX/XLSX text layer.
 */
export async function extractEntities(rawText: string): Promise<OcrEntity[]> {
  if (!rawText.trim()) return [];

  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content:
          `請從以下文字中擷取結構化資訊實體，類型限定於：${ENTITY_TYPES.join(", ")}。\n` +
          `以 JSON 陣列回覆，每個項目格式為 {"entity_type": string, "entity_value": string, "confidence": number}（confidence 為 0-100）。` +
          `找不到任何實體時回傳空陣列 []。只回傳 JSON，不要有其他說明文字。\n\n` +
          `文字內容：\n"""\n${rawText.slice(0, 20_000)}\n"""`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  try {
    const parsed = extractJson<{ entity_type: string; entity_value: string; confidence?: number }[]>(
      textBlock.text
    );
    return parsed
      .filter((e) => ENTITY_TYPES.includes(e.entity_type as OcrEntityType) && e.entity_value?.trim())
      .map((e) => ({
        entity_type: e.entity_type as OcrEntityType,
        entity_value: e.entity_value.trim(),
        confidence: typeof e.confidence === "number" ? Math.max(0, Math.min(100, e.confidence)) : null,
      }));
  } catch {
    return [];
  }
}
