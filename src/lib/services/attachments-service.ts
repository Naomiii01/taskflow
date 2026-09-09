import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { CurrentUser } from "@/lib/auth";
import * as attachmentsRepo from "@/lib/repositories/attachments-repository";
import * as ocrRepo from "@/lib/repositories/ocr-repository";
import * as aiRepo from "@/lib/repositories/ai-summaries-repository";
import * as lookupsRepo from "@/lib/repositories/lookups-repository";
import { createNotification } from "@/lib/repositories/notifications-repository";
import { buildStoragePath, deleteAttachmentObject, downloadAttachmentObject, uploadAttachmentObject } from "@/lib/storage/attachments";
import { extractEntities, extractRawText } from "@/lib/services/ocr-service";
import { analyzeAttachment } from "@/lib/services/ai-service";
import { AiNotConfiguredError } from "@/lib/ai/anthropic-client";
import type { AttachmentCategory } from "@/types/database.types";
import type { AttachmentQuery } from "@/lib/validations/attachment";
import { PermissionError } from "@/lib/errors";

export { PermissionError };

type DB = SupabaseClient<Database, "taskflow">;

function inferCategory(mimeType: string, requested?: AttachmentCategory): AttachmentCategory {
  if (requested) return requested;
  if (mimeType === "image/jpeg" || mimeType === "image/png") return "screenshots";
  return "documents";
}

export async function listAttachments(supabase: DB, query: AttachmentQuery) {
  const { data, total } = await attachmentsRepo.findAttachments(supabase, query);
  return { data, total, page: query.page, pageSize: query.pageSize };
}

export async function getAttachment(supabase: DB, id: string) {
  return attachmentsRepo.findAttachmentById(supabase, id);
}

/**
 * Handles the "Upload" step of the Phase 3 pipeline: stores the file in
 * Supabase Storage, inserts the attachments row, logs the task activity —
 * then registers the OCR/AI processing to run via Next.js `after()` so the
 * HTTP response returns immediately and the UI is never blocked on it.
 */
export async function uploadAttachment(
  supabase: DB,
  params: {
    fileBuffer: Buffer;
    fileName: string;
    mimeType: string;
    fileSize: number;
    taskId: string | null;
    category?: AttachmentCategory;
  },
  currentUser: CurrentUser
) {
  const category = inferCategory(params.mimeType, params.category);
  const storagePath = buildStoragePath(params.taskId, category, params.fileName);

  await uploadAttachmentObject(supabase, storagePath, params.fileBuffer, params.mimeType);

  const attachment = await attachmentsRepo.createAttachment(supabase, {
    task_id: params.taskId,
    file_name: params.fileName,
    storage_path: storagePath,
    file_type: params.mimeType,
    file_size: params.fileSize,
    uploaded_by: currentUser.id,
    category,
    ocr_status: "pending",
    ai_status: "pending",
  });

  if (params.taskId) {
    await supabase.from("task_logs").insert({
      task_id: params.taskId,
      action_type: "attachment_added",
      new_value: { file_name: params.fileName, attachment_id: attachment.id } as never,
      user_id: currentUser.id,
    });
  }

  // Fire-and-forget: runs after the response is sent, so upload requests
  // return immediately regardless of how long OCR/AI processing takes.
  after(() => processAttachmentPipeline(supabase, attachment.id).catch((err) => {
    console.error("[attachments] background processing failed", attachment.id, err);
  }));

  return attachment;
}

export async function deleteAttachment(supabase: DB, id: string, currentUser: CurrentUser) {
  const existing = await attachmentsRepo.findAttachmentById(supabase, id);
  if (!existing) return null;
  if (currentUser.role !== "Admin" && existing.uploaded_by !== currentUser.id) {
    throw new PermissionError("只有上傳者或管理員可以刪除附件");
  }
  await deleteAttachmentObject(supabase, existing.storage_path).catch((err) =>
    console.error("[attachments] storage delete failed", existing.storage_path, err)
  );
  await attachmentsRepo.deleteAttachment(supabase, id);
  return existing;
}

/** Confirms (or overrides) which task an inbox attachment belongs to. */
export async function linkAttachmentToTask(supabase: DB, attachmentId: string, taskId: string) {
  return attachmentsRepo.updateAttachment(supabase, attachmentId, { task_id: taskId });
}

// --- Processing pipeline ---------------------------------------------------

/** OCR step only — also used by the manual "重新辨識" retry action. */
export async function runOcr(supabase: DB, attachmentId: string) {
  const attachment = await attachmentsRepo.findAttachmentById(supabase, attachmentId);
  if (!attachment) throw new Error("找不到附件");

  await attachmentsRepo.updateAttachment(supabase, attachmentId, { ocr_status: "processing", error_message: null });

  try {
    const fileBytes = await downloadAttachmentObject(supabase, attachment.storage_path);
    const extraction = await extractRawText(fileBytes, attachment.file_type ?? "", attachment.file_name);
    await ocrRepo.upsertOcrResult(supabase, attachmentId, extraction);

    const entities = await extractEntities(extraction.raw_text);
    await ocrRepo.replaceOcrEntities(supabase, attachmentId, entities);

    await attachmentsRepo.updateAttachment(supabase, attachmentId, { ocr_status: "completed" });
    return extraction;
  } catch (err) {
    const message = err instanceof AiNotConfiguredError ? err.message : err instanceof Error ? err.message : "OCR 處理失敗";
    await attachmentsRepo.updateAttachment(supabase, attachmentId, { ocr_status: "failed", error_message: message });
    throw err;
  }
}

