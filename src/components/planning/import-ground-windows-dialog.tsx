"use client";

import * as React from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useImportGroundWindows, type ImportResult } from "@/hooks/use-aircraft-planning";

/**
 * 匯入班表檔案（.xlsx / .csv）成一批地面時間。欄位比對很寬鬆（機號/站別/
 * 進站/離站/備註，中英文都認），所以大部分班表檔案不用先改欄位名稱就能匯。
 */
export function ImportGroundWindowsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const importWindows = useImportGroundWindows();
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  React.useEffect(() => {
    if (open) {
      setFile(null);
      setResult(null);
    }
  }, [open]);

  const onImport = async () => {
    if (!file) return;
    const res = await importWindows.mutateAsync(file);
    setResult(res);
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>匯入班表</DialogTitle>
          <DialogDescription>
            支援 .xlsx / .csv，欄位建議包含：機號、站別、進站時間、離站時間（可選：備註）。站別留空的話會用機隊的常駐站別補上。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-file">選擇檔案</Label>
            <input
              id="import-file"
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
            />
          </div>

          {result && (
            <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
              <p>成功匯入 {result.imported} 筆。</p>
              {result.skipped.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-destructive">{result.skipped.length} 列無法匯入：</p>
                  <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-xs text-muted-foreground">
                    {result.skipped.map((s, i) => (
                      <li key={i}>第 {s.row} 列：{s.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.affectedPlanWindows.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-destructive">
                    {result.affectedPlanWindows.length} 筆已排工的地停時間有異動，請確認：
                  </p>
                  <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-xs text-muted-foreground">
                    {result.affectedPlanWindows.map((p) => (
                      <li key={p.id}>
                        {p.aircraftRegistration}／{p.station}：
                        {p.changeType === "time_changed"
                          ? `時間由 ${p.oldArrivalAt.slice(0, 16).replace("T", " ")} 改為 ${p.newArrivalAt?.slice(0, 16).replace("T", " ")}`
                          : `原班次（${p.oldArrivalAt.slice(0, 16).replace("T", " ")}）在新班表裡找不到對應班次，已標示［航線異動，請確認］`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
          <Button type="button" onClick={onImport} disabled={!file || importWindows.isPending}>
            <Upload className="size-4" /> 匯入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
