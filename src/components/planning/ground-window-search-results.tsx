"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { useSearchGroundWindows } from "@/hooks/use-aircraft-planning";
import { STATION_LABELS } from "@/lib/constants";
import type { Station } from "@/types/database.types";

const MATCH_LABELS: Record<string, string> = {
  aircraft: "機號",
  station: "站別",
  work: "工作內容",
};

function fmt(iso: string) {
  return iso.slice(0, 16).replace("T", " ");
}

/** 搜尋中心「計畫看板」分頁：不管關鍵字符合的是機號、站別，還是排入這個
 * 地停的工作內容（備註／計畫大工項目／所需技術能力／設備／授權資格），都
 * 列出來。閱覽者也看得到；沒有點擊編輯——要改內容還是要到 Aircraft
 * Planning Board 上找到對應的地停視窗。 */
export function GroundWindowSearchResults({ term }: { term: string }) {
  const { data, isFetching } = useSearchGroundWindows(term);
  const results = data?.data;

  if (!term.trim()) {
    return <p className="text-sm text-muted-foreground">輸入機號、站別，或排入地停的工作內容關鍵字以搜尋。</p>;
  }
  if (isFetching) return <p className="text-sm text-muted-foreground">搜尋中…</p>;
  if (!results?.length) return <p className="text-sm text-muted-foreground">沒有符合「{term}」的地停紀錄。</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>共 {results.length} 筆{results.length >= 50 && "（僅顯示最近 50 筆，請縮小關鍵字範圍）"}</span>
        <Link href="/aircraft-board" className="underline underline-offset-2">
          前往 Aircraft Planning Board
        </Link>
      </div>
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border border-border/70">
        {results.map((w) => (
          <div key={w.id} className="flex flex-col gap-1.5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {w.aircraftRegistration}／{STATION_LABELS[w.station as Station] ?? w.station}
              </span>
              <div className="flex flex-wrap gap-1">
                {w.matchedIn.map((m) => (
                  <Badge key={m} variant="outline" className="text-[10px]">
                    符合：{MATCH_LABELS[m] ?? m}
                  </Badge>
                ))}
                {w.needsConfirmation && (
                  <Badge variant="destructive" className="text-[10px]">
                    ⚠ 航線異動，請確認
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {fmt(w.arrivalAt)} – {fmt(w.departureAt)}
            </p>
            {(w.majorWorkPlanned || w.notes || w.requiredSkill || w.requiredEquipment || w.requiredAuthorization) && (
              <p className="text-sm text-muted-foreground">
                {[w.majorWorkPlanned, w.notes, w.requiredSkill, w.requiredEquipment, w.requiredAuthorization]
                  .filter(Boolean)
                  .join("・")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