/** AI analysis step only — assumes OCR has already produced raw_text. Also used by the manual "重新分析" retry action. */
export async function runAiAnalysis(supabase: DB, attachmentId: string) {
  const attachment = await attachmentsRepo.findAttachmentById(supabase, attachmentId);
  if (!attachment) throw new Error("找不到附件");

  const ocrResult = await ocrRepo.findOcrResult(supabase, attachmentId);
  if (!ocrResult) throw new Error("尚未完成 OCR，無法進行 AI 分析");

  await attachmentsRepo.updateAttachment(supabase, attachmentId, { ai_status: "processing", error_message: null });

  try {
    const [departments, taskRows] = await Promise.all([
      lookupsRepo.findAllDepartments(supabase),
      attachmentsRepo.findAllTaskNumbers(supabase),
    ]);

    const result = await analyzeAttachment({
      rawText: ocrResult.raw_text ?? "",
      fileName: attachment.file_name,
      candidateTaskNumbers: taskRows.map((t) => t.task_number),
      knownDepartments: departments.map((d) => d.department_name),
      today: new Date().toISOString().slice(0, 10),
    });

    // Task Auto Link: if this attachment isn't tied to a task yet and the AI
    // confidently matched an existing task number, link it automatically.
    let linkedTaskId = attachment.task_id;
    let matchedTaskId: string | null = null;
    if (result.matched_task_number) {
      const match = taskRows.find((t) => t.task_number === result.matched_task_number);
      if (match) {
        matchedTaskId = match.id;
        if (!linkedTaskId) linkedTaskId = match.id;
      }
    }

    await aiRepo.upsertAiSummary(supabase, attachmentId, linkedTaskId, result);

    if (result.screen_type === "Email" && result.email) await aiRepo.upsertEmailMetadata(supabase, attachmentId, result.email);
    if (result.screen_type === "Teams" && result.teams) await aiRepo.replaceTeamsMessages(supabase, attachmentId, result.teams);
    if (result.screen_type === "LINE" && result.line) await aiRepo.replaceLineMessages(supabase, attachmentId, result.line);
    if (result.screen_type === "SAP" && result.sap) await aiRepo.upsertSapExtraction(supabase, attachmentId, result.sap);

    await attachmentsRepo.updateAttachment(supabase, attachmentId, {
      ai_status: "completed",
      screen_type: result.screen_type,
      matched_task_id: matchedTaskId,
      task_id: linkedTaskId,
    });

    if (linkedTaskId) {
      await supabase.from("task_logs").insert({
        task_id: linkedTaskId,
        action_type: attachment.task_id ? "ai_analysis_completed" : "attachment_auto_linked",
        new_value: { attachment_id: attachmentId, summary: result.summary } as never,
        user_id: attachment.uploaded_by,
      });
    }

    if (attachment.uploaded_by) {
      await createNotification(supabase, {
        user_id: attachment.uploaded_by,
        related_task_id: linkedTaskId,
        type: "document_processed",
        title: `附件分析完成：${attachment.file_name}`,
        message: result.summary || null,
      });
    }

    return result;
  } catch (err) {
    const message = err instanceof AiNotConfiguredError ? err.message : err instanceof Error ? err.message : "AI 分析失敗";
    await attachmentsRepo.updateAttachment(supabase, attachmentId, { ai_status: "failed", error_message: message });
    throw err;
  }
}

/** Full pipeline: OCR then AI analysis. AI is skipped (not failed) if OCR fails. */
export async function processAttachmentPipeline(supabase: DB, attachmentId: string) {
  try {
    await runOcr(supabase, attachmentId);
  } catch {
    await attachmentsRepo.updateAttachment(supabase, attachmentId, { ai_status: "skipped" });
    return;
  }
  await runAiAnalysis(supabase, attachmentId).catch(() => undefined);
}

// --- Document Search (#30) -------------------------------------------------

export async function searchDocuments(supabase: DB, term: string) {
  const matches = await attachmentsRepo.findDocumentSearchMatches(supabase, term);
  const ids = Array.from(matches.keys());
  const attachments = await attachmentsRepo.findAttachmentsByIds(supabase, ids);
  return attachments
    .map((attachment) => ({
      attachment,
      matchedIn: Array.from(matches.get(attachment.id) ?? []),
    }))
    .sort((a, b) => (a.attachment.created_at < b.attachment.created_at ? 1 : -1));
}

// --- Dashboard widget (#30) -------------------------------------------------

export async function getDocumentIntelligenceStats(supabase: DB) {
  const [{ count: total }, { count: ocrCompleted }, { count: pending }, { count: aiCompleted }] = await Promise.all([
    supabase.from("attachments").select("*", { count: "exact", head: true }),
    supabase.from("attachments").select("*", { count: "exact", head: true }).eq("ocr_status", "completed"),
    supabase.from("attachments").select("*", { count: "exact", head: true }).in("ai_status", ["pending", "processing"]),
    supabase.from("attachments").select("*", { count: "exact", head: true }).eq("ai_status", "completed"),
  ]);

  return {
    totalAttachments: total ?? 0,
    ocrCompleted: ocrCompleted ?? 0,
    pendingAnalysis: pending ?? 0,
    aiCompleted: aiCompleted ?? 0,
  };
}
