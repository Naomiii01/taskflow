"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TaskFiltersBar } from "@/components/tasks/task-filters-bar";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskTable } from "@/components/tasks/task-table";
import { useDeleteTask, useTasks, type TaskFilters, type TaskRow } from "@/hooks/use-tasks";

export function TasksClient() {
  const [filters, setFilters] = React.useState<TaskFilters>({
    sortBy: "updated_at",
    sortDir: "desc",
    page: 1,
    pageSize: 20,
  });
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<TaskRow | null>(null);
  const [deletingTask, setDeletingTask] = React.useState<TaskRow | null>(null);

  const { data, isLoading } = useTasks(filters);
  const deleteTask = useDeleteTask();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">任務列表</h1>
          <p className="text-sm text-muted-foreground">跨部門任務追蹤，共 {data?.total ?? 0} 筆任務。</p>
        </div>
        <Button
          onClick={() => {
            setEditingTask(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" /> 新增任務
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <TaskFiltersBar filters={filters} onChange={setFilters} />
          {isLoading && !data ? (
            <div className="py-10 text-center text-sm text-muted-foreground">載入中…</div>
          ) : (
            <TaskTable
              tasks={data?.data ?? []}
              total={data?.total ?? 0}
              filters={filters}
              onFiltersChange={setFilters}
              onEdit={(task) => {
                setEditingTask(task);
                setFormOpen(true);
              }}
              onDelete={(task) => setDeletingTask(task)}
            />
          )}
        </CardContent>
      </Card>

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editingTask} />

      <ConfirmDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        title="刪除任務"
        description={`確定要刪除「${deletingTask?.title}」嗎？任務會被軟刪除（保留紀錄，可由管理員還原），不會真正從資料庫移除。`}
        confirmLabel="刪除"
        loading={deleteTask.isPending}
        onConfirm={async () => {
          if (!deletingTask) return;
          await deleteTask.mutateAsync(deletingTask.id);
          setDeletingTask(null);
        }}
      />
    </div>
  );
}
