"use client";

import { AlarmClockCheck, CheckCircle2, Hourglass, ListChecks, TriangleAlert } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanningKpis } from "@/hooks/use-planning";

/** Planning KPI: 追蹤完成率/等待回覆數/超期事項/主管交辦完成率/月計畫完成率/
 * RMQ完成率/KHH完成率 (最後兩項讀取 projectCompletion 中對應代號). */
export function PlanningKpiCards() {
  const { data: kpis, isLoading } = usePlanningKpis();

  if (isLoading || !kpis) return <Skeleton className="h-20 w-full" />;

  const rmq = kpis.projectCompletion.find((p) => p.code === "RMQ");
  const khh = kpis.projectCompletion.find((p) => p.code === "KHH");

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      <StatCard label="追蹤完成率" value={kpis.trackingCompletionRate} icon={ListChecks} />
      <StatCard label="等待回覆數" value={kpis.waitingCount} icon={Hourglass} tone="warning" />
      <StatCard label="超期事項" value={kpis.overdueCount} icon={TriangleAlert} tone="critical" />
      <StatCard label="主管交辦完成率" value={kpis.supervisorCompletionRate} icon={AlarmClockCheck} />
      <StatCard label="月計畫完成率" value={kpis.monthlyPlanCompletionRate} icon={CheckCircle2} tone="success" />
      <StatCard label="RMQ完成率" value={rmq?.completionRate ?? 0} icon={CheckCircle2} />
      <StatCard label="KHH完成率" value={khh?.completionRate ?? 0} icon={CheckCircle2} />
    </div>
  );
}
