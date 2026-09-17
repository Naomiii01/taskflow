"use client";

import { History } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecentGroundWindowChanges } from "@/hooks/use-aircraft-planning";
import { STATION_LABELS } from "@/lib/constants";
import type { Station } from "@/types/database.types";

function fmt(iso: string) {
  return iso.slice(0, 16).replace("T", " ");
}

/**
 * 全機隊最近的地停異動紀錄——重新匯入班表時，已排工的地停時間被改動
 * （時間異動）或找不到對應新班次（航線異動）都會留下一筆，方便定期查核，
 * 避免計畫內容因為班表重新匯入而悄悄變動卻沒人知道。
 */
export function GroundWindowChangeLogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: entries, isLoading } = useRecentGroundWindowChanges(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" /> 地停異動紀錄
          </DialogTitle>
          <DialogDescription>
            重新匯入班表時，已排計畫工作的地停如果時間被改動、或找不到對應的新班次，都會記錄在這裡（最近 200 筆）。
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !entries || entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">目前沒有任何異動紀錄</p>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((e) => (
              <div key={e.id} className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {e.aircraftRegistration}／{STATION_LABELS[e.station as Station] ?? e.station}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmt(e.createdAt)}・{e.changedBy?.name || e.changedBy?.email || "不明使用者"} 匯入時異動
                  </span>
                </div>
                {e.changeType === "time_changed" ? (
                  <p className="mt-1 text-muted-foreground">
                    時間由 <span className="text-foreground">{fmt(e.oldArrivalAt)}–{fmt(e.oldDepartureAt)}</span> 改為{" "}
                    <span className="text-foreground">{fmt(e.newArrivalAt!)}–{fmt(e.newDepartureAt!)}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-destructive">
                    原班次（{fmt(e.oldArrivalAt)}–{fmt(e.oldDepartureAt)}）在新班表裡找不到對應班次，已標示［航線異動，請確認］
                  </p>
                )}
                {(e.planSnapshot.majorWorkPlanned || e.planSnapshot.shift || e.planSnapshot.estimatedMh != null) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    當時的計畫：
                    {[e.planSnapshot.majorWorkPlanned, e.planSnapshot.shift, e.planSnapshot.estimatedMh != null ? `${e.planSnapshot.estimatedMh}MH` : null]
                      .filter(Boolean)
                      .join("・")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
