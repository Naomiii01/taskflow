"use client";

import * as React from "react";
import { addDays, eachDayOfInterval, isToday as isDateToday } from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight, ClipboardList, Clock, History, MapPin, Moon, Plus, Settings2, Upload, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/stat-card";
import { AddGroundWindowDialog, type AircraftOption } from "@/components/planning/add-ground-window-dialog";
import { AddDepartmentWindowDialog } from "@/components/planning/add-department-window-dialog";
import { ImportGroundWindowsDialog } from "@/components/planning/import-ground-windows-dialog";
import { GroundWindowChangeLogDialog } from "@/components/planning/ground-window-change-log-dialog";
import {
  useAircraftPlanningBoard,
  useBoardSettings,
  useUpdateBoardSettings,
  type BoardCapacitySettings,
  type DailyCapacity,
  type MaintenanceDepartment,
  type PlanningBoardAircraft,
  type PlanningBoardDepartmentWindow,
  type PlanningBoardWindow,
} from "@/hooks/use-aircraft-planning";
import { toIso, WEEKDAY_LABELS } from "@/lib/calendar-date-utils";
import { AIRCRAFT_TYPES, STATIONS, STATION_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type ViewMode = "day" | "week" | "month";
// 天/週/月分別對應看板一次顯示幾天——天用來放大看近期細節，月用來拉長看整體
// 排程，中間用週折衷；月視圖格子較窄，用天/週切換就能把格子放大。
const VIEW_RANGE_DAYS: Record<ViewMode, number> = { day: 3, week: 7, month: 30 };
const VIEW_MODE_LABELS: Record<ViewMode, string> = { day: "天", week: "週", month: "月" };
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
 * 幾點到幾點／過夜，不用特別寫站別——站別已經在機號那欄顯示了。重新匯入班表
 * 後找不到對應新班次的地停，不管原本是哪一種內容，前面都會加上醒目提示，
 * 讓人一眼就知道這筆時間可能已經過期、要確認。 */
function cellLabel(w: PlanningBoardWindow, segment: Segment) {
  const prefix = w.needsConfirmation ? "⚠ 航線異動，請確認｜" : "";
  if (hasMajorWork(w)) {
    const workName = w.majorWorkPlanned!.split("\n")[0].trim();
    const parts = [workName, w.shift, w.estimatedMh != null ? `${w.estimatedMh}MH` : null];
    return prefix + parts.filter(Boolean).join("-");
  }
  if (segment === "same") {
    const range = `${hhmm(w.arrivalAt)}–${hhmm(w.departureAt)}`;
    return prefix + (w.isDayStop ? `${range} 長地停` : range);
  }
  if (segment === "arrival") return `${prefix}${hhmm(w.arrivalAt)} 起過夜`;
  if (segment === "departure") return `${prefix}過夜 至${hhmm(w.departureAt)}`;
  return `${prefix}過夜中`;
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

type DepartmentEditTarget =
  | { mode: "create"; aircraftRegistration: string; dateIso: string }
  | { mode: "edit"; aircraftRegistration: string; window: PlanningBoardDepartmentWindow };

/** Capacity Warning 門檻設定——先用預設值，這裡可以自己調。閱覽者（canEdit
 * 為 false）還是可以打開看目前的門檻，只是欄位跟儲存按鈕會關閉。 */
function CapacitySettingsPopover({ canEdit }: { canEdit: boolean }) {
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
            <Input id="yellow_threshold" type="number" min="0" value={yellow} onChange={(e) => setYellow(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="red_threshold">紅色門檻</Label>
            <Input id="red_threshold" type="number" min="0" value={red} onChange={(e) => setRed(e.target.value)} disabled={!canEdit} />
          </div>
          {canEdit && <Button size="sm" onClick={onSave} disabled={updateSettings.isPending}>儲存</Button>}
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
export function AircraftPlanningBoard({ canEdit = true }: { canEdit?: boolean } = {}) {
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [viewMode, setViewMode] = React.useState<ViewMode>("week");
  const [aircraftTypeFilter, setAircraftTypeFilter] = React.useState<string | undefined>(undefined);
  // 依機隊主檔登記的固定基地場站篩選（homeStation）——不管當天實際停在哪裡。
  const [stationFilter, setStationFilter] = React.useState<string | undefined>(undefined);
  // 依「現在（今天）在哪個部門手上」篩選——機坪維修部／基地維修部，來自年度
  // 維修計畫表匯入的部門區間（見 departmentWindowForDay）。
  const [departmentFilter, setDepartmentFilter] = React.useState<MaintenanceDepartment | undefined>(undefined);
  const [editTarget, setEditTarget] = React.useState<EditTarget | null>(null);
  const [departmentEditTarget, setDepartmentEditTarget] = React.useState<DepartmentEditTarget | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [changeLogOpen, setChangeLogOpen] = React.useState(false);
  // 機號欄下方「目前駐留地點」要看哪一天——點日期欄的標題可以換；換頁
  // （往前/往後一頁，頁的長度依天/週/月而定）如果選到的那天不在畫面範圍
  // 裡，就退回顯示第一天。
  const [selectedDayIso, setSelectedDayIso] = React.useState<string>(() => toIso(new Date()));

  const rangeDays = VIEW_RANGE_DAYS[viewMode];
  const days = React.useMemo(() => eachDayOfInterval({ start: anchor, end: addDays(anchor, rangeDays - 1) }), [anchor, rangeDays]);
  const dayIsos = React.useMemo(() => days.map(toIso), [days]);
  const startIso = dayIsos[0];
  const endExclusiveIso = toIso(addDays(days[days.length - 1], 1));

  React.useEffect(() => {
    if (!dayIsos.includes(selectedDayIso)) setSelectedDayIso(dayIsos[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIsos]);

  const { data: board, isLoading } = useAircraftPlanningBoard(startIso, endExclusiveIso);

  // 「現在」是指真正的今天，不是看板目前捲到哪一頁——切換天/週/月或翻頁都不
  // 該影響「哪架飛機現在在哪個部門手上」這個篩選的答案。
  const todayIso = React.useMemo(() => toIso(new Date()), []);

  const aircraft = React.useMemo(() => {
    let list = board?.aircraft ?? [];
    if (aircraftTypeFilter) list = list.filter((a) => a.aircraftType === aircraftTypeFilter);
    if (stationFilter) list = list.filter((a) => a.homeStation === stationFilter);
    if (departmentFilter) {
      list = list.filter((a) =>
        a.departmentWindows.some((d) => d.department === departmentFilter && d.startDate <= todayIso && todayIso <= d.endDate)
      );
    }
    return list;
  }, [board, aircraftTypeFilter, stationFilter, departmentFilter, todayIso]);

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

  // 駐廠輪替表（例如駐留RMQ）——跟上面的每日地停格子是分開來源、疊加顯示的
  // 兩種資訊，這裡不取代 windowForDay。end_date 是半開區間（下一輪開始那
  // 天），所以用 < 不是 <=。
  const residencyWindowForDay = (a: PlanningBoardAircraft, dayIso: string) =>
    a.residencyWindows.find((r) => r.startDate <= dayIso && dayIso < r.endDate);

  // 機坪／基地部門標示——同樣是疊加顯示的第三種資訊，來源通常是年度維修計畫
  // 表匯入。跟 residencyWindowForDay 不同，end_date 在這裡是「含當天」
  // （inclusive），所以用 <= 而不是 <。
  const departmentWindowForDay = (a: PlanningBoardAircraft, dayIso: string) =>
    a.departmentWindows.find((d) => d.startDate <= dayIso && dayIso <= d.endDate);

  const openCreateFor = (a: PlanningBoardAircraft, dayIso: string) => {
    setEditTarget({ mode: "create", aircraftRegistration: a.aircraftRegistration, station: a.homeStation, dateIso: dayIso });
  };
  const openEditFor = (a: PlanningBoardAircraft, w: PlanningBoardWindow) => {
    setEditTarget({ mode: "edit", aircraftRegistration: a.aircraftRegistration, window: w });
  };

  const openCreateDepartmentFor = (aircraftRegistration: string, dayIso: string) => {
    setDepartmentEditTarget({ mode: "create", aircraftRegistration, dateIso: dayIso });
  };
  const openEditDepartmentFor = (aircraftRegistration: string, w: PlanningBoardDepartmentWindow) => {
    setDepartmentEditTarget({ mode: "edit", aircraftRegistration, window: w });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Aircraft Planning Board</h1>
          <p className="text-sm text-muted-foreground">機號 × 日期的地面時間總覽 — 可用窗口、停留時間、過夜機會。</p>
        </div>
        <div className="flex items-center gap-2">
          <CapacitySettingsPopover canEdit={canEdit} />
          <Button variant="outline" size="sm" onClick={() => setChangeLogOpen(true)}>
            <History className="size-3.5" /> 異動紀錄
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="size-3.5" /> 匯入班表
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  openCreateFor(
                    { aircraftRegistration: "", aircraftType: "", homeStation: "TPE", windows: [], residencyWindows: [], departmentWindows: [] },
                    startIso
                  )
                }
                disabled={aircraftOptions.length === 0}
              >
                <Plus className="size-3.5" /> 新增地面時間
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openCreateDepartmentFor("", startIso)}
                disabled={aircraftOptions.length === 0}
              >
                <Plus className="size-3.5" /> 新增部門標示
              </Button>
            </>
          )}
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
              <Button variant="outline" size="icon" className="size-8" onClick={() => setAnchor((a) => addDays(a, -rangeDays))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>今天</Button>
              <Button variant="outline" size="icon" className="size-8" onClick={() => setAnchor((a) => addDays(a, rangeDays))}>
                <ChevronRight className="size-4" />
              </Button>
              <span className="ml-1 text-sm font-medium">{periodLabel}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-md border p-0.5">
                {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                      mode === viewMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {VIEW_MODE_LABELS[mode]}
                  </button>
                ))}
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

              <Select value={stationFilter ?? ALL} onValueChange={(v) => setStationFilter(v === ALL ? undefined : v)}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="場站" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>全部場站</SelectItem>
                  {STATIONS.map((s) => (
                    <SelectItem key={s} value={s}>{STATION_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={departmentFilter ?? ALL}
                onValueChange={(v) => setDepartmentFilter(v === ALL ? undefined : (v as MaintenanceDepartment))}
              >
                <SelectTrigger className="w-[150px]" title="篩選「現在（今天）」在哪個部門手上">
                  <SelectValue placeholder="部門" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>全部部門</SelectItem>
                  <SelectItem value="機坪">現在在機坪</SelectItem>
                  <SelectItem value="基地">現在在基地</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">部門標示：</span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm bg-dept-ramp" /> 機坪維修部（接送機LINE上作業）
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm bg-dept-base" /> 基地維修部（長地停重工）
            </span>
            <span>— 來源：年度維修計畫表匯入，日期區間為目視判讀，如有出入請直接告知確切日期。</span>
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
                          "sticky top-0 z-10 cursor-pointer select-none border-b bg-card p-1.5 text-center font-medium",
                          viewMode === "day" ? "min-w-[160px]" : viewMode === "week" ? "min-w-[120px]" : "min-w-[92px]",
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
                    const currentResidency = residencyWindowForDay(a, selectedDayIso);
                    const currentDepartment = departmentWindowForDay(a, selectedDayIso);
                    // 駐廠輪替表比從班表算出來的地停格子更權威（是排班單位另外
                    // 排定的），選到的那天如果剛好在駐留區間內，機號下方優先顯
                    // 示駐留場站，而不是當天班表算出來的場站。
                    const currentStationLabel = currentResidency
                      ? STATION_LABELS[currentResidency.station as keyof typeof STATION_LABELS] ?? currentResidency.station
                      : currentWindow
                        ? STATION_LABELS[currentWindow.station as keyof typeof STATION_LABELS] ?? currentWindow.station
                        : STATION_LABELS[a.homeStation as keyof typeof STATION_LABELS] ?? a.homeStation;
                    return (
                    <tr key={a.aircraftRegistration} className="group">
                      <td className="sticky left-0 z-10 border-b border-r bg-card p-2 align-top">
                        <div className="flex items-center gap-1.5">
                          <div className="font-medium">{a.aircraftRegistration}</div>
                          {currentDepartment && (
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => canEdit && openEditDepartmentFor(a.aircraftRegistration, currentDepartment)}
                              title={currentDepartment.description ?? undefined}
                              className={cn(
                                "rounded px-1 py-0.5 text-[9px] font-semibold leading-none",
                                currentDepartment.department === "機坪"
                                  ? "bg-dept-ramp text-dept-ramp-foreground"
                                  : "bg-dept-base text-dept-base-foreground",
                                canEdit && "cursor-pointer hover:opacity-80"
                              )}
                            >
                              {currentDepartment.department}
                            </button>
                          )}
                          {canEdit && !currentDepartment && (
                            <button
                              type="button"
                              title="新增部門標示"
                              onClick={() => openCreateDepartmentFor(a.aircraftRegistration, selectedDayIso)}
                              className="rounded px-1 py-0.5 text-[9px] text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                            >
                              ＋部門
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{a.aircraftType} · {currentStationLabel}</div>
                        {currentResidency ? (
                          <div className="text-[9px] font-medium text-residency">
                            駐留 {currentResidency.startDate.slice(5)} – {currentResidency.endDate.slice(5)}
                          </div>
                        ) : (
                          currentWindow && <div className="text-[9px] text-muted-foreground/70">{rangeLabel(currentWindow)}</div>
                        )}
                      </td>
                      {dayIsos.map((dayIso) => {
                        const windows = a.windows.filter((w) => w.arrivalAt.slice(0, 10) <= dayIso && w.departureAt.slice(0, 10) >= dayIso);
                        const residency = residencyWindowForDay(a, dayIso);
                        const department = departmentWindowForDay(a, dayIso);
                        // 標籤只在區間第一天（或畫面可見範圍的第一天，如果這段
                        // 區間在畫面捲動範圍之前就開始了）顯示一次，其餘天數只
                        // 用背景色標示，跟駐留區間的顯示方式一致。
                        const showDepartmentLabel = department && (dayIso === department.startDate || dayIso === dayIsos[0]);
                        return (
                          <td
                            key={dayIso}
                            title={
                              department
                                ? `${department.department}${department.description ? `：${department.description}` : ""}（${department.startDate.slice(5)} – ${department.endDate.slice(5)}）`
                                : residency
                                  ? `駐留${STATION_LABELS[residency.station as keyof typeof STATION_LABELS] ?? residency.station}：${residency.startDate.slice(5)} – ${residency.endDate.slice(5)}`
                                  : undefined
                            }
                            className={cn(
                              "border-b border-l p-1 align-top",
                              residency && "bg-residency/30",
                              department && (department.department === "機坪" ? "bg-dept-ramp/15" : "bg-dept-base/15")
                            )}
                          >
                            {showDepartmentLabel && (
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => canEdit && openEditDepartmentFor(a.aircraftRegistration, department!)}
                                className={cn(
                                  "mb-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[9px] font-semibold",
                                  department!.department === "機坪"
                                    ? "bg-dept-ramp text-dept-ramp-foreground"
                                    : "bg-dept-base text-dept-base-foreground",
                                  canEdit && "cursor-pointer hover:opacity-80"
                                )}
                              >
                                {department!.department}{department!.description ? `｜${department!.description.split("+")[0]}` : ""}
                              </button>
                            )}
                            {residency && dayIso === residency.startDate && (
                              <div className="mb-0.5 truncate rounded bg-residency px-1 py-0.5 text-[9px] font-semibold text-residency-foreground">
                                駐{STATION_LABELS[residency.station as keyof typeof STATION_LABELS] ?? residency.station}起
                              </div>
                            )}
                            <div className="flex min-h-[48px] flex-col gap-1">
                              {windows.map((w) => {
                                const segment = segmentFor(w, dayIso);
                                const overnight = segment !== "same";
                                const work = hasMajorWork(w);
                                // 同日長地停（A359/A351 跨夜航班回站到當天傍晚才又出門，中間
                                // 停很久）也是計畫維修的好窗口，用第三種顏色（藍綠）跟過夜
                                // （綠）、工作（琥珀）分開，才不會被誤認成普通同日轉場。
                                const dayStop = !overnight && !work && w.isDayStop;
                                // 已排定的計畫工作跟純過夜地停刻意用不同顏色——工作用琥珀色，
                                // 過夜用綠色，兩者可能同時疊在同一格裡（各是獨立的一列），顏色
                                // 不同才分得清楚哪個是工作、哪個只是過夜。
                                return (
                                  <button
                                    key={w.id}
                                    type="button"
                                    onClick={() => openEditFor(a, w)}
                                    style={{
                                      borderLeftColor: work
                                        ? "var(--warning)"
                                        : overnight
                                          ? "var(--status-good)"
                                          : dayStop
                                            ? "var(--day-stop)"
                                            : "var(--primary)",
                                    }}
                                    className={cn(
                                      "rounded-md border-l-2 px-1.5 py-1 text-left leading-tight",
                                      work
                                        ? "bg-warning/20 text-foreground"
                                        : overnight
                                          ? "bg-success/15 text-foreground"
                                          : dayStop
                                            ? "bg-day-stop/15 text-foreground"
                                            : "bg-muted/50 text-foreground",
                                      // 找不到對應新班次、需要人工確認的地停——不管本來是哪種顏色，
                                      // 都加一圈醒目的紅框，跟其他狀態疊加也看得出來。
                                      w.needsConfirmation && "ring-2 ring-destructive ring-offset-1"
                                    )}
                                  >
                                    {cellLabel(w, segment)}
                                  </button>
                                );
                              })}
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => openCreateFor(a, dayIso)}
                                  className="rounded-md border border-dashed border-border/60 py-1 text-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:border-primary/50 hover:text-primary"
                                >
                                  <Plus className="mx-auto size-3" />
                                </button>
                              )}
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
        readOnly={!canEdit}
      />
      <AddDepartmentWindowDialog
        open={!!departmentEditTarget}
        onOpenChange={(open) => !open && setDepartmentEditTarget(null)}
        aircraftOptions={aircraftOptions}
        editingWindow={departmentEditTarget?.mode === "edit" ? departmentEditTarget.window : null}
        editingAircraftRegistration={departmentEditTarget?.mode === "edit" ? departmentEditTarget.aircraftRegistration : undefined}
        defaultAircraftRegistration={departmentEditTarget?.mode === "create" ? departmentEditTarget.aircraftRegistration || undefined : undefined}
        defaultDateIso={departmentEditTarget?.mode === "create" ? departmentEditTarget.dateIso : undefined}
        readOnly={!canEdit}
      />
      <ImportGroundWindowsDialog open={importOpen} onOpenChange={setImportOpen} />
      <GroundWindowChangeLogDialog open={changeLogOpen} onOpenChange={setChangeLogOpen} />
    </div>
  );
}
