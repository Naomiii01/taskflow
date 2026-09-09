import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { AttachmentQuery } from "@/lib/validations/attachment";

type DB = SupabaseClient<Database, "taskflow">;

export const ATTACHMENT_SELECT = `
  *,
  uploader:users!attachments_upload_user_fkey(id, name, email, avatar_url),
  task:tasks!attachments_task_id_fkey(id, task_number, title),
  matched_task:tasks!attachments_matched_task_id_fkey(id, task_number, title),
  ocr_result:ocr_results(*),
  ocr_entities(*),
  ai_summary:ai_summaries!ai_summaries_source_attachment_id_fkey(*),
  email_metadata(*),
  teams_messages(*),
  line_messages(*),
  sap_extraction:sap_extractions(*)
`;

export async function findAttachments(supabase: DB, query: AttachmentQuery) {
  let q = supabase.from("attachments").select(ATTACHMENT_SELECT, { count: "exact" });

  if (query.task_id) q = q.eq("task_id", query.task_id);
  else if (query.inbox) q = q.is("task_id", null);

  if (query.category?.length)
    q = q.in("category", query.category as Database["taskflow"]["Tables"]["attachments"]["Row"]["category"][]);
  if (query.screen_type?.length)
    q = q.in("screen_type", query.screen_type as Database["taskflow"]["Tables"]["attachments"]["Row"]["screen_type"][]);
  if (query.ocr_status?.length)
    q = q.in("ocr_status", query.ocr_status as Database["taskflow"]["Tables"]["attachments"]["Row"]["ocr_status"][]);
  if (query.ai_status?.length)
    q = q.in("ai_status", query.ai_status as Database["taskflow"]["Tables"]["attachments"]["Row"]["ai_status"][]);
  if (query.q && query.q.trim()) {
    const term = query.q.trim().replace(/[%_]/g, (m) => `\\${m}`);
    q = q.ilike("file_name", `%${term}%`);
  }

  q = q.order("created_at", { ascending: false });

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function findAttachmentById(supabase: DB, id: string) {
  const { data, error } = await supabase.from("attachments").select(ATTACHMENT_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findAttachmentsByIds(supabase: DB, ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("attachments").select(ATTACHMENT_SELECT).in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function createAttachment(
  supabase: DB,
  values: Database["taskflow"]["Tables"]["attachments"]["Insert"]
) {
  const { data, error } = await supabase.from("attachments").insert(values).select(ATTACHMENT_SELECT).single();
  if (error) throw error;
  return data;
}

export async function updateAttachment(
  supabase: DB,
  id: string,
  patch: Database["taskflow"]["Tables"]["attachments"]["Update"]
) {
  const { data, error } = await supabase
    .from("attachments")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(ATTACHMENT_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAttachment(supabase: DB, id: string) {
  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) throw error;
}

/** Task numbers of every non-deleted task — used as AI task-matching candidates. */
export async function findAllTaskNumbers(supabase: DB) {
  const { data, error } = await supabase.from("tasks").select("id, task_number").is("deleted_at", null);
  if (error) throw error;
  return data ?? [];
}

// --- Document Search (#30): ILIKE lookups across the related tables -------
// PostgREST can't OR-filter across an embedded relation in one call, so we
// resolve matching attachment ids per source table, then fetch full rows.

async function idsFromMatch(
  supabase: DB,
  table: "ocr_results" | "ai_summaries" | "email_metadata" | "teams_messages" | "line_messages",
  column: string,
  term: string
): Promise<string[]> {
  const safe = term.replace(/[%_]/g, (m) => `\\${m}`);
  const { data, error } = await supabase.from(table).select("attachment_id").ilike(column, `%${safe}%`);
  if (error) throw error;
  return (data ?? []).map((r) => (r as { attachment_id: string | null }).attachment_id).filter((v): v is string => !!v);
}

export async function findDocumentSearchMatches(supabase: DB, term: string) {
  const [byFileName, byOcrText, byAiSummary, byEmail, byTeams, byLine] = await Promise.all([
    (async () => {
      const safe = term.replace(/[%_]/g, (m) => `\\${m}`);
      const { data, error } = await supabase.from("attachments").select("id").ilike("file_name", `%${safe}%`);
      if (error) throw error;
      return (data ?? []).map((r) => r.id);
    })(),
    idsFromMatch(supabase, "ocr_results", "raw_text", term),
    idsFromMatch(supabase, "ai_summaries", "summary", term),
    idsFromMatch(supabase, "email_metadata", "content", term),
    idsFromMatch(supabase, "teams_messages", "content", term),
    idsFromMatch(supabase, "line_messages", "message", term),
  ]);

  const matchedIn = new Map<string, Set<string>>();
  const add = (ids: string[], label: string) => {
    for (const id of ids) {
      if (!matchedIn.has(id)) matchedIn.set(id, new Set());
      matchedIn.get(id)!.add(label);
    }
  };
  add(byFileName, "file_name");
  add(byOcrText, "ocr_text");
  add(byAiSummary, "ai_summary");
  add(byEmail, "email");
  add(byTeams, "teams");
  add(byLine, "line");

  return matchedIn;
}
