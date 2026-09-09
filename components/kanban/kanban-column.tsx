"use client";

import { useDroppable } from "@dnd-kit/core";

import { KanbanCard } from "@/components/kanban/kanban-card";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import type { TaskRow } from "@/hooks/use-tasks";
import type { TaskStatus } from "@/types/database.types";
import { cn } from "@/lib/utils";

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  Todo: "bg-muted-foreground/60",
  "In Progress": "bg-primary",
  "Waiting Response": "bg-warning",
  "Pending Approval": "bg-warning",
  Completed: "bg-success",
  Cancelled: "bg-muted-foreground/30",
};

export function KanbanColumn({
  status,
  tasks,
  onEdit,
}: {
  status: TaskStatus;
  tasks: TaskRow[];
  onEdit: (task: TaskRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-2 transition-colors",
        isOver && "border-primary bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2 px-1 pt-1">
        <span className={cn("size-2 rounded-full", COLUMN_ACCENT[status])} />
        <h3 className="text-sm font-medium">{TASK_STATUS_LABELS[status]}</h3>
        <span className="ml-auto rounded-full bg-background px-1.5 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="flex min-h-16 flex-col gap-2">
        {tasks.map((task) => (
          <KanbanCard key={task.id} task={task} onEdit={onEdit} />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
            拖曳卡片到這裡
          </div>
        )}
      </div>
    </div>
  );
}
