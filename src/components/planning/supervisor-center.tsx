"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupervisorTasks, useUpdateSupervisorTask } from "@/hooks/use-planning";
import { TASK_PRIORITY_LABELS } from "@/lib/constants";
import type { TaskPriority } from "@/types/database.types";

/** Supervisor Assignment Center — 主管交辦事項，獨立顯示於首頁。 */
export function SupervisorCenter() {
  const { data: tasks, isLoading } = useSupervisorTasks();
  const updateTask = useUpdateSupervisorTask();

  const openTasks = tasks?.filter((t) => t.status === "Open" || t.status === "In Progress") ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Supervisor Center — 主管交辦</CardTitle>
        <Badge variant="outline">{openTasks.length} 件待處理</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && <Skeleton className="h-32 w-full" />}
        {!isLoading && openTasks.length === 0 && <p className="text-sm text-muted-foreground">目前沒有待處理的主管交辦事項。</p>}
        {openTasks.map((task) => (
          <div key={task.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-3 text-sm transition-colors hover:bg-accent/30">
            <div className="flex-1">
              <p className="font-medium">{task.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                優先級 {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
                {task.due_date && ` · 截止 ${task.due_date}`}
                {task.assigner?.name && ` · 交辦人 ${task.assigner.name}`}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => updateTask.mutate({ id: task.id, status: "Completed" })}>
              標記完成
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
