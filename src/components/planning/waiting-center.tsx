"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUpdateWaitingItem, useWaitingItems } from "@/hooks/use-planning";
import type { WaitingColorLevel } from "@/types/domain";

const COLOR_BADGE: Record<WaitingColorLevel, "success" | "warning" | "destructive"> = {
  green: "success",
  yellow: "warning",
  orange: "warning",
  red: "destructive",
};

const ROW_ACCENT: Record<WaitingColorLevel, string> = {
  green: "var(--status-good)",
  yellow: "var(--status-warning)",
  orange: "var(--status-serious)",
  red: "var(--status-critical)",
};

/** Waiting Center: 跨部門等待回覆（修管/LE/工程部/採購/維修部/品保/其他），
 * 已等待天數以顏色分級：3天內綠色/4-7天黃色/8-14天橘色/15天以上紅色. */
export function WaitingCenter() {
  const { data: items, isLoading } = useWaitingItems("Waiting");
  const updateItem = useUpdateWaitingItem();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Waiting Center — 跨部門等待回覆</CardTitle>
        <Badge variant="outline">{items?.length ?? 0} 件等待中</Badge>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-32 w-full" />}
        {items && items.length === 0 && <p className="text-sm text-muted-foreground">目前沒有等待回覆的事項。</p>}
        {items && items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>等待單位</TableHead>
                <TableHead>等待事項</TableHead>
                <TableHead>來源任務</TableHead>
                <TableHead>預計回覆日</TableHead>
                <TableHead>已等待天數</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-l-[3px]"
                  style={{ borderLeftColor: ROW_ACCENT[item.color] }}
                >
                  <TableCell className="whitespace-nowrap">{item.waiting_unit}</TableCell>
                  <TableCell className="max-w-64 truncate" title={item.description}>{item.description}</TableCell>
                  <TableCell className="whitespace-nowrap">{item.related_task?.task_number ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{item.expected_reply_date ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={COLOR_BADGE[item.color]}>{item.waitingDays} 天</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateItem.mutate({ id: item.id, status: "Replied" })}
                    >
                      標記已回覆
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
