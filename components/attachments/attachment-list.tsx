"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CategoryBadge, FileTypeIcon, ProcessingStatusBadge, ScreenTypeBadge } from "@/components/attachments/attachment-badges";
import { AttachmentDetailSheet } from "@/components/attachments/attachment-detail-sheet";
import { useDeleteAttachment } from "@/hooks/use-attachments";
import type { AttachmentWithRelations } from "@/types/domain";

/** List of attachments with quick-status badges; click a row to open the detail panel. */
export function AttachmentList({
  attachments,
  emptyMessage = "尚無附件",
  showTaskColumn = false,
}: {
  attachments: AttachmentWithRelations[];
  emptyMessage?: string;
  showTaskColumn?: boolean;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AttachmentWithRelations | null>(null);
  const deleteAttachment = useDeleteAttachment();

  if (!attachments.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border border-border/70">
        {attachments.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelectedId(a.id)}
            className="flex flex-wrap items-center justify-between gap-2 p-3 text-left hover:bg-muted/50"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileTypeIcon fileType={a.file_type} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {showTaskColumn && (a.task ? `${a.task.task_number} · ` : "收件匣 · ")}
                  {new Date(a.created_at).toLocaleString("zh-TW")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <CategoryBadge category={a.category} />
              <ScreenTypeBadge screenType={a.screen_type} />
              <ProcessingStatusBadge label="OCR" status={a.ocr_status} />
              <ProcessingStatusBadge label="AI" status={a.ai_status} />
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(a);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </button>
        ))}
      </div>

      <AttachmentDetailSheet attachmentId={selectedId} onOpenChange={(open) => !open && setSelectedId(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="刪除附件"
        description={`確定要刪除「${deleteTarget?.file_name}」嗎？此操作無法復原。`}
        confirmLabel="刪除"
        loading={deleteAttachment.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteAttachment.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
