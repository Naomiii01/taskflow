"use client";

import { AlarmClockCheck, CheckCircle2, Hourglass, ListChecks, TriangleAlert } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanningKpis } from "@/hooks/use-planning";

/** Planning KPI: 追蹤完成率/等待回覆數/超期事項/主管交辦完成率/RMQ完成率/
 * KHH完成率。RMQ/KHH 兩項是直接算任務「站別」欄位的完成率（見
 * planning-kpi-service.ts 的 stationCompletionRate）。月計畫完成率依需求
 * 先移除，任務表單目前沒有「規劃月份」欄位可填，之後有需要再加回來。 */
export function PlanningKpiCards() {
  const { data: kpis, isLoading } = usePlanningKpis();

  if (isLoading || !kpis) return <Skeleton className="h-20 w-full" />;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard label="追蹤完成率" value={kpis.trackingCompletionRate} icon={ListChecks} />
      <StatCard label="等待回覆數" value={kpis.waitingCount} icon={Hourglass} tone="warning" />
      <StatCard label="超期事項" value={kpis.overdueCount} icon={TriangleAlert} tone="critical" />
      <StatCard label="主管交辦完成率" value={kpis.supervisorCompletionRate} icon={AlarmClockCheck} />
      <StatCard label="RMQ完成率" value={kpis.rmqCompletionRate} icon={CheckCircle2} />
      <StatCard label="KHH完成率" value={kpis.khhCompletionRate} icon={CheckCircle2} />
    </div>
  );
}
