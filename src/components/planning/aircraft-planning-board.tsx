"use client";

import * as React from "react";
import { addDays, eachDayOfInterval, isToday as isDateToday } from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight, ClipboardList, Clock, MapPin, Moon, Plus, Settings2, Upload, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/stat-card";
import { AddGroundWindowDialog, type AircraftOption } from "@/components/planning/add-ground-window-dialog";
import { ImportGroundWindowsDialog } from "@/components/planning/import-ground-windows-dialog";
import {
  useAircraftPlanningBoard,
  useBoardSettings,
  useUpdateBoardSettings,
  type BoardCapacitySettings,
  type DailyCapacity,
  type PlanningBoardAircraft,
  type PlanningBoardWindow,
} from "@/hooks/use-aircraft-planning";
import { toIso, WEEKDAY_LABELS } from "@/lib/calendar-date-utils";
import { AIRCRAFT_TYPES, STATION_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const RANGE_DAYS = 14;
const ALL = "__all__";

function hhmm(iso: string) {
  return iso.slice(11, 16);
}

type CapacityWarningLevel = "none" | "yellow" | "red";

/** Capacity Warning：黃色＝達到門檻，紅色＝超過上限。門檻可在畫面右上角調整。 */
function capacityWarningLevel(majorWorkCount: number, settings: BoardCapacitySettings): CapacityWarningLevel {
  if (majorWorkCount >= settings.redThreshold) return "red";
  if (majorWorkCount >= settings.yellowThreshold) return "yellow";
  return "none";
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

function hasMajorWork(w: PlanningBoardWindow): boolean {
  return !!(w.majorWorkPlanned && w.majorWorkPlanned.trim());
}

/** 格子裡的文字：有排大工就顯示「工作名稱-班別-MH」，沒有排大工就只顯示
 * 幾點到幾點／過夜，不用特別寫站別——站別已經在機號那欄顯示了。 */
function cellLabel(w: PlanningBoardWindow, segment: Segment) {
  if (hasMajorWork(w)) {
    const workName = w.majorWorkPlanned!.split("\n")[0].trim();
    const parts = [workName, w.shift, w.estimatedMh != null ? `${w.estimatedMh}MH` : null];
    return parts.filter(Boolean).join("-");
  }
  if (segment === "same") return `${hhmm(w.arrivalAt)}–${hhmm(w.departureAt)}`;
  if (segment === "arrival") return `${hhmm(w.arrivalAt)} 起過夜`;
  if (segment === "departure") return `過夜 至${hhmm(w.departureAt)}`;
  return "過夜中";
}

/** 機號欄下方的「駐留區間」——只有選到的那一天剛好落在某段地面時間裡才會
 * 顯示，同一天進出就只顯示時分，跨天就帶上月-日。 */
function rangeLabel(w: PlanningBoardWindow) {
  const arrivalDay = w.arrivalAt.slice(0, 10);
  const departureDay = w.departureAt.slice(0, 10);
  if (arrivalDay === departureDay) return `${hhmm(w.arrivalAt)}–${hhmm(w.departureAt)}`;
  return `${arrivalDay.slice(5)} ${hhmm(w.arrivalAt)} → ${departureDay.slice(5)} ${hhmm(w.departureAt)}`;
}

type EditTarget =
  | { mode: "create"; aircraftRegistration: string; station: string; dateIso: string }
  | { mode: "edit"; aircraftRegistration: string; window: PlanningBoardWindow };

/** Capacity Warning 門檻設定——先用預設值，這裡可以自己調。 */
function CapacitySettingsPopover() {
  const { data: settings } = useBoardSettings();
  const updateSettings = useUpdateBoardSettings();
  const [yellow, setYellow] = React.useState("");
  const [red, setRed] = React.useState("");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (settings) {
      setYellow(String(settings.yellowThreshold));
      setRed(String(settings.redThreshold));
    }
  }, [settings]);

  const onSave = async () => {
    await updateSettings.mutateAsync({ yellow_threshold: Number(yellow), red_threshold: Number(red) });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="size-3.5" /> 警示門檻
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Capacity Warning 門檻</p>
          <p className="text-xs text-muted-foreground">同一天大工數量達到黃色門檻顯示黃色警示，達到紅色門檻顯示紅色警示。</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="yellow_threshold">黃色門檻</Label>
            <Input id="yellow_threshold" type="number" min="0" value={yellow} onChange={(e) => setYellow(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="red_threshold">紅色門檻</Label>
            <Input id="red_threshold" type="number" min="0" value={red} onChange={(e) => setRed(e.target.value)} />
          </div>
          <Button size="sm" onClick={onSave} disabled={updateSettings.isPending}>儲存</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
  // 機號欄下方「目前駐留地點」要看哪一天——點日期欄的標題可以換；換頁
  // （往前/往後一週）如果選到的那天不在畫面範圍裡，就退回顯示第一天。
  const [selectedDayIso, setSelectedDayIso] = React.useState<string>(() => toIso(new Date()));

  const days = React.useMemo(() => eachDayOfInterval({ start: anchor, end: addDays(anchor, RANGE_DAYS - 1) }), [anchor]);
  const dayIsos = React.useMemo(() => days.map(toIso), [days]);
  const startIso = dayIsos[0];
  const endExclusiveIso = toIso(addDays(days[days.length - 1], 1));

  React.useEffect(() => {
    if (!dayIsos.includes(selectedDayIso)) setSelectedDayIso(dayIsos[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIsos]);

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

  const capacityByDay = React.useMemo(() => {
    const map = new Map<string, DailyCapacity>();
    for (const d of board?.dailyCapacity ?? []) map.set(d.date, d);
    return map;
  }, [board]);

  const windowForDay = (a: PlanningBoardAircraft, dayIso: string) =>
    a.windows.find((w) => w.arrivalAt.slice(0, 10) <= dayIso && w.departureAt.slice(0, 10) >= dayIso);

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
          <CapacitySettingsPopover />
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

      {!board ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard label="今日大工數量" value={board.dashboardSummary.todayMajorWorkCount} icon={Wrench} />
          <StatCard label="本週大工數量" value={board.dashboardSummary.weekMajorWorkCount} icon={Wrench} />
          <StatCard label="RMQ駐留航機" value={board.dashboardSummary.rmqResidentCount} icon={MapPin} />
          <StatCard label="KHH駐留航機" value={board.dashboardSummary.khhResidentCount} icon={MapPin} />
          <StatCard label="Overnight Aircraft" value={board.dashboardSummary.overnightAircraftCount} icon={Moon} tone="success" />
          <StatCard label="待安排工單數量" value={board.dashboardSummary.unscheduledTaskCount} icon={ClipboardList} tone="warning" />
          <StatCard label="RMQ地停時數（今日）" value={board.dashboardSummary.rmqGroundHoursToday} icon={Clock} />
          <StatCard label="KHH地停時數（今日）" value={board.dashboardSummary.khhGroundHoursToday} icon={Clock} />
          <StatCard label="TPE地停時數（今日）" value={board.dashboardSummary.tpeGroundHoursToday} icon={Clock} />
        </div>
      )}

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
                        onClick={() => setSelectedDayIso(dayIsos[i])}
                        title="點選這一天，左邊機號下方會顯示當天的駐留地點"
                        className={cn(
                          "sticky top-0 z-10 min-w-[92px] cursor-pointer select-none border-b bg-card p-1.5 text-center font-medium",
                          isDateToday(d) && "bg-primary/10",
                          dayIsos[i] === selectedDayIso && "ring-2 ring-inset ring-primary"
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
                  <tr className="bg-muted/30">
                    <td className="sticky left-0 z-10 border-b border-r bg-muted/30 p-2 align-middle text-[10px] font-medium text-muted-foreground">
                      <div className="flex items-center gap-1"><CalendarClock className="size-3" /> 每日大工容量</div>
                    </td>
                    {dayIsos.map((dayIso) => {
                      const capacity = capacityByDay.get(dayIso);
                      const level = capacity && board ? capacityWarningLevel(capacity.majorWorkCount, board.capacitySettings) : "none";
                      return (
                        <td
                          key={dayIso}
                          className={cn(
                            "border-b border-l p-1.5 text-center align-middle",
                            level === "yellow" && "bg-[color-mix(in_oklab,var(--warning)_20%,transparent)]",
                            level === "red" && "bg-destructive/15"
                          )}
                        >
                          <div
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              level === "yellow" && "text-[var(--warning)]",
                              level === "red" && "text-destructive"
                            )}
                          >
                            {capacity?.majorWorkCount ?? 0}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{capacity?.mhTotal ?? 0} MH</div>
                        </td>
                      );
                    })}
                  </tr>
                  {(
                    [
                      { label: "RMQ 地停", countKey: "rmqAircraftCount", hoursKey: "rmqGroundHours" },
                      { label: "KHH 地停", countKey: "khhAircraftCount", hoursKey: "khhGroundHours" },
                      { label: "TPE 地停", countKey: "tpeAircraftCount", hoursKey: "tpeGroundHours" },
                    ] as const
                  ).map((row) => (
                    <tr key={row.label} className="bg-muted/10">
                      <td className="sticky left-0 z-10 border-b border-r bg-muted/10 p-1.5 align-middle text-[10px] text-muted-foreground">
                        {row.label}
                      </td>
                      {dayIsos.map((dayIso) => {
                        const capacity = capacityByDay.get(dayIso);
                        const count = capacity?.[row.countKey] ?? 0;
                        const hours = capacity?.[row.hoursKey] ?? 0;
                        return (
                          <td key={dayIso} className="border-b border-l p-1 text-center align-middle text-[10px] text-muted-foreground">
                            {count > 0 ? `${count}架・${hours}h` : "–"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {aircraft.map((a) => {
                    const currentWindow = windowForDay(a, selectedDayIso);
                    const currentStationLabel = currentWindow
                      ? STATION_LABELS[currentWindow.station as keyof typeof STATION_LABELS] ?? currentWindow.station
                      : STATION_LABELS[a.homeStation as keyof typeof STATION_LABELS] ?? a.homeStation;
                    return (
                    <tr key={a.aircraftRegistration} className="group">
                      <td className="sticky left-0 z-10 border-b border-r bg-card p-2 align-top">
                        <div className="font-medium">{a.aircraftRegistration}</div>
                        <div className="text-[10px] text-muted-foreground">{a.aircraftType} · {currentStationLabel}</div>
                        {currentWindow && (
                          <div className="text-[9px] text-muted-foreground/70">{rangeLabel(currentWindow)}</div>
                        )}
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
                                    {cellLabel(w, segment)}
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
                    );
                  })}
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
