"use client";

import { CalendarClock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDailyBriefing } from "@/hooks/use-planning";
import { cn } from "@/lib/utils";

/** Monthly Center / Planning Timeline: 每月重要節點 — 1日短天期整理/額外工單整理、
 * 15日修管月計畫整理、20日長工時/人力/工期安排完成期限. */
export function PlanningTimeline() {
  const { data: briefing, isLoading } = useDailyBriefing();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="size-4" /> Monthly Center — Planning Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-20 w-full" />}
        {briefing && (
          <ol className="flex flex-col gap-2">
            {briefing.thisMonthMilestones.map((m) => (
              <li
                key={m.day}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border/70 p-3 text-sm transition-colors",
                  m.isToday && "border-primary/40 bg-primary/8 shadow-soft"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    m.isToday ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {m.day}日
                </span>
                <span className="flex-1">{m.label}</span>
                {m.isToday && <Badge>今天</Badge>}
                {m.isPast && !m.isToday && <Badge variant="outline">已過期限</Badge>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
