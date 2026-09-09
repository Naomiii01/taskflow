import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";
import type { AiAnalysisResult } from "@/types/domain";
import { AI_MODEL } from "@/lib/ai/anthropic-client";

type DB = SupabaseClient<Database, "taskflow">;

export async function findAiSummaries(supabase: DB, filter: { attachmentId?: string; taskId?: string }) {
  let q = supabase.from("ai_summaries").select("*").order("created_at", { ascending: false });
  if (filter.attachmentId) q = q.eq("attachment_id", filter.attachmentId);
  if (filter.taskId) q = q.eq("task_id", filter.taskId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function upsertAiSummary(
  supabase: DB,
  attachmentId: string,
  taskId: string | null,
  result: AiAnalysisResult
) {
  const { data, error } = await supabase
    .from("ai_summaries")
    .upsert(
      {
        attachment_id: attachmentId,
        task_id: taskId,
        summary: result.summary,
        key_points: result.key_points as unknown as Json,
        risk_items: result.risk_items as unknown as Json,
        action_items: result.action_items as unknown as Json,
        suggested_followup_date: result.suggested_followup_date,
        departments: result.departments as unknown as Json,
        model: AI_MODEL,
      },
      { onConflict: "attachment_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function upsertEmailMetadata(supabase: DB, attachmentId: string, email: NonNullable<AiAnalysisResult["email"]>) {
  const { error } = await supabase.from("email_metadata").upsert(
    {
      attachment_id: attachmentId,
      sender: email.sender ?? null,
      recipient: email.recipient ?? null,
      subject: email.subject ?? null,
      sent_at: email.sent_at ?? null,
      content: email.content ?? null,
    },
    { onConflict: "attachment_id" }
  );
  if (error) throw error;
}

export async function replaceTeamsMessages(supabase: DB, attachmentId: string, messages: NonNullable<AiAnalysisResult["teams"]>) {
  const { error: deleteError } = await supabase.from("teams_messages").delete().eq("attachment_id", attachmentId);
  if (deleteError) throw deleteError;
  if (!messages.length) return;
  const { error } = await supabase.from("teams_messages").insert(
    messages.map((m) => ({
      attachment_id: attachmentId,
      speaker: m.speaker ?? null,
      message_time: m.message_time ?? null,
      content: m.content ?? null,
    }))
  );
  if (error) throw error;
}

export async function replaceLineMessages(supabase: DB, attachmentId: string, messages: NonNullable<AiAnalysisResult["line"]>) {
  const { error: deleteError } = await supabase.from("line_messages").delete().eq("attachment_id", attachmentId);
  if (deleteError) throw deleteError;
  if (!messages.length) return;
  const { error } = await supabase.from("line_messages").insert(
    messages.map((m) => ({
      attachment_id: attachmentId,
      group_name: m.group_name ?? null,
      speaker: m.speaker ?? null,
      message: m.message ?? null,
      message_time: m.message_time ?? null,
    }))
  );
  if (error) throw error;
}

export async function upsertSapExtraction(supabase: DB, attachmentId: string, sap: NonNullable<AiAnalysisResult["sap"]>) {
  const { error } = await supabase.from("sap_extractions").upsert(
    {
      attachment_id: attachmentId,
      work_order_number: sap.work_order_number ?? null,
      part_number: sap.part_number ?? null,
      aircraft_registration: sap.aircraft_registration ?? null,
      work_card_info: sap.work_card_info ?? null,
      status_info: sap.status_info ?? null,
    },
    { onConflict: "attachment_id" }
  );
  if (error) throw error;
}
