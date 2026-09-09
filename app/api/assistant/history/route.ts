import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { historyQuerySchema } from "@/lib/validations/assistant";
import * as assistantService from "@/lib/services/assistant-service";

/**
 * No `conversation_id` → list the caller's conversations (sidebar).
 * With `conversation_id` → that conversation's messages (opening a thread).
 * RLS on ai_conversations/ai_messages already scopes both to the caller.
 */
export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    const sp = request.nextUrl.searchParams;
    const query = historyQuerySchema.parse({ conversation_id: sp.get("conversation_id") ?? undefined });

    const supabase = await createClient();

    if (query.conversation_id) {
      const messages = await assistantService.getConversationMessages(supabase, query.conversation_id);
      return NextResponse.json({ messages });
    }

    const conversations = await assistantService.listConversations(supabase);
    return NextResponse.json({ conversations });
  } catch (error) {
    return handleApiError(error);
  }
}
