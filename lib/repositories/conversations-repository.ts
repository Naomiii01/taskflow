import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, ChatRole, Json } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

export async function createConversation(supabase: DB, userId: string, title: string | null) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, title })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function findConversationById(supabase: DB, id: string) {
  const { data, error } = await supabase.from("ai_conversations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** RLS already scopes this to the caller's own conversations. */
export async function findConversations(supabase: DB, limit = 30) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function touchConversation(supabase: DB, id: string) {
  const { error } = await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function findMessages(supabase: DB, conversationId: string, limit = 50) {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Most recent `limit` messages, oldest-first — used to build the AI's
 * short-term context window without loading a conversation's full history. */
export async function findRecentMessages(supabase: DB, conversationId: string, limit = 20) {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function createMessage(
  supabase: DB,
  values: { conversation_id: string; role: ChatRole; content: string; tool_calls?: Json | null }
) {
  const { data, error } = await supabase.from("ai_messages").insert(values).select("*").single();
  if (error) throw error;
  return data;
}
