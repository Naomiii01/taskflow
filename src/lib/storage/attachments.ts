import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { ATTACHMENT_BUCKET, ATTACHMENT_INBOX_FOLDER } from "@/lib/constants";
import type { AttachmentCategory } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

/** Sanitizes a user-supplied filename to a safe storage object key segment. */
function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-一-鿿]+/g, "_").slice(-150);
}

/** task-files/{task-id-or-inbox}/{category}/{timestamp}-{filename} */
export function buildStoragePath(taskId: string | null, category: AttachmentCategory, fileName: string) {
  const folder = taskId ?? ATTACHMENT_INBOX_FOLDER;
  return `${folder}/${category}/${Date.now()}-${sanitizeFileName(fileName)}`;
}

export async function uploadAttachmentObject(supabase: DB, path: string, bytes: Buffer, contentType: string) {
  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
}

export async function downloadAttachmentObject(supabase: DB, path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).download(path);
  if (error) throw error;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteAttachmentObject(supabase: DB, path: string) {
  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
  if (error) throw error;
}

export async function createSignedAttachmentUrl(supabase: DB, path: string, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
