import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { OcrEntity, OcrExtractionResult } from "@/lib/services/ocr-service";

type DB = SupabaseClient<Database, "taskflow">;

export async function upsertOcrResult(supabase: DB, attachmentId: string, result: OcrExtractionResult) {
  const { data, error } = await supabase
    .from("ocr_results")
    .upsert(
      {
        attachment_id: attachmentId,
        raw_text: result.raw_text,
        confidence_score: result.confidence_score,
        language: result.language,
        processed_at: new Date().toISOString(),
      },
      { onConflict: "attachment_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function replaceOcrEntities(supabase: DB, attachmentId: string, entities: OcrEntity[]) {
  const { error: deleteError } = await supabase.from("ocr_entities").delete().eq("attachment_id", attachmentId);
  if (deleteError) throw deleteError;
  if (!entities.length) return [];

  const { data, error } = await supabase
    .from("ocr_entities")
    .insert(
      entities.map((e) => ({
        attachment_id: attachmentId,
        entity_type: e.entity_type,
        entity_value: e.entity_value,
        confidence: e.confidence,
      }))
    )
    .select("*");
  if (error) throw error;
  return data ?? [];
}

export async function findOcrResult(supabase: DB, attachmentId: string) {
  const { data, error } = await supabase.from("ocr_results").select("*").eq("attachment_id", attachmentId).maybeSingle();
  if (error) throw error;
  return data;
}
