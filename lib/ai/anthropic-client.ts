import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Thrown when ANTHROPIC_API_KEY is missing/invalid. Callers (the OCR/AI
 * services) catch this and mark the attachment's ocr_status/ai_status as
 * "failed" with a clear error_message instead of crashing the upload
 * pipeline — Phase 3 must never block the UI even if the AI provider isn't
 * configured yet.
 */
export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY 尚未設定，請在環境變數中提供有效金鑰後重新處理此附件。"
    );
    this.name = "AiNotConfiguredError";
  }
}

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

/** Default model for OCR/vision + document-intelligence analysis. Override via env if needed. */
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

/**
 * Extracts the first top-level JSON object/array from a model response,
 * tolerating a ```json ... ``` fence or leading/trailing prose.
 */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("AI 回應中找不到 JSON 內容");
  // Walk from the first brace/bracket to find the matching close, so trailing
  // prose after the JSON payload doesn't break JSON.parse.
  const openChar = candidate[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let end = -1;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === openChar) depth++;
    else if (candidate[i] === closeChar) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error("AI 回應的 JSON 內容不完整");
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
