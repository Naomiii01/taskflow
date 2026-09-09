"use client";

import { PlanningKpiCards } from "@/components/planning/planning-kpi-cards";
import { TodayCenter } from "@/components/planning/today-center";
import { WeeklyCenter } from "@/components/planning/weekly-center";
import { PlanningTimeline } from "@/components/planning/planning-timeline";
import { ProjectsCenter } from "@/components/planning/projects-center";
import { WaitingCenter } from "@/components/planning/waiting-center";
import { SupervisorCenter } from "@/components/planning/supervisor-center";
import { AiBriefingCenter } from "@/components/planning/ai-briefing-center";

export function PlanningClient({ userName }: { userName?: string | null }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          {userName ? `${userName}，早安 — Planning Operations Center` : "Planning Operations Center"}
        </h1>
        <p className="text-sm text-muted-foreground">航空維修 Planning 每日工作總覽：發工確認、跨部門等待、主管交辦與月度規劃。</p>
      </div>

      <PlanningKpiCards />

      <AiBriefingCenter />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TodayCenter />
        <WeeklyCenter />
        <PlanningTimeline />
        <ProjectsCenter />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WaitingCenter />
        <SupervisorCenter />
      </div>
    </div>
  );
}
