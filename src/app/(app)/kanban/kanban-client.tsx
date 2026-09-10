"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useTasks, type TaskRow } from "@/hooks/use-tasks";

export function KanbanClient({ showHeader = true }: { showHeader?: boolean }) {
  const { data, isLoading } = useTasks({ page: 1, pageSize: 200, sortBy: "updated_at", sortDir: "desc" });
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<TaskRow | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showHeader ? (
          <div>
            <h1 className="text-xl font-semibold">看板</h1>
            <p className="text-sm text-muted-foreground">拖曳卡片即可即時更新任務狀態，卡片色條代表到期日緊急程度。</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">拖曳卡片即可即時更新任務狀態，卡片色條代表到期日緊急程度。</p>
        )}
        <Button
          onClick={() => {
            setEditingTask(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" /> 新增任務
        </Button>
      </div>

      {isLoading && !data ? (
        <div className="py-10 text-center text-sm text-muted-foreground">載入中…</div>
      ) : (
        <KanbanBoard
          tasks={data?.data ?? []}
          onEdit={(task) => {
            setEditingTask(task);
            setFormOpen(true);
          }}
        />
      )}

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editingTask} />
    </div>
  );
}
