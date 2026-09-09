"use client";

import * as React from "react";
import { Inbox } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/tasks/multi-select-filter";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { UploadDropzone } from "@/components/attachments/upload-dropzone";
import { useAttachments } from "@/hooks/use-attachments";
import {
  ATTACHMENT_CATEGORIES,
  ATTACHMENT_CATEGORY_LABELS,
  PROCESSING_STATUSES,
  PROCESSING_STATUS_LABELS,
} from "@/lib/constants";

/**
 * Document Intelligence Inbox: upload files without picking a task first.
 * The AI pipeline (see attachments-service.runAiAnalysis) will try to
 * auto-link each upload to an existing task; anything left unlinked shows
 * up here with a "建立新 Task" action.
 */
export function AttachmentsClient() {
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<string[]>([]);
  const [ocrStatus, setOcrStatus] = React.useState<string[]>([]);
  const [aiStatus, setAiStatus] = React.useState<string[]>([]);
  const [inboxOnly, setInboxOnly] = React.useState(true);

  const { data, isLoading } = useAttachments({
    inbox: inboxOnly ? true : undefined,
    q: q || undefined,
    category,
    ocr_status: ocrStatus,
    ai_status: aiStatus,
    pageSize: 100,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">附件與 OCR</h1>
        <p className="text-sm text-muted-foreground">
          文件智慧收件匣：上傳截圖或文件即可自動進行 OCR 辨識與 AI 分析，AI 會嘗試自動比對相關任務。
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">上傳新附件</CardTitle></CardHeader>
        <CardContent>
          <UploadDropzone taskId={null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-1.5 text-sm"><Inbox className="size-4" /> 附件列表</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="搜尋檔名…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 w-40 text-xs"
            />
            <MultiSelectFilter
              label="分類"
              options={ATTACHMENT_CATEGORIES.map((c) => ({ value: c, label: ATTACHMENT_CATEGORY_LABELS[c] }))}
              selected={category}
              onChange={setCategory}
            />
            <MultiSelectFilter
              label="OCR 狀態"
              options={PROCESSING_STATUSES.map((s) => ({ value: s, label: PROCESSING_STATUS_LABELS[s] }))}
              selected={ocrStatus}
              onChange={setOcrStatus}
            />
            <MultiSelectFilter
              label="AI 狀態"
              options={PROCESSING_STATUSES.map((s) => ({ value: s, label: PROCESSING_STATUS_LABELS[s] }))}
              selected={aiStatus}
              onChange={setAiStatus}
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={inboxOnly} onChange={(e) => setInboxOnly(e.target.checked)} />
              只顯示未連結任務
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">載入中…</p>
          ) : (
            <AttachmentList
              attachments={data?.data ?? []}
              showTaskColumn
              emptyMessage={inboxOnly ? "收件匣目前沒有未連結任務的附件。" : "尚無符合條件的附件。"}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
