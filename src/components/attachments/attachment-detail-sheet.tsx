"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Download, ExternalLink, Link2, ListChecks, RefreshCw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { CategoryBadge, FileTypeIcon, ProcessingStatusBadge, ScreenTypeBadge } from "@/components/attachments/attachment-badges";
import { OCR_ENTITY_TYPE_LABELS } from "@/lib/constants";
import {
  fetchAttachmentSignedUrl,
  useAttachment,
  useLinkAttachmentToTask,
  useRetryAiAnalysis,
  useRetryOcr,
} from "@/hooks/use-attachments";
import { useTasks } from "@/hooks/use-tasks";
import type { AttachmentWithRelations } from "@/types/domain";
import type { TaskRow } from "@/hooks/use-tasks";

export function AttachmentDetailSheet({
  attachmentId,
  onOpenChange,
}: {
  attachmentId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: attachment } = useAttachment(attachmentId ?? undefined);
  const retryOcr = useRetryOcr();
  const retryAi = useRetryAiAnalysis();
  const linkTask = useLinkAttachmentToTask();
  const [createTaskOpen, setCreateTaskOpen] = React.useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = React.useState(false);

  return (
    <Sheet open={!!attachmentId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {attachment ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <FileTypeIcon fileType={attachment.file_type} />
                <span className="truncate">{attachment.file_name}</span>
              </SheetTitle>
              <SheetDescription>
                {attachment.task ? (
                  <Link href={`/tasks/${attachment.task.id}`} className="underline underline-offset-2">
                    {attachment.task.task_number} · {attachment.task.title}
                  </Link>
                ) : (
                  "收件匣（尚未連結任務）"
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <CategoryBadge category={attachment.category} />
                <ScreenTypeBadge screenType={attachment.screen_type} />
                <ProcessingStatusBadge label="OCR" status={attachment.ocr_status} />
                <ProcessingStatusBadge label="AI" status={attachment.ai_status} />
              </div>

              {attachment.error_message && (
                <div className="flex items-start gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{attachment.error_message}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const url = await fetchAttachmentSignedUrl(attachment.id);
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <Download className="size-3.5" /> 下載 / 預覽
                </Button>
                {attachment.ocr_status === "failed" && (
                  <Button size="sm" variant="outline" disabled={retryOcr.isPending} onClick={() => retryOcr.mutate(attachment.id)}>
                    <RefreshCw className="size-3.5" /> 重新辨識 OCR
                  </Button>
                )}
                {attachment.ai_status === "failed" && attachment.ocr_status === "completed" && (
                  <Button size="sm" variant="outline" disabled={retryAi.isPending} onClick={() => retryAi.mutate(attachment.id)}>
                    <RefreshCw className="size-3.5" /> 重新分析 AI
                  </Button>
                )}
                {!attachment.task_id && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setLinkPickerOpen((v) => !v)}>
                      <Link2 className="size-3.5" /> 連結現有任務
                    </Button>
                    <Button size="sm" onClick={() => setCreateTaskOpen(true)}>
                      建立新 Task
                    </Button>
                  </>
                )}
              </div>

              {linkPickerOpen && !attachment.task_id && (
                <TaskPicker
                  onPick={(taskId) => {
                    linkTask.mutate({ attachmentId: attachment.id, taskId });
                    setLinkPickerOpen(false);
                  }}
                />
              )}

              {attachment.matched_task && !attachment.task_id && (
                <p className="text-xs text-muted-foreground">
                  AI 建議可能相關的任務：
                  <Link href={`/tasks/${attachment.matched_task.id}`} className="underline underline-offset-2">
                    {attachment.matched_task.task_number} · {attachment.matched_task.title}
                  </Link>
                </p>
              )}

              <Separator />

              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-medium"><Sparkles className="size-3.5" /> AI 摘要</h3>
                {attachment.ai_summary ? (
                  <div className="flex flex-col gap-2 text-sm">
                    <p className="text-muted-foreground">{attachment.ai_summary.summary || "（無摘要）"}</p>
                    <EntityLikeList title="重點" items={asStringArray(attachment.ai_summary.key_points)} />
                    <EntityLikeList title="待辦事項" items={asStringArray(attachment.ai_summary.action_items)} />
                    <EntityLikeList title="風險項目" items={asStringArray(attachment.ai_summary.risk_items)} tone="destructive" />
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {attachment.ai_summary.suggested_followup_date && (
                        <span>建議追蹤日期：{attachment.ai_summary.suggested_followup_date}</span>
                      )}
                      {asStringArray(attachment.ai_summary.departments).length > 0 && (
                        <span>相關部門：{asStringArray(attachment.ai_summary.departments).join("、")}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {attachment.ai_status === "failed" ? "AI 分析失敗，請重試。" : "尚無 AI 摘要。"}
                  </p>
                )}
              </section>

              <TypeSpecificSection attachment={attachment} />

              <Separator />

              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-medium"><ListChecks className="size-3.5" /> 擷取實體</h3>
                {attachment.ocr_entities?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {attachment.ocr_entities.map((e) => (
                      <Badge key={e.id} variant="outline" className="gap-1">
                        {OCR_ENTITY_TYPE_LABELS[e.entity_type]}：{e.entity_value}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">尚無擷取到的實體資訊。</p>
                )}
              </section>

              <Separator />

              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">OCR 原始文字</h3>
                {attachment.ocr_result?.raw_text ? (
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">
                    {attachment.ocr_result.raw_text}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {attachment.ocr_status === "failed" ? "OCR 辨識失敗，請重試。" : "尚無 OCR 結果。"}
                  </p>
                )}
                {attachment.ocr_result && (
                  <p className="text-xs text-muted-foreground">
                    語言：{attachment.ocr_result.language ?? "—"} · 信心分數：{attachment.ocr_result.confidence_score ?? "—"}
                  </p>
                )}
              </section>
            </div>

            <TaskFormDialog
              open={createTaskOpen}
              onOpenChange={setCreateTaskOpen}
              initialTitle={attachment.file_name}
              onCreated={(task) => linkTask.mutate({ attachmentId: attachment.id, taskId: task.id })}
            />
          </>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">載入中…</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function EntityLikeList({ title, items, tone }: { title: string; items: string[]; tone?: "destructive" }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={`text-xs font-medium ${tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`}>{title}</p>
      <ul className="list-inside list-disc text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function TypeSpecificSection({ attachment }: { attachment: AttachmentWithRelations }) {
  if (attachment.screen_type === "Email" && attachment.email_metadata) {
    const e = attachment.email_metadata;
    return (
      <section className="flex flex-col gap-1 text-sm">
        <h3 className="text-sm font-medium">郵件資訊</h3>
        <p>寄件者：{e.sender || "—"}</p>
        <p>收件者：{e.recipient || "—"}</p>
        <p>主旨：{e.subject || "—"}</p>
        <p>時間：{e.sent_at || "—"}</p>
      </section>
    );
  }
  if (attachment.screen_type === "Teams" && attachment.teams_messages?.length) {
    return (
      <section className="flex flex-col gap-1 text-sm">
        <h3 className="text-sm font-medium">Teams 對話</h3>
        {attachment.teams_messages.map((m) => (
          <p key={m.id} className="text-muted-foreground">
            <span className="font-medium text-foreground">{m.speaker || "—"}</span>
            {m.message_time ? ` (${m.message_time})` : ""}：{m.content}
          </p>
        ))}
      </section>
    );
  }
  if (attachment.screen_type === "LINE" && attachment.line_messages?.length) {
    return (
      <section className="flex flex-col gap-1 text-sm">
        <h3 className="text-sm font-medium">LINE 對話（{attachment.line_messages[0]?.group_name || "群組"}）</h3>
        {attachment.line_messages.map((m) => (
          <p key={m.id} className="text-muted-foreground">
            <span className="font-medium text-foreground">{m.speaker || "—"}</span>
            {m.message_time ? ` (${m.message_time})` : ""}：{m.message}
          </p>
        ))}
      </section>
    );
  }
  if (attachment.screen_type === "SAP" && attachment.sap_extraction) {
    const s = attachment.sap_extraction;
    return (
      <section className="flex flex-col gap-1 text-sm">
        <h3 className="text-sm font-medium">SAP 擷取資訊</h3>
        <p>工單號碼：{s.work_order_number || "—"}</p>
        <p>料號：{s.part_number || "—"}</p>
        <p>機號：{s.aircraft_registration || "—"}</p>
        <p>工卡資訊：{s.work_card_info || "—"}</p>
        <p>狀態：{s.status_info || "—"}</p>
      </section>
    );
  }
  return null;
}

function TaskPicker({ onPick }: { onPick: (taskId: string) => void }) {
  const { data } = useTasks({ page: 1, pageSize: 50, sortBy: "updated_at", sortDir: "desc" });
  const [value, setValue] = React.useState<string>("");
  const tasks = (data?.data ?? []) as TaskRow[];

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-full"><SelectValue placeholder="選擇任務" /></SelectTrigger>
        <SelectContent>
          {tasks.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.task_number} · {t.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" disabled={!value} onClick={() => value && onPick(value)}>
        <ExternalLink className="size-3.5" /> 連結
      </Button>
    </div>
  );
}
