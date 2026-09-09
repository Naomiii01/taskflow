import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { searchRequestSchema } from "@/lib/validations/assistant";
import { searchDocuments } from "@/lib/services/attachments-service";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import { taskQuerySchema } from "@/lib/validations/task";

/**
 * Semantic Search (pgvector + an embedding provider) was explicitly deferred
 * for this pass — see the `knowledge_chunks` table comment in the Phase 6
 * migration and the README. Rather than returning a bare "not configured"
 * error, this endpoint degrades gracefully to the same keyword search the
 * rest of the app already uses (task number/title/description, plus
 * attachment file name / OCR text / AI summary / Email / Teams / LINE
 * content), and says so explicitly in the response so the UI can surface a
 * "語意搜尋尚未啟用" notice instead of silently returning weaker results.
 * Once an embedding provider is configured, this handler is the only place
 * that needs to change — everything else (schema, tools, UI) is ready.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();
    const { q } = searchRequestSchema.parse(body);

    const supabase = await createClient();

    const taskQuery = taskQuerySchema.parse({ q, pageSize: 10, includeDeleted: false });
    const [documents, taskResult] = await Promise.all([
      searchDocuments(supabase, q),
      tasksRepo.findTasks(supabase, taskQuery, currentUser.id),
    ]);

    return NextResponse.json({
      semantic_search_configured: false,
      mode: "keyword",
      notice: "語意搜尋（pgvector + Embeddings）尚未設定，目前以關鍵字比對顯示結果。",
      tasks: taskResult.data.slice(0, 10).map((t) => ({
        task_number: t.task_number,
        title: t.title,
        status: t.status,
        due_date: t.due_date,
      })),
      documents: documents.slice(0, 15).map((r) => ({
        file_name: r.attachment.file_name,
        task_number: r.attachment.task?.task_number ?? null,
        task_title: r.attachment.task?.title ?? null,
        matched_in: r.matchedIn,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
