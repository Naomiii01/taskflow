"use client";

import { Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDailyBriefing } from "@/hooks/use-planning";

/** AI Briefing Center — Daily AI Briefing (08:00): 昨日發工確認結果/退工統計/
 * 新增工單統計/待追蹤事項/等待回覆事項/主管交辦事項/本週重點工作/本月重要節點/
 * 超期事項/AI風險提醒，濃縮成一段 AI 摘要文字，並附上關鍵數字。 */
export function AiBriefingCenter() {
  const { data: briefing, isLoading } = useDailyBriefing();

  return (
    <Card className="border-primary/15 bg-gradient-to-br from-primary/6 via-card to-card shadow-soft-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> AI Briefing Center — 每日簡報（{briefing?.date})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {briefing && (
          <>
            <p className="text-sm leading-relaxed">{briefing.narrative}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-4">
              <span>退工件數：{briefing.returnedWorkCount}</span>
              <span>新增工單：{briefing.newWorkOrderCount}</span>
              <span>等待回覆：{briefing.waitingCount}</span>
              <span>主管交辦待處理：{briefing.supervisorOpenCount}</span>
              <span>超期事項：{briefing.overdueCount}</span>
              <span>檢查清單完成度：{briefing.checklistCompletionRate}%</span>
            </div>
            {briefing.thisWeekHighlights.length > 0 && (
              <div className="border-t border-border/70 pt-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">本週重點工作</p>
                <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {briefing.thisWeekHighlights.map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
