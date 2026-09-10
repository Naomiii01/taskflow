"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Paperclip, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ActivityTimeline } from "@/components/tasks/activity-timeline";
import { AddFollowupDialog } from "@/components/tasks/add-followup-dialog";
import { FollowupTimeline } from "@/components/tasks/followup-timeline";
import { OwnerAvatar, PriorityBadge, SmartFollowupIndicator, StatusBadge } from "@/components/tasks/task-badges";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { UploadDropzone } from "@/components/attachments/upload-dropzone";
import { Badge } from "@/components/ui/badge";
import { useAttachments } from "@/hooks/use-attachments";
import { useFollowups } from "@/hooks/use-followups";
import { useTaskLogs } from "@/hooks/use-task-logs";
import { useDeleteTask, useTask } from "@/hooks/use-tasks";
import {
  IMPACT_LEVEL_BADGE,
  IMPACT_LEVEL_LABELS,
  PLANNING_STATUS_BADGE,
  PLANNING_STATUS_LABELS,
  STATION_LABELS,
  WORK_CATEGORY_LABELS,
} from "@/lib/constants";
import type { FollowupWithAuthor, TaskLogWithUser } from "@/types/domain";
import type { ImpactLevel, PlanningStatus, Station, WorkCategory } from "@/types/database.types";

export function TaskDetailClient({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { data: task, isLoading } = useTask(taskId);
  const { data: followupsRes } = useFollowups(taskId);
  const { data: logs } = useTaskLogs(taskId);
  const { data: attachmentsRes } = useAttachments({ task_id: taskId, pageSize: 100 });
  const deleteTask = useDeleteTask();

  const [editOpen, setEditOpen] = React.useState(false);
  const [followupOpen, setFollowupOpen] = React.useState(false);
  const [editingFollowup, setEditingFollowup] = React.useState<FollowupWithAuthor | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">載入中…</div>;
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">找不到這個任務，可能已被刪除。</p>
        <Button variant="outline" onClick={() => router.push("/tasks")}>
          <ArrowLeft className="size-4" /> 回任務列表
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-8" asChild>
          <Link href="/tasks"><ArrowLeft className="size-4" /></Link>
        </Button>
        <span className="font-mono text-xs text-muted-foreground">{task.task_number}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">{task.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            {task.tags?.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                #{tag}
              </span>
            ))}
            {task.aircraft_type && <Badge variant="outline">{task.aircraft_type}{task.aircraft_registration ? ` ${task.aircraft_registration}` : ""}</Badge>}
            {task.station && <Badge variant="outline">{STATION_LABELS[task.station as Station]}</Badge>}
            {task.work_category && <Badge variant="outline">{WORK_CATEGORY_LABELS[task.work_category as WorkCategory]}</Badge>}
            {task.planning_status && (
              <Badge variant={PLANNING_STATUS_BADGE[task.planning_status as PlanningStatus]}>
                {PLANNING_STATUS_LABELS[task.planning_status as PlanningStatus]}
              </Badge>
            )}
            {task.impact_level && (
              <Badge variant={IMPACT_LEVEL_BADGE[task.impact_level as ImpactLevel]}>
                Impact: {IMPACT_LEVEL_LABELS[task.impact_level as ImpactLevel]}
              </Badge>
            )}
            {task.project && <Badge variant="secondary">{task.project.code}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> 編輯
          </Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" /> 刪除
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Left: task info */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>任務資訊</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="whitespace-pre-wrap text-muted-foreground">{task.description || "（無說明）"}</p>
              <dl className="grid grid-cols-2 gap-y-2 border-t pt-3">
                <dt className="text-muted-foreground">部門</dt>
                <dd>{task.department?.department_name ?? "未分配"}</dd>
                <dt className="text-muted-foreground">負責人</dt>
                <dd><OwnerAvatar name={task.owner_name ?? task.owner?.name} /></dd>
                <dt className="text-muted-foreground">到期日</dt>
                <dd>{task.due_date ?? "—"}</dd>
                <dt className="text-muted-foreground">追蹤日</dt>
                <dd>{task.followup_date ?? "—"}</dd>
                <dt className="text-muted-foreground">建立者</dt>
                <dd>{task.created_by_user?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">建立時間</dt>
                <dd>{new Date(task.created_at).toLocaleString("zh-TW")}</dd>
              </dl>
              <div className="border-t pt-3">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Smart Follow-up Indicator</p>
                <SmartFollowupIndicator state={task.smartFollowup} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-1.5"><Paperclip className="size-3.5" /> 附件</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <UploadDropzone taskId={task.id} />
              <AttachmentList attachments={attachmentsRes?.data ?? []} emptyMessage="此任務尚無附件。上傳截圖或文件後會自動進行 OCR 與 AI 分析。" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-1.5"><Sparkles className="size-3.5" /> AI 摘要</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                每個附件的 AI 摘要、重點與待辦事項可在上方「附件」點選檔案查看。跨附件的任務層級整體摘要規劃於 Phase 4 上線。
              </p>
            </CardContent>
          </Card>

          {(task.parent || (task.children?.length ?? 0) > 0) && (
            <Card>
              <CardHeader><CardTitle>Task Relationship — 衍生任務</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {task.parent && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Parent Task</p>
                    <Link href={`/tasks/${task.parent.id}`} className="text-primary hover:underline">
                      {task.parent.task_number} － {task.parent.title}
                    </Link>
                  </div>
                )}
                {(task.children?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Child Tasks（{task.children!.length}）</p>
                    <div className="flex flex-col gap-1">
                      {task.children!.map((child) => (
                        <Link key={child.id} href={`/tasks/${child.id}`} className="text-primary hover:underline">
                          {child.task_number} － {child.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: follow-ups + activity */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>追蹤與異動紀錄</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setEditingFollowup(null);
                  setFollowupOpen(true);
                }}
              >
                <Plus className="size-3.5" /> 新增追蹤紀錄
              </Button>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="followups">
                <TabsList>
                  <TabsTrigger value="followups">追蹤紀錄</TabsTrigger>
                  <TabsTrigger value="activity">異動時間軸</TabsTrigger>
                </TabsList>
                <TabsContent value="followups" className="pt-3">
                  <FollowupTimeline
                    followups={(followupsRes?.data ?? []) as FollowupWithAuthor[]}
                    onEdit={(f) => {
                      setEditingFollowup(f);
                      setFollowupOpen(true);
                    }}
                  />
                </TabsContent>
                <TabsContent value="activity" className="pt-3">
                  <ActivityTimeline logs={(logs ?? []) as unknown as TaskLogWithUser[]} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskFormDialog open={editOpen} onOpenChange={setEditOpen} task={task} />
      <AddFollowupDialog
        open={followupOpen}
        onOpenChange={(open) => {
          setFollowupOpen(open);
          if (!open) setEditingFollowup(null);
        }}
        taskId={task.id}
        defaultDepartment={task.department?.department_name}
        followup={editingFollowup}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="刪除任務"
        description="確定要刪除這個任務嗎？任務會被軟刪除，保留所有歷史紀錄。"
        confirmLabel="刪除"
        loading={deleteTask.isPending}
        onConfirm={async () => {
          await deleteTask.mutateAsync(task.id);
          setDeleteOpen(false);
          router.push("/tasks");
        }}
      />
    </div>
  );
}
