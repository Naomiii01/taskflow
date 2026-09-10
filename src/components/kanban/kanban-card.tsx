"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, Eye, Flag, MoreHorizontal, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OwnerAvatar, PriorityBadge } from "@/components/tasks/task-badges";
import { useUpdateTask, type TaskRow } from "@/hooks/use-tasks";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/constants";
import { getDueUrgency, URGENCY_BORDER_CLASS, URGENCY_LABEL, URGENCY_TEXT_CLASS } from "@/lib/task-urgency";
import type { TaskPriority } from "@/types/database.types";

export function KanbanCard({ task, onEdit }: { task: TaskRow; onEdit: (task: TaskRow) => void }) {
  const router = useRouter();
  const updateTask = useUpdateTask();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : undefined }
    : undefined;

  // 看板欄位仍然是狀態分類，卡片再依到期日的緊急程度加上左側色條/文字顏色 —
  // 逾期或 3 天內到期是紅色，一週內到期是黃色，其餘（含已完成/已取消）不特別標色。
  const urgency = getDueUrgency(task.due_date, task.status);
  const urgencyLabel = URGENCY_LABEL[urgency];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`gap-2 rounded-2xl border-border/70 p-3.5 shadow-soft transition-shadow hover:shadow-soft-lg ${URGENCY_BORDER_CLASS[urgency]} ${isDragging ? "opacity-60 shadow-soft-lg" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex flex-1 cursor-grab flex-col gap-1 active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <span className="font-mono text-[10px] text-muted-foreground">{task.task_number}</span>
          <p className="text-sm font-medium leading-snug">{task.title}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6 shrink-0">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/tasks/${task.id}`)}>
              <Eye className="size-3.5" /> 開啟詳情
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Pencil className="size-3.5" /> 編輯
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1"><Flag className="size-3" /> 變更優先級</DropdownMenuLabel>
            {TASK_PRIORITIES.map((p) => (
              <DropdownMenuItem
                key={p}
                disabled={p === task.priority}
                onClick={() => updateTask.mutate({ id: task.id, values: { priority: p as TaskPriority } })}
              >
                {TASK_PRIORITY_LABELS[p]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1"><CalendarClock className="size-3" /> 到期日</DropdownMenuLabel>
            <div className="px-2 pb-1.5">
              <input
                type="date"
                defaultValue={task.due_date ?? ""}
                className="w-full rounded-lg border border-input bg-transparent px-2 py-1 text-xs outline-none"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateTask.mutate({ id: task.id, values: { due_date: e.target.value || null } })}
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center justify-between">
        <PriorityBadge priority={task.priority} />
        <span className={`text-xs ${URGENCY_TEXT_CLASS[urgency]}`}>
          {task.due_date ?? "無到期日"}
          {urgencyLabel && <> · {urgencyLabel}</>}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{task.department?.department_name ?? "未分配"}</span>
        <OwnerAvatar name={task.owner_name ?? task.owner?.name} />
      </div>
    </Card>
  );
}
