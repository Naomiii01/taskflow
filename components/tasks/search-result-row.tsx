"use client";

import { useRouter } from "next/navigation";

import { OwnerAvatar, PriorityBadge, StatusBadge } from "@/components/tasks/task-badges";
import type { TaskWithRelations } from "@/types/domain";

export function SearchResultRow({ task }: { task: TaskWithRelations }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/tasks/${task.id}`)}
      className="flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left hover:bg-accent"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{task.task_number}</span>
        <span className="font-medium">{task.title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={task.status} />
        <span>{task.department?.department_name ?? "未分配"}</span>
        <OwnerAvatar name={task.owner?.name} />
      </div>
      {task.description && <p className="line-clamp-1 text-sm text-muted-foreground">{task.description}</p>}
    </button>
  );
}
