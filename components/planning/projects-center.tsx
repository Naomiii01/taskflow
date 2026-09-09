"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectSummaries } from "@/hooks/use-planning";

/** Project Center: 預設專案 RMQ/KHH/其他專案 — 任務數/完成率/待追蹤/超期/風險指數/里程碑. */
export function ProjectsCenter() {
  const { data: projects, isLoading } = useProjectSummaries();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Projects Center — 專案中心</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {isLoading && <Skeleton className="col-span-3 h-32 w-full" />}
        {projects?.map((project) => (
          <div
            key={project.id}
            className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-soft transition-shadow hover:shadow-soft-lg"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{project.code}</span>
              <Badge variant={project.riskIndex >= 50 ? "destructive" : project.riskIndex >= 25 ? "warning" : "outline"}>
                風險 {project.riskIndex}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{project.name}</p>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <span>任務數：{project.taskCount}</span>
              <span>完成率：{project.completionRate}%</span>
              <span>待追蹤：{project.waiting}</span>
              <span>超期：{project.overdue}</span>
            </div>
            {project.milestones.length > 0 && (
              <div className="mt-1 flex flex-col gap-1.5 border-t border-border/70 pt-2 text-xs">
                {project.milestones.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <span className={m.is_completed ? "text-muted-foreground line-through" : ""}>{m.title}</span>
                    <span className="text-muted-foreground">{m.target_date ?? ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
