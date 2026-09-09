import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { chatRequestSchema } from "@/lib/validations/assistant";
import * as assistantService from "@/lib/services/assistant-service";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const values = chatRequestSchema.parse(body);

    const supabase = await createClient();
    const result = await assistantService.sendChatMessage(supabase, currentUser.id, {
      conversationId: values.conversation_id,
      message: values.message,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
