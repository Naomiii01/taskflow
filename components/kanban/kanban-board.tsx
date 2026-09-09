"use client";

import * as React from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";

import { KanbanColumn } from "@/components/kanban/kanban-column";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { KANBAN_COLUMNS } from "@/lib/constants";
import { useUpdateTask, type TaskRow } from "@/hooks/use-tasks";
import type { TaskStatus } from "@/types/database.types";

export function KanbanBoard({ tasks, onEdit }: { tasks: TaskRow[]; onEdit: (task: TaskRow) => void }) {
  const updateTask = useUpdateTask();
  const [activeTask, setActiveTask] = React.useState<TaskRow | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStatus = React.useMemo(() => {
    const map = new Map<TaskStatus, TaskRow[]>();
    for (const status of KANBAN_COLUMNS) map.set(status, []);
    for (const task of tasks) {
      map.get(task.status)?.push(task);
    }
    return map;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const targetStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === targetStatus) return;

    updateTask.mutate({ id: task.id, values: { status: targetStatus } });
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((status) => (
          <KanbanColumn key={status} status={status} tasks={byStatus.get(status) ?? []} onEdit={onEdit} />
        ))}
      </div>
      <DragOverlay>{activeTask ? <KanbanCard task={activeTask} onEdit={() => {}} /> : null}</DragOverlay>
    </DndContext>
  );
}
