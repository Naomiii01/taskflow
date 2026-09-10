import type { Metadata } from "next";
import {
  AlarmClockCheck,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClockArrowUp,
  Hourglass,
  ListTodo,
  Paperclip,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { CompletionDonut } from "@/components/dashboard/completion-donut";
import { DepartmentBarChart } from "@/components/dashboard/department-bar";
import { TrendLineChart } from "@/components/dashboard/trend-line";
import { MonthlyBarChart } from "@/components/dashboard/monthly-bar";
import { DepartmentDelayTable } from "@/components/dashboard/department-delay-table";
import { AiAssistantWidget } from "@/components/dashboard/ai-assistant-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCompletionRate,
  getDashboardStats,
  getDepartmentWorkload,
  getDocumentIntelligenceStats,
  getMonthlyCompleted,
  getNotificationWidgetStats,
  getResponseResolutionStats,
  getTopDelayDepartments,
  getWeeklyTrend,
} from "@/lib/dashboard-queries";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "儀表板" };
export const revalidate = 0;

export default async function DashboardPage() {
  const [
    user,
    stats,
    departmentWorkload,
    completionRate,
    monthlyCompleted,
    weeklyTrend,
    documentStats,
    notificationStats,
    responseResolutionStats,
    topDelayDepartments,
  ] = await Promise.all([
    getCurrentUser(),
    getDashboardStats(),
    getDepartmentWorkload(),
    getCompletionRate(),
    getMonthlyCompleted(),
    getWeeklyTrend(),
    getDocumentIntelligenceStats(),
    getNotificationWidgetStats(),
    getResponseResolutionStats(),
    getTopDelayDepartments(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          {user?.name ? `${user.name}，早安` : "儀表板"}
        </h1>
        <p className="text-sm text-muted-foreground">今天是團隊工作追蹤的即時總覽。</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <StatCard label="今日待辦" value={stats.dueToday} icon={ListTodo} />
        <StatCard label="本週待辦" value={stats.dueThisWeek} icon={CalendarClock} />
        <StatCard label="追蹤中事項" value={stats.tracking} icon={Hourglass} />
        <StatCard label="等待回覆事項" value={stats.waitingResponse} icon={AlarmClockCheck} tone="warning" />
        <StatCard label="已完成事項" value={stats.completed} icon={CheckCircle2} tone="success" />
        <StatCard label="超期事項" value={stats.overdue} icon={TriangleAlert} tone="critical" />
        <StatCard label="平均回覆天數" value={responseResolutionStats.avgResponseDays ?? 0} icon={ClockArrowUp} />
        <StatCard label="平均結案天數" value={responseResolutionStats.avgResolutionDays ?? 0} icon={TrendingUp} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">通知提醒總覽</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="今日提醒" value={notificationStats.todayReminders} icon={Bell} />
          <StatCard label="超期數" value={notificationStats.overdueCount} icon={TriangleAlert} tone="critical" />
          <StatCard label="待追蹤數" value={notificationStats.needsFollowupCount} icon={Hourglass} tone="warning" />
          <StatCard label="附件數量" value={documentStats.totalAttachments} icon={Paperclip} />
        </div>
      </div>

      <AiAssistantWidget />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="任務完成率" description="不含已取消任務">
          <CompletionDonut data={completionRate} />
        </ChartCard>
        <ChartCard title="部門工作量" description="各部門目前進行中的任務數">
          <DepartmentBarChart data={departmentWorkload} />
        </ChartCard>
        <ChartCard title="任務趨勢分析" description="近 8 週新建 vs. 完成任務數">
          <TrendLineChart data={weeklyTrend} />
        </ChartCard>
        <ChartCard title="每月完成數量" description="近 6 個月完成任務數">
          <MonthlyBarChart data={monthlyCompleted} />
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">部門延遲排行（Top Delay Departments）</CardTitle>
        </CardHeader>
        <CardContent>
          <DepartmentDelayTable departments={topDelayDepartments} />
        </CardContent>
      </Card>
    </div>
  );
}
