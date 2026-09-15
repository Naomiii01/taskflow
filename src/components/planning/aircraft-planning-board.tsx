"use client";

import * as React from "react";
import { addDays, eachDayOfInterval, isToday as isDateToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddGroundWindowDialog, type AircraftOption } from "@/components/planning/add-ground-window-dialog";
import { ImportGroundWindowsDialog } from "@/components/planning/import-ground-windows-dialog";
import { useAircraftPlanningBoard, type PlanningBoardAircraft, type PlanningBoardWindow } from "@/hooks/use-aircraft-planning";
import { toIso, WEEKDAY_LABELS } from "@/lib/calendar-date-utils";
import { AIRCRAFT_TYPES, STATION_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const RANGE_DAYS = 14;
const ALL = "__all__";

function hhmm(iso: string) {
  return iso.slice(11, 16);
}

type Segment = "same" | "arrival" | "through" | "departure";

function segmentFor(w: PlanningBoardWindow, dayIso: string): Segment {
  const arrivalDay = w.arrivalAt.slice(0, 10);
  const departureDay = w.departureAt.slice(0, 10);
  if (arrivalDay === departureDay) return "same";
  if (dayIso === arrivalDay) return "arrival";
  if (dayIso === departureDay) return "departure";
  return "through";
}

function segmentLabel(w: PlanningBoardWindow, segment: Segment) {
  const station = STATION_LABELS[w.station as keyof typeof STATION_LABELS] ?? w.station;
  if (segment === "same") return `${station} ${hhmm(w.arrivalAt)}–${hhmm(w.departureAt)}`;
  if (segment === "arrival") return `${station} ${hhmm(w.arrivalAt)}起 過夜`;
  if (segment === "departure") return `過夜 至${hhmm(w.departureAt)}`;
  return "過夜中";
}

type EditTarget =
  | { mode: "create"; aircraftRegistration: string; station: string; dateIso: string }
  | { mode: "edit"; aircraftRegistration: string; window: PlanningBoardWindow };

/**
 * Aircraft Planning Board Lite — 直軸機號、橫軸日期的格狀表，是 Phase 6.6
 * 之後的主畫面。每一格顯示那架飛機那一天在場站的地面時間，橫跨過夜的窗口會
 * 用強調色標示（Overnight Opportunity），這是航機可用性排程真正要看的東西，
 * 而不是待辦事項清單。資料來自 aircraft_ground_windows（手動登記或匯入班表）。
 */
export function AircraftPlanningBoard() {
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [aircraftTypeFilter, setAircraftTypeFilter] = React.useState<string | undefined>(undefined);
  const [editTarget, setEditTarget] = React.useState<EditTarget | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);

  const days = React.useMemo(() => eachDayOfInterval({ start: anchor, end: addDays(anchor, RANGE_DAYS - 1) }), [anchor]);
  const dayIsos = React.useMemo(() => days.map(toIso), [days]);
  const startIso = dayIsos[0];
  const endExclusiveIso = toIso(addDays(days[days.length - 1], 1));

  const { data: board, isLoading } = useAircraftPlanningBoard(startIso, endExclusiveIso);

  const aircraft = React.useMemo(() => {
    const list = board?.aircraft ?? [];
    return aircraftTypeFilter ? list.filter((a) => a.aircraftType === aircraftTypeFilter) : list;
  }, [board, aircraftTypeFilter]);

  const aircraftOptions: AircraftOption[] = React.useMemo(
    () => (board?.aircraft ?? []).map((a) => ({ registration: a.aircraftRegistration, aircraftType: a.aircraftType, homeStation: a.homeStation })),
    [board]
  );

  const periodLabel = `${startIso.slice(5)} ～ ${dayIsos[dayIsos.length - 1].slice(5)}`;

  const openCreateFor = (a: PlanningBoardAircraft, dayIso: string) => {
    setEditTarget({ mode: "create", aircraftRegistration: a.aircraftRegistration, station: a.homeStation, dateIso: dayIso });
  };
  const openEditFor = (a: PlanningBoardAircraft, w: PlanningBoardWindow) => {
    setEditTarget({ mode: "edit", aircraftRegistration: a.aircraftRegistration, window: w });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Aircraft Planning Board</h1>
          <p className="text-sm text-muted-foreground">機號 × 日期的地面時間總覽 — 可用窗口、停留時間、過夜機會。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-3.5" /> 匯入班表
          </Button>
          <Button
            size="sm"
            onClick={() => openCreateFor({ aircraftRegistration: "", aircraftType: "", homeStation: "TPE", windows: [] }, startIso)}
            disabled={aircraftOptions.length === 0}
          >
            <Plus className="size-3.5" /> 新增地面時間
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="size-8" onClick={() => setAnchor((a) => addDays(a, -7))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>今天</Button>
              <Button variant="outline" size="icon" className="size-8" onClick={() => setAnchor((a) => addDays(a, 7))}>
                <ChevronRight className="size-4" />
              </Button>
              <span className="ml-1 text-sm font-medium">{periodLabel}</span>
            </div>

            <Select value={aircraftTypeFilter ?? ALL} onValueChange={(v) => setAircraftTypeFilter(v === ALL ? undefined : v)}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="機型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部機型</SelectItem>
                {AIRCRAFT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading && !board ? (
            <div className="py-10 text-center text-sm text-muted-foreground">載入中…</div>
          ) : aircraft.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">機隊清單裡沒有符合條件的飛機。</div>
          ) : (
            <div className="overflow-auto rounded-lg border">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-20 min-w-[110px] border-b border-r bg-card p-2 text-left font-medium">機號</th>
                    {days.map((d, i) => (
                      <th
                        key={dayIsos[i]}
                        className={cn(
                          "sticky top-0 z-10 min-w-[92px] border-b bg-card p-1.5 text-center font-medium",
                          isDateToday(d) && "bg-primary/10"
                        )}
                      >
                        <div>{WEEKDAY_LABELS[(d.getDay() + 6) % 7]}</div>
                        <div className={cn("text-muted-foreground", isDateToday(d) && "font-semibold text-primary")}>
                          {dayIsos[i].slice(5)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aircraft.map((a) => (
                    <tr key={a.aircraftRegistration} className="group">
                      <td className="sticky left-0 z-10 border-b border-r bg-card p-2 align-top">
                        <div className="font-medium">{a.aircraftRegistration}</div>
                        <div className="text-[10px] text-muted-foreground">{a.aircraftType} · {STATION_LABELS[a.homeStation as keyof typeof STATION_LABELS] ?? a.homeStation}</div>
                      </td>
                      {dayIsos.map((dayIso) => {
                        const windows = a.windows.filter((w) => w.arrivalAt.slice(0, 10) <= dayIso && w.departureAt.slice(0, 10) >= dayIso);
                        return (
                          <td key={dayIso} className="border-b border-l p-1 align-top">
                            <div className="flex min-h-[48px] flex-col gap-1">
                              {windows.map((w) => {
                                const segment = segmentFor(w, dayIso);
                                const overnight = segment !== "same";
                                return (
                                  <button
                                    key={w.id}
                                    type="button"
                                    onClick={() => openEditFor(a, w)}
                                    style={{ borderLeftColor: overnight ? "var(--status-good)" : "var(--primary)" }}
                                    className={cn(
                                      "rounded-md border-l-2 px-1.5 py-1 text-left leading-tight",
                                      overnight ? "bg-success/15 text-foreground" : "bg-muted/50 text-foreground"
                                    )}
                                  >
                                    {segmentLabel(w, segment)}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => openCreateFor(a, dayIso)}
                                className="rounded-md border border-dashed border-border/60 py-1 text-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:border-primary/50 hover:text-primary"
                              >
                                <Plus className="mx-auto size-3" />
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddGroundWindowDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        aircraftOptions={aircraftOptions}
        editingWindow={editTarget?.mode === "edit" ? editTarget.window : null}
        editingAircraftRegistration={editTarget?.mode === "edit" ? editTarget.aircraftRegistration : undefined}
        defaultAircraftRegistration={editTarget?.mode === "create" ? editTarget.aircraftRegistration || undefined : undefined}
        defaultStation={editTarget?.mode === "create" ? editTarget.station : undefined}
        defaultDateIso={editTarget?.mode === "create" ? editTarget.dateIso : undefined}
      />
      <ImportGroundWindowsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
