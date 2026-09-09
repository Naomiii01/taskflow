"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTodayChecklist, useUpdateChecklistItem } from "@/hooks/use-planning";

/** Today Center: 每日檢查清單 — 昨日發工完成確認/退工確認/新增工單需求確認/
 * 修管需求確認/LE需求確認/工程部需求確認/採購需求確認/主管交辦追蹤. */
export function TodayCenter() {
  const { data: checklist, isLoading } = useTodayChecklist();
  const updateItem = useUpdateChecklistItem();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Today Center — 每日檢查清單</CardTitle>
        {checklist && (
          <Badge variant={checklist.completionRate === 100 ? "success" : "outline"}>
            完成度 {checklist.completionRate}%
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && <Skeleton className="h-40 w-full" />}
        {checklist?.items.map((item) => (
          <label
            key={item.id}
            className="flex items-start gap-3 rounded-xl border border-border/70 p-3 text-sm transition-colors hover:bg-accent/30"
          >
            <Checkbox
              checked={item.is_completed}
              onCheckedChange={(checked) => updateItem.mutate({ id: item.id, is_completed: checked === true })}
              className="mt-0.5"
            />
            <span className="flex-1">
              <span className={item.is_completed ? "text-muted-foreground line-through" : ""}>{item.item_label}</span>
              {item.completed_by_user && (
                <span className="ml-2 text-xs text-muted-foreground">
                  由 {item.completed_by_user.name ?? item.completed_by_user.email} 確認
                </span>
              )}
            </span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
