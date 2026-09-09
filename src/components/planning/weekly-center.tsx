"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDailyBriefing, usePlanningAnalytics } from "@/hooks/use-planning";

/** Weekly Center: 本週重點工作（7 天內到期且尚未完成的任務）+ 工作類別總覽. */
export function WeeklyCenter() {
  const { data: briefing, isLoading: briefingLoading } = useDailyBriefing();
  const { data: analytics, isLoading: analyticsLoading } = usePlanningAnalytics();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Weekly Center — 本週重點工作</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {briefingLoading && <Skeleton className="h-20 w-full" />}
        {briefing && briefing.thisWeekHighlights.length === 0 && (
          <p className="text-sm text-muted-foreground">未來 7 天內沒有到期且尚未完成的任務。</p>
        )}
        {briefing && briefing.thisWeekHighlights.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-sm">
            {briefing.thisWeekHighlights.map((h) => (
              <li key={h} className="rounded-xl border border-border/70 px-3 py-2">{h}</li>
            ))}
          </ul>
        )}

        <div className="border-t border-border/70 pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">工作類別總覽（全部任務）</p>
          {analyticsLoading && <Skeleton className="h-8 w-full" />}
          {analytics && (
            <div className="flex flex-wrap gap-1.5">
              {analytics.byWorkCategory
                .filter((c) => c.count > 0)
                .map((c) => (
                  <Badge key={c.label} variant="outline">{c.label}：{c.count}</Badge>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
