import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";
import { AI_MODEL, getAnthropicClient } from "@/lib/ai/anthropic-client";
import * as conversationsRepo from "@/lib/repositories/conversations-repository";
import { ASSISTANT_TOOLS, executeTool } from "@/lib/services/assistant-tools";
import type { ChatMessage, ChatResponse, ChatToolCall, ConversationSummary } from "@/types/domain";

type DB = SupabaseClient<Database, "taskflow">;
type MessageRow = Awaited<ReturnType<typeof conversationsRepo.createMessage>>;

/**
 * System prompt: tells Claude what TaskFlow is and how to answer, but never
 * how to reach the database directly — all data access goes through the
 * ASSISTANT_TOOLS functions in assistant-tools.ts (see that file's header
 * comment for why: fixed, safe, read-only tools instead of AI-generated SQL).
 */
const SYSTEM_PROMPT = `你是「TaskFlow」航空維修跨部門任務追蹤系統內建的 AI 助理，服務對象是系統的一般使用者、主管與管理員。

你可以使用提供的工具查詢任務、追蹤紀錄、部門工作量、風險分數與文件資料，藉此回答使用者的問題。規則：
- 只根據工具回傳的實際資料回答，不要編造任務編號、日期或數字。
- 若工具查無資料，誠實告知使用者「目前查無相關資料」，不要臆測。
- 回答一律使用繁體中文，語氣專業、簡潔，適合用於工作場合。
- 若使用者的問題含糊（例如只講「進度如何」卻沒有專案關鍵字），可以先詢問澄清，或使用最可能符合的工具嘗試回答並說明假設。
- 引用任務時盡量帶上任務編號，方便使用者到系統中查找。
- 若使用者要求你做工具無法完成的操作（例如新增/修改/刪除任務），請說明你目前只能查詢資料，並建議使用者到對應頁面操作。`;

/** Caps the tool-use loop (ask → call tools → ask again) so a confused model
 * can't spin forever; 5 round-trips is generous for the 8 tools available. */
const MAX_TOOL_ITERATIONS = 5;
/** How much prior conversation to feed back as context per turn. */
const HISTORY_MESSAGE_LIMIT = 20;
const TITLE_MAX_LENGTH = 24;

function deriveTitle(message: string) {
  const oneLine = message.replace(/\s+/g, " ").trim();
  if (!oneLine) return "新對話";
  return oneLine.length > TITLE_MAX_LENGTH ? `${oneLine.slice(0, TITLE_MAX_LENGTH)}…` : oneLine;
}

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    toolCalls: Array.isArray(row.tool_calls) ? (row.tool_calls as unknown as ChatToolCall[]) : null,
    createdAt: row.created_at,
  };
}

export async function listConversations(supabase: DB): Promise<ConversationSummary[]> {
  const rows = await conversationsRepo.findConversations(supabase);
  return rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export async function getConversationMessages(supabase: DB, conversationId: string): Promise<ChatMessage[]> {
  const rows = await conversationsRepo.findMessages(supabase, conversationId);
  return rows.map(toChatMessage);
}

/**
 * Runs one turn of the AI Assistant chat: persists the user's message, feeds
 * recent history + the ASSISTANT_TOOLS into Claude, executes whichever
 * read-only tools it asks for, loops until it produces a final text answer
 * (or MAX_TOOL_ITERATIONS is hit), then persists and returns the assistant's
 * reply. This is intentionally non-streaming — combining a multi-round
 * tool-use loop with token streaming is materially more complex to get right
 * (partial tool-input JSON, interleaving tool execution with stream events),
 * and a short loading state is an acceptable trade-off for a first release.
 */
export async function sendChatMessage(
  supabase: DB,
  userId: string,
  params: { conversationId?: string; message: string }
): Promise<ChatResponse> {
  let conversation = params.conversationId
    ? await conversationsRepo.findConversationById(supabase, params.conversationId)
    : null;
  if (!conversation) {
    conversation = await conversationsRepo.createConversation(supabase, userId, deriveTitle(params.message));
  }

  await conversationsRepo.createMessage(supabase, {
    conversation_id: conversation.id,
    role: "user",
    content: params.message,
  });

  const history = await conversationsRepo.findRecentMessages(supabase, conversation.id, HISTORY_MESSAGE_LIMIT);
  const anthropic = getAnthropicClient();

  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  const allToolCalls: ChatToolCall[] = [];
  let finalText = "";

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: ASSISTANT_TOOLS,
      messages,
    });

    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
    const text = textBlocks
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) finalText = text;

    if (response.stop_reason !== "tool_use") break;

    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUseBlocks.length) break;

    messages.push({ role: "assistant", content: response.content as unknown as Anthropic.ContentBlockParam[] });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const args = (block.input ?? {}) as Record<string, unknown>;
      allToolCalls.push({ name: block.name, args });
      let result: unknown;
      try {
        result = await executeTool(supabase, block.name, args);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "工具執行失敗" };
      }
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
  }

  if (!finalText) finalText = "抱歉，我目前無法回答這個問題，請換個方式提問，或稍後再試一次。";

  const assistantRow = await conversationsRepo.createMessage(supabase, {
    conversation_id: conversation.id,
    role: "assistant",
    content: finalText,
    tool_calls: allToolCalls.length ? (allToolCalls as unknown as Json) : null,
  });

  await conversationsRepo.touchConversation(supabase, conversation.id);

  return { conversationId: conversation.id, message: toChatMessage(assistantRow) };
}
