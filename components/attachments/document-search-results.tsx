"use client";

import * as React from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { FileTypeIcon } from "@/components/attachments/attachment-badges";
import { AttachmentDetailSheet } from "@/components/attachments/attachment-detail-sheet";
import { useDocumentSearch } from "@/hooks/use-attachments";

const MATCH_LABELS: Record<string, string> = {
  file_name: "檔名",
  ocr_text: "OCR 內容",
  ai_summary: "AI 摘要",
  email: "郵件內容",
  teams: "Teams 內容",
  line: "LINE 內容",
};

/** Document Search: full-text search across OCR text, AI summaries, filenames, Email/Teams/LINE content. */
export function DocumentSearchResults({ term }: { term: string }) {
  const { data, isFetching } = useDocumentSearch(term);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  if (!term.trim()) {
    return <p className="text-sm text-muted-foreground">輸入關鍵字以搜尋附件檔名、OCR 內容、AI 摘要與郵件/對話內容。</p>;
  }
  if (isFetching) return <p className="text-sm text-muted-foreground">搜尋中…</p>;
  if (!data?.data.length) return <p className="text-sm text-muted-foreground">沒有符合「{term}」的文件。</p>;

  return (
    <>
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border border-border/70">
        {data.data.map(({ attachment, matchedIn }) => (
          <button
            key={attachment.id}
            type="button"
            onClick={() => setSelectedId(attachment.id)}
            className="flex flex-wrap items-center justify-between gap-2 p-3 text-left hover:bg-muted/50"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileTypeIcon fileType={attachment.file_type} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {attachment.task ? (
                    <Link href={`/tasks/${attachment.task.id}`} className="underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
                      {attachment.task.task_number}
                    </Link>
                  ) : (
                    "收件匣"
                  )}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1">
              {matchedIn.map((m) => (
                <Badge key={m} variant="outline" className="text-[10px]">
                  符合：{MATCH_LABELS[m] ?? m}
                </Badge>
              ))}
            </div>
          </button>
        ))}
      </div>
      <AttachmentDetailSheet attachmentId={selectedId} onOpenChange={(open) => !open && setSelectedId(null)} />
    </>
  );
}
