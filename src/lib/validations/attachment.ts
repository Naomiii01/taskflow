import { z } from "zod";

import {
  ACCEPTED_ATTACHMENT_TYPES,
  ATTACHMENT_CATEGORIES,
  MAX_ATTACHMENT_SIZE_BYTES,
  PROCESSING_STATUSES,
  SCREEN_TYPES,
} from "@/lib/constants";

/** Metadata posted alongside the file in the multipart /api/upload request. */
export const uploadMetadataSchema = z.object({
  task_id: z.string().uuid().nullable().optional(),
  category: z.enum(ATTACHMENT_CATEGORIES as [string, ...string[]]).optional(),
});

export type UploadMetadataValues = z.infer<typeof uploadMetadataSchema>;

export function validateAttachmentFile(file: File) {
  if (!Object.keys(ACCEPTED_ATTACHMENT_TYPES).includes(file.type)) {
    return "不支援的檔案格式，僅接受 JPG / PNG / PDF / DOCX / XLSX";
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return `檔案大小超過上限（${Math.floor(MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024)}MB）`;
  }
  return null;
}

export const attachmentQuerySchema = z.object({
  task_id: z.string().uuid().optional(),
  inbox: z.coerce.boolean().optional(), // true => attachments with no task_id
  category: z.array(z.enum(ATTACHMENT_CATEGORIES as [string, ...string[]])).optional(),
  screen_type: z.array(z.enum(SCREEN_TYPES as [string, ...string[]])).optional(),
  ocr_status: z.array(z.enum(PROCESSING_STATUSES as [string, ...string[]])).optional(),
  ai_status: z.array(z.enum(PROCESSING_STATUSES as [string, ...string[]])).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type AttachmentQuery = z.infer<typeof attachmentQuerySchema>;

export const ocrTriggerSchema = z.object({
  attachment_id: z.string().uuid(),
});

export const aiAnalysisTriggerSchema = z.object({
  attachment_id: z.string().uuid(),
});

export const linkTaskSchema = z.object({
  attachment_id: z.string().uuid(),
  task_id: z.string().uuid(),
});

export const documentSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "請輸入搜尋關鍵字"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
