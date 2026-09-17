import "server-only";

import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  AircraftType,
  Station,
  AircraftCurrentStatus,
  MajorWorkPlanningStatus,
  WorkShift,
} from "@/types/database.types";
import { STATIONS } from "@/lib/constants";
import * as groundWindowsRepo from "@/lib/repositories/aircraft-ground-windows-repository";
import * as changeLogRepo from "@/lib/repositories/ground-window-change-log-repository";
import * as residencyWindowsRepo from "@/lib/repositories/aircraft-residency-windows-repository";
import * as planningLookupsRepo from "@/lib/repositories/planning-lookups-repository";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import * as boardSettingsRepo from "@/lib/repositories/planning-board-settings-repository";
import type { GroundWindowValues, GroundWindowUpdateValues, PlanningBoardSettingsValues } from "@/lib/validations/planning";

type DB = SupabaseClient<Database, "taskflow">;

export type PlanningBoardWindow = {
  id: string;
  station: Station;
  arrivalAt: string;
  departureAt: string;
  groundTimeMinutes: number;
  /** Spans at least one local midnight — a maintenance-shift opportunity. */
  isOvernight: boolean;
  /** A same-calendar-day ground stay that's still long enough to be a real
   * maintenance-shift opportunity — the long-haul fleet's pattern of landing
   * early morning and not leaving again until evening. Never true together
   * with isOvernight (see toBoardWindow). */
  isDayStop: boolean;
  /** True when a schedule re-import couldn't find a matching new ground stay
   * for this aircraft/station (route dropped or heavily reshuffled) — the row
   * is kept as-is (with its last-known times) rather than silently deleted or
   * silently updated, so its plan isn't lost. Cleared automatically the next
   * time someone edits and saves this window. */
  needsConfirmation: boolean;
  notes: string | null;
  // Planning Information — all null when no major work is planned for this stay.
  currentStatus: AircraftCurrentStatus | null;
  majorWorkPlanned: string | null;
  estimatedMh: number | null;
  requiredSkill: string | null;
  requiredEquipment: string | null;
  requiredAuthorization: string | null;
  planningStatus: MajorWorkPlanningStatus | null;
  // 早班／中班／大夜班——只在有計畫大工項目時才有意義。
  shift: WorkShift | null;
};

/** A long-span "based at this station" rotation (駐廠輪替表) — e.g. two weeks
 * resident at RMQ for a scheduled heavy check. Deliberately separate from
 * PlanningBoardWindow: it comes from a different source (a roster someone
 * else maintains, not the daily flight schedule) and the board overlays it
 * on top of the daily ground-time cells rather than replacing them. */
export type PlanningBoardResidencyWindow = {
  id: string;
  station: Station;
  startDate: string;
  endDate: string;
  notes: string | null;
};

export type PlanningBoardAircraft = {
  aircraftRegistration: string;
  aircraftType: AircraftType;
  homeStation: Station;
  windows: PlanningBoardWindow[];
  residencyWindows: PlanningBoardResidencyWindow[];
};

export type DailyCapacity = {
  date: string;
  majorWorkCount: number;
  mhTotal: number;
  // "有幾架飛機停在這一站" — a headcount, not a duration.
  rmqAircraftCount: number;
  khhAircraftCount: number;
  tpeAircraftCount: number;
  // 地停時間 — actual grounded hours at that station ON THIS CALENDAR DAY
  // only (the window's overlap with this day, capped at 24h), not the whole
  // window's length. A multi-day stay contributes a different number of
  // hours to each day it touches instead of double-counting its full length.
  rmqGroundHours: number;
  khhGroundHours: number;
  tpeGroundHours: number;
};

export type DashboardSummary = {
  todayMajorWorkCount: number;
  weekMajorWorkCount: number;
  rmqResidentCount: number;
  khhResidentCount: number;
  overnightAircraftCount: number;
  unscheduledTaskCount: number;
  // 地停時間（今日）— total grounded hours at each station today, same
  // overlap-based calculation as DailyCapacity's per-day figures.
  rmqGroundHoursToday: number;
  khhGroundHoursToday: number;
  tpeGroundHoursToday: number;
};

export type CapacityWarningLevel = "none" | "yellow" | "red";

export type PlanningBoard = {
  start: string;
  end: string;
  aircraft: PlanningBoardAircraft[];
  dailyCapacity: DailyCapacity[];
  dashboardSummary: DashboardSummary;
  capacitySettings: { yellowThreshold: number; redThreshold: number };
};

/** Capacity Warning: 黃色＝達到門檻，紅色＝超過上限。 */
export function capacityWarningLevel(
  majorWorkCount: number,
  settings: { yellowThreshold: number; redThreshold: number }
): CapacityWarningLevel {
  if (majorWorkCount >= settings.redThreshold) return "red";
  if (majorWorkCount >= settings.yellowThreshold) return "yellow";
  return "none";
}

// Every timestamp in this feature is entered and displayed as a plain local
// wall-clock value (no timezone math) — see aircraft-ground-windows datetime
// inputs on the client. Reading calendar-day boundaries off the raw ISO
// string (rather than through Date's local-timezone getters) keeps that
// consistent no matter what timezone this server process runs in.
function dateKeyOf(iso: string) {
  return iso.slice(0, 10);
}

/** Fleet this "day stop" rule applies to — the only aircraft whose schedule
 * can produce a long same-day ground stay in the first place (a US/Europe
 * rotation landing early morning and not leaving again until evening). The
 * rest of the fleet's same-day gaps are ordinary turnarounds, never a
 * maintenance opportunity worth flagging. */
/** Re-import plan matching: how close (in wall-clock time) a freshly computed
 * ground window has to be to an existing *planned* one, same aircraft/station,
 * to count as "the same stop, just shifted" rather than "this stop is gone".
 * Generous enough to absorb a multi-hour schedule shift or a push into the
 * next/previous day, tight enough not to accidentally match an unrelated
 * later rotation of the same aircraft back through the same station. */
const PLAN_MATCH_TOLERANCE_MS = 36 * 60 * 60 * 1000;

const LONG_HAUL_TYPES: ReadonlySet<AircraftType> = new Set(["A359", "A351"]);
/** How long a same-day ground stay has to be before it counts as a "日間長
 * 地停" (day stop) rather than an ordinary turnaround between two legs. */
const DAY_STOP_MIN_MINUTES = 6 * 60;

function toBoardWindow(
  row: Awaited<ReturnType<typeof groundWindowsRepo.findWindowsOverlapping>>[number],
  aircraftType?: AircraftType | null
): PlanningBoardWindow {
  const groundTimeMinutes = Math.round(
    (new Date(row.departure_at).getTime() - new Date(row.arrival_at).getTime()) / 60000
  );
  const isOvernight = dateKeyOf(row.arrival_at) !== dateKeyOf(row.departure_at);
  const isDayStop =
    !isOvernight &&
    !!aircraftType &&
    LONG_HAUL_TYPES.has(aircraftType) &&
    groundTimeMinutes >= DAY_STOP_MIN_MINUTES;
  return {
    id: row.id,
    station: row.station,
    arrivalAt: row.arrival_at,
    departureAt: row.departure_at,
    groundTimeMinutes,
    isOvernight,
    isDayStop,
    needsConfirmation: row.needs_confirmation,
    notes: row.notes,
    currentStatus: row.current_status,
    majorWorkPlanned: row.major_work_planned,
    estimatedMh: row.estimated_mh,
    requiredSkill: row.required_skill,
    requiredEquipment: row.required_equipment,
    requiredAuthorization: row.required_authorization,
    planningStatus: row.planning_status,
    shift: row.shift,
  };
}

function toBoardResidencyWindow(
  row: Awaited<ReturnType<typeof residencyWindowsRepo.findWindowsOverlapping>>[number]
): PlanningBoardResidencyWindow {
  return { id: row.id, station: row.station, startDate: row.start_date, endDate: row.end_date, notes: row.notes };
}

/** Every calendar-day key a window touches within [start, end) — a window
 * spanning multiple days (an overnight, or a multi-day stay) counts toward
 * each day's capacity, not just its arrival day. `end` is exclusive (the day
 * after the board's last visible column), matching `getPlanningBoard`. */
function dayKeysTouched(window: PlanningBoardWindow, start: string, end: string): string[] {
  const arrivalKey = dateKeyOf(window.arrivalAt);
  const departureKey = dateKeyOf(window.departureAt);
  const keys: string[] = [];
  const cursor = new Date(`${arrivalKey < start ? start : arrivalKey}T00:00:00.000Z`);
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (key >= end || key > departureKey) break;
    keys.push(key);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function hasMajorWork(w: PlanningBoardWindow): boolean {
  return !!(w.majorWorkPlanned && w.majorWorkPlanned.trim());
}

/** Minutes of overlap between [aStart, aEnd) and [bStart, bEnd) — used to
 * turn a ground window's raw arrival/departure into "how many hours was it
 * actually grounded on THIS specific day", so a multi-day stay's length
 * isn't double-counted across every day it touches. */
function overlapMinutes(aStartIso: string, aEndIso: string, bStartIso: string, bEndIso: string): number {
  const start = Math.max(new Date(aStartIso).getTime(), new Date(bStartIso).getTime());
  const end = Math.min(new Date(aEndIso).getTime(), new Date(bEndIso).getTime());
  return Math.max(0, Math.round((end - start) / 60000));
}

function addDaysToKey(dayKey: string, days: number): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function todayKeyAndNextDay(): { todayKey: string; nextDayKey: string } {
  const todayKey = new Date().toISOString().slice(0, 10);
  const next = new Date(`${todayKey}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { todayKey, nextDayKey: next.toISOString().slice(0, 10) };
}

/** Monday-through-Sunday bounds for "本週" — same week-start convention
 * (Monday) as tasks-repository's `dueThisWeek` filter. `end` is exclusive
 * (the Monday after). */
function thisWeekBounds(): { start: string; end: string } {
  const today = new Date();
  const day = today.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  const start = monday.toISOString().slice(0, 10);
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  return { start, end: nextMonday.toISOString().slice(0, 10) };
}

/**
 * Aircraft Planning Board Lite: one row per active Fleet Master aircraft,
 * each carrying every ground-time window that overlaps [start, end), plus
 * Capacity Information (per visible day) and a Dashboard Summary computed
 * against the real "today"/"this week" — independent of whichever date
 * range the grid is currently scrolled to.
 * `end` should be the day AFTER the board's last visible column (exclusive
 * upper bound) — the grid buckets a window into every day column it
 * touches client-side, since a window can span more than one day.
 */
export async function getPlanningBoard(supabase: DB, start: string, end: string): Promise<PlanningBoard> {
  const { todayKey, nextDayKey } = todayKeyAndNextDay();
  const { start: weekStart, end: weekEnd } = thisWeekBounds();

  const [fleet, windows, todayWindows, weekWindows, residencyWindows, settings, unscheduledTaskCount] = await Promise.all([
    planningLookupsRepo.findAllFleet(supabase),
    groundWindowsRepo.findWindowsOverlapping(supabase, start, end),
    groundWindowsRepo.findWindowsOverlapping(supabase, todayKey, nextDayKey),
    groundWindowsRepo.findWindowsOverlapping(supabase, weekStart, weekEnd),
    residencyWindowsRepo.findWindowsOverlapping(supabase, start, end),
    boardSettingsRepo.getSettings(supabase),
    tasksRepo.countUnscheduledTodoTasks(supabase),
  ]);

  // Aircraft not yet delivered (still with the manufacturer) are hidden from
  // the whole board, not just the row list — their ground time shouldn't
  // silently pad the capacity/dashboard numbers for a plane nobody can see.
  const activeRegistrations = new Set(fleet.filter((f) => f.status === "Active").map((f) => f.aircraft_registration));
  const visibleWindows = windows.filter((w) => activeRegistrations.has(w.aircraft_registration));
  const visibleTodayWindows = todayWindows.filter((w) => activeRegistrations.has(w.aircraft_registration));
  const visibleWeekWindows = weekWindows.filter((w) => activeRegistrations.has(w.aircraft_registration));
  const aircraftTypeByReg = new Map(fleet.map((f) => [f.aircraft_registration, f.aircraft_type]));

  const windowsByAircraft = new Map<string, PlanningBoardWindow[]>();
  for (const w of visibleWindows) {
    const boardWindow = toBoardWindow(w, aircraftTypeByReg.get(w.aircraft_registration));
    const list = windowsByAircraft.get(w.aircraft_registration);
    if (list) list.push(boardWindow);
    else windowsByAircraft.set(w.aircraft_registration, [boardWindow]);
  }

  const residencyWindowsByAircraft = new Map<string, PlanningBoardResidencyWindow[]>();
  for (const r of residencyWindows) {
    if (!activeRegistrations.has(r.aircraft_registration)) continue;
    const boardResidencyWindow = toBoardResidencyWindow(r);
    const list = residencyWindowsByAircraft.get(r.aircraft_registration);
    if (list) list.push(boardResidencyWindow);
    else residencyWindowsByAircraft.set(r.aircraft_registration, [boardResidencyWindow]);
  }

  const aircraft: PlanningBoardAircraft[] = fleet
    .filter((f) => f.status === "Active")
    .map((f) => ({
      aircraftRegistration: f.aircraft_registration,
      aircraftType: f.aircraft_type,
      homeStation: f.station,
      windows: windowsByAircraft.get(f.aircraft_registration) ?? [],
      residencyWindows: residencyWindowsByAircraft.get(f.aircraft_registration) ?? [],
    }));

  // Capacity Information — one bucket per visible day, tallied from every
  // window touching that day (a multi-day stay counts toward each day it
  // occupies, per dayKeysTouched — capacity is consumed on every day a big
  // job is in progress, not only the day it starts). Ground hours use the
  // actual overlap with that specific day, not the window's full length.
  //
  // Aircraft counts are a HEADCOUNT — "how many distinct aircraft touched
  // this station today" — not a count of windows. One aircraft can rack up
  // several short ground windows at the same station on the same day (e.g.
  // TPE↔somewhere↔TPE turnarounds between legs), so counting windows instead
  // of distinct registrations wildly overcounts (55 "aircraft" at TPE on a
  // 37-tail fleet). A Set per day per station keeps this an honest headcount.
  const dailyMap = new Map<string, DailyCapacity>();
  const dailyStationAircraft = new Map<string, { RMQ: Set<string>; KHH: Set<string>; TPE: Set<string> }>();
  for (const w of visibleWindows) {
    const boardWindow = toBoardWindow(w, aircraftTypeByReg.get(w.aircraft_registration));
    for (const day of dayKeysTouched(boardWindow, start, end)) {
      let bucket = dailyMap.get(day);
      if (!bucket) {
        bucket = {
          date: day,
          majorWorkCount: 0,
          mhTotal: 0,
          rmqAircraftCount: 0,
          khhAircraftCount: 0,
          tpeAircraftCount: 0,
          rmqGroundHours: 0,
          khhGroundHours: 0,
          tpeGroundHours: 0,
        };
        dailyMap.set(day, bucket);
      }
      let stationSets = dailyStationAircraft.get(day);
      if (!stationSets) {
        stationSets = { RMQ: new Set(), KHH: new Set(), TPE: new Set() };
        dailyStationAircraft.set(day, stationSets);
      }
      if (hasMajorWork(boardWindow)) {
        bucket.majorWorkCount += 1;
        bucket.mhTotal += boardWindow.estimatedMh ?? 0;
      }
      if (w.station === "RMQ") stationSets.RMQ.add(w.aircraft_registration);
      if (w.station === "KHH") stationSets.KHH.add(w.aircraft_registration);
      if (w.station === "TPE") stationSets.TPE.add(w.aircraft_registration);

      const dayStartIso = `${day}T00:00:00.000Z`;
      const dayEndIso = `${addDaysToKey(day, 1)}T00:00:00.000Z`;
      const groundHoursThisDay = overlapMinutes(boardWindow.arrivalAt, boardWindow.departureAt, dayStartIso, dayEndIso) / 60;
      if (w.station === "RMQ") bucket.rmqGroundHours += groundHoursThisDay;
      if (w.station === "KHH") bucket.khhGroundHours += groundHoursThisDay;
      if (w.station === "TPE") bucket.tpeGroundHours += groundHoursThisDay;
    }
  }
  const dailyCapacity = Array.from(dailyMap.values())
    .map((d) => {
      const stationSets = dailyStationAircraft.get(d.date);
      return {
        ...d,
        rmqAircraftCount: stationSets?.RMQ.size ?? 0,
        khhAircraftCount: stationSets?.KHH.size ?? 0,
        tpeAircraftCount: stationSets?.TPE.size ?? 0,
        rmqGroundHours: round1(d.rmqGroundHours),
        khhGroundHours: round1(d.khhGroundHours),
        tpeGroundHours: round1(d.tpeGroundHours),
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // Dashboard Summary.
  const todayEntries = visibleTodayWindows.map((w) => ({
    reg: w.aircraft_registration,
    bw: toBoardWindow(w, aircraftTypeByReg.get(w.aircraft_registration)),
  }));
  const weekEntries = visibleWeekWindows.map((w) => ({ bw: toBoardWindow(w, aircraftTypeByReg.get(w.aircraft_registration)) }));
  const todayMajorWorkCount = todayEntries.filter((e) => hasMajorWork(e.bw)).length;
  const weekMajorWorkCount = weekEntries.filter((e) => hasMajorWork(e.bw)).length;
  const rmqResidentCount = new Set(visibleTodayWindows.filter((w) => w.station === "RMQ").map((w) => w.aircraft_registration)).size;
  const khhResidentCount = new Set(visibleTodayWindows.filter((w) => w.station === "KHH").map((w) => w.aircraft_registration)).size;
  const overnightAircraftCount = new Set(todayEntries.filter((e) => e.bw.isOvernight).map((e) => e.reg)).size;

  const todayStartIso = `${todayKey}T00:00:00.000Z`;
  const todayEndIso = `${nextDayKey}T00:00:00.000Z`;
  let rmqGroundHoursToday = 0;
  let khhGroundHoursToday = 0;
  let tpeGroundHoursToday = 0;
  for (const w of visibleTodayWindows) {
    const hours = overlapMinutes(w.arrival_at, w.departure_at, todayStartIso, todayEndIso) / 60;
    if (w.station === "RMQ") rmqGroundHoursToday += hours;
    if (w.station === "KHH") khhGroundHoursToday += hours;
    if (w.station === "TPE") tpeGroundHoursToday += hours;
  }

  return {
    start,
    end,
    aircraft,
    dailyCapacity,
    dashboardSummary: {
      todayMajorWorkCount,
      weekMajorWorkCount,
      rmqResidentCount,
      khhResidentCount,
      overnightAircraftCount,
      unscheduledTaskCount,
      rmqGroundHoursToday: round1(rmqGroundHoursToday),
      khhGroundHoursToday: round1(khhGroundHoursToday),
      tpeGroundHoursToday: round1(tpeGroundHoursToday),
    },
    capacitySettings: { yellowThreshold: settings.yellow_threshold, redThreshold: settings.red_threshold },
  };
}

export async function createGroundWindow(supabase: DB, values: GroundWindowValues, currentUserId: string) {
  const row = await groundWindowsRepo.createWindow(supabase, {
    aircraft_registration: values.aircraft_registration,
    station: values.station as Station,
    arrival_at: values.arrival_at,
    departure_at: values.departure_at,
    notes: values.notes || null,
    source: "manual",
    created_by: currentUserId,
    current_status: (values.current_status || null) as AircraftCurrentStatus | null,
    major_work_planned: values.major_work_planned || null,
    estimated_mh: values.estimated_mh ?? null,
    required_skill: values.required_skill || null,
    required_equipment: values.required_equipment || null,
    required_authorization: values.required_authorization || null,
    planning_status: (values.planning_status || null) as MajorWorkPlanningStatus | null,
    shift: (values.shift || null) as WorkShift | null,
  });
  if (values.linked_task_ids !== undefined) {
    await tasksRepo.setLinkedTasksForWindow(supabase, row.id, values.linked_task_ids);
  }
  const aircraft = await planningLookupsRepo.findFleetAircraftByRegistration(supabase, row.aircraft_registration);
  return toBoardWindow(row, aircraft?.aircraft_type);
}

export async function updateGroundWindow(supabase: DB, id: string, values: GroundWindowUpdateValues) {
  // 只要有人打開來儲存過（不論實際改了什麼），就當作已經看過、處理過這筆
  // 「航線異動，請確認」的提醒——不用另外做一個「確認」按鈕。
  const patch: Database["taskflow"]["Tables"]["aircraft_ground_windows"]["Update"] = { needs_confirmation: false };
  if (values.aircraft_registration !== undefined) patch.aircraft_registration = values.aircraft_registration;
  if (values.station !== undefined) patch.station = values.station as Station;
  if (values.arrival_at !== undefined) patch.arrival_at = values.arrival_at;
  if (values.departure_at !== undefined) patch.departure_at = values.departure_at;
  if (values.notes !== undefined) patch.notes = values.notes || null;
  if (values.current_status !== undefined)
    patch.current_status = (values.current_status || null) as AircraftCurrentStatus | null;
  if (values.major_work_planned !== undefined) patch.major_work_planned = values.major_work_planned || null;
  if (values.estimated_mh !== undefined) patch.estimated_mh = values.estimated_mh ?? null;
  if (values.required_skill !== undefined) patch.required_skill = values.required_skill || null;
  if (values.required_equipment !== undefined) patch.required_equipment = values.required_equipment || null;
  if (values.required_authorization !== undefined) patch.required_authorization = values.required_authorization || null;
  if (values.planning_status !== undefined)
    patch.planning_status = (values.planning_status || null) as MajorWorkPlanningStatus | null;
  if (values.shift !== undefined) patch.shift = (values.shift || null) as WorkShift | null;
  const row = await groundWindowsRepo.updateWindow(supabase, id, patch);
  if (values.linked_task_ids !== undefined) {
    await tasksRepo.setLinkedTasksForWindow(supabase, id, values.linked_task_ids);
  }
  const aircraft = await planningLookupsRepo.findFleetAircraftByRegistration(supabase, row.aircraft_registration);
  return toBoardWindow(row, aircraft?.aircraft_type);
}

export async function deleteGroundWindow(supabase: DB, id: string) {
  await groundWindowsRepo.deleteWindow(supabase, id);
}

// --- Ground window change log (re-import history) ---------------------------

export type GroundWindowChangeLogEntry = {
  id: string;
  groundWindowId: string;
  aircraftRegistration: string;
  station: Station;
  changeType: "time_changed" | "orphaned";
  oldArrivalAt: string;
  oldDepartureAt: string;
  newArrivalAt: string | null;
  newDepartureAt: string | null;
  planSnapshot: { majorWorkPlanned: string | null; shift: string | null; estimatedMh: number | null };
  // 執行這次匯入的使用者——目前只有兩位可編輯者，異動紀錄要看得出來是誰動的。
  // null 代表那個帳號後來被刪除了（紀錄本身不會因此消失）。
  changedBy: { id: string; name: string | null; email: string } | null;
  createdAt: string;
};

function toChangeLogEntry(
  row: Awaited<ReturnType<typeof changeLogRepo.findRecentChangeLog>>[number]
): GroundWindowChangeLogEntry {
  const snapshot = (row.plan_snapshot ?? {}) as Record<string, unknown>;
  const changedByUser = row.changed_by_user;
  return {
    id: row.id,
    groundWindowId: row.ground_window_id,
    aircraftRegistration: row.aircraft_registration,
    station: row.station,
    changeType: row.change_type,
    oldArrivalAt: row.old_arrival_at,
    oldDepartureAt: row.old_departure_at,
    newArrivalAt: row.new_arrival_at,
    newDepartureAt: row.new_departure_at,
    planSnapshot: {
      majorWorkPlanned: (snapshot.major_work_planned as string | null) ?? null,
      shift: (snapshot.shift as string | null) ?? null,
      estimatedMh: (snapshot.estimated_mh as number | null) ?? null,
    },
    changedBy: changedByUser ? { id: changedByUser.id, name: changedByUser.name, email: changedByUser.email } : null,
    createdAt: row.created_at,
  };
}

/** 單一地停的異動歷史——編輯視窗裡的「異動紀錄」用。 */
export async function getGroundWindowChangeLog(supabase: DB, groundWindowId: string): Promise<GroundWindowChangeLogEntry[]> {
  const rows = await changeLogRepo.findChangeLogForWindow(supabase, groundWindowId);
  return rows.map(toChangeLogEntry);
}

/** 全機隊最近的異動紀錄——看板工具列的「異動紀錄」列表用。 */
export async function getRecentGroundWindowChangeLog(supabase: DB): Promise<GroundWindowChangeLogEntry[]> {
  const rows = await changeLogRepo.findRecentChangeLog(supabase);
  return rows.map(toChangeLogEntry);
}

// --- Capacity Warning settings -----------------------------------------------

export async function getBoardSettings(supabase: DB) {
  const row = await boardSettingsRepo.getSettings(supabase);
  return { yellowThreshold: row.yellow_threshold, redThreshold: row.red_threshold };
}

export async function updateBoardSettings(supabase: DB, values: PlanningBoardSettingsValues, currentUserId: string) {
  const row = await boardSettingsRepo.updateSettings(
    supabase,
    { yellow_threshold: values.yellow_threshold, red_threshold: values.red_threshold },
    currentUserId
  );
  return { yellowThreshold: row.yellow_threshold, redThreshold: row.red_threshold };
}

// --- Task ↔ ground-window linking --------------------------------------------

export async function getLinkableTasks(supabase: DB) {
  const rows = await tasksRepo.findTodoTasksForLinking(supabase);
  return rows.map((r) => ({
    id: r.id,
    taskNumber: r.task_number,
    title: r.title,
    linkedGroundWindowId: r.linked_ground_window_id,
  }));
}

// --- Schedule file import ---------------------------------------------------

export type ImportedRow = {
  aircraft_registration: string;
  station: string | null;
  arrival_at: string | null;
  departure_at: string | null;
  notes: string | null;
  // Optional — most schedule exports won't have this column, but a
  // maintenance/ops export sometimes carries a ready-made "check remark" per
  // ground event, which maps straight onto Planning Information's 計畫大工項目
  // instead of getting lumped into 備註.
  major_work_planned: string | null;
};

/** One already-planned ground window that a re-import touched — either its
 * time moved to match the new schedule, or the new schedule no longer has a
 * matching stop for it at all (needsConfirmation gets set on the row). Shown
 * to whoever ran the import so a plan change never happens unnoticed. */
export type AffectedPlanWindow = {
  id: string;
  aircraftRegistration: string;
  station: Station;
  changeType: "time_changed" | "orphaned";
  oldArrivalAt: string;
  oldDepartureAt: string;
  newArrivalAt: string | null;
  newDepartureAt: string | null;
};

export type ImportResult = {
  imported: number;
  skipped: { row: number; reason: string }[];
  affectedPlanWindows: AffectedPlanWindow[];
};

const HEADER_ALIASES: Record<string, keyof ImportedRow> = {
  "機號": "aircraft_registration",
  "aircraft_registration": "aircraft_registration",
  "registration": "aircraft_registration",
  "aircraft": "aircraft_registration",
  "站別": "station",
  "station": "station",
  // "Dep" — a flight-ops export's departure-station column. For a genuine
  // ground/maintenance event (see ARRIVAL_STATION_HEADERS below) this is the
  // one station the aircraft actually sits at the whole time.
  "dep": "station",
  "進站時間": "arrival_at",
  "進站": "arrival_at",
  "arrival": "arrival_at",
  "arrival_at": "arrival_at",
  // "STD" (Scheduled Time of Departure) — for a real flight this is when it
  // pushes back; for a ground/maintenance pseudo-flight (Dep === Arr) it's
  // when the aircraft goes down for that event, i.e. our window's start.
  "std": "arrival_at",
  "離站時間": "departure_at",
  "離站": "departure_at",
  "departure": "departure_at",
  "departure_at": "departure_at",
  // "STA" (Scheduled Time of Arrival) — the mirror of STD: for a ground event
  // this is when the aircraft comes back up, i.e. our window's end.
  "sta": "departure_at",
  "備註": "notes",
  "notes": "notes",
  "remark": "notes",
  "remarks": "notes",
  // Ops-export "Flight" column holds a short code (a real flight number, or
  // AD/AWS/LTM/LM/A/AOG for a ground/maintenance event) — worth keeping as a
  // short tag even though the real description comes from Check Remark.
  "flight": "notes",
  "計畫大工項目": "major_work_planned",
  "大工項目": "major_work_planned",
  "major_work_planned": "major_work_planned",
  "major work": "major_work_planned",
  "check remark": "major_work_planned",
};

/** A flight-ops export has separate departure/arrival station columns per
 * leg — almost all of them real flights to somewhere else entirely, mixed in
 * with a handful of ground/maintenance "pseudo-flights" that never actually
 * leave the station (Dep === Arr). When one of these headers is present,
 * parseImportFile keeps only the rows where the two match: that is exactly
 * what "ground time" means, and it's what lets her upload a raw ops export
 * (mostly revenue flights to international stations) without pre-filtering
 * it herself first. */
const ARRIVAL_STATION_HEADERS = new Set([
  "actual arrival airport",
  "arrival airport",
  "arr airport",
  "arr ap",
  "到達站",
  "抵達站",
]);

/** Matches a registration regardless of how the source file punctuates it —
 * "B-58552", "B58552", "B 58552" all resolve to the same fleet aircraft. */
function normalizeRegistration(reg: string): string {
  return reg.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function normalizeHeader(raw: string) {
  return raw.trim().toLowerCase();
}

/** OPS-export STD/STA times are Zulu (UTC) — standard aviation-ops
 * convention — but every ground window in this feature is otherwise entered
 * and displayed as a plain, never-timezone-converted wall-clock value (see
 * the manual entry dialog's isoToLocalInput/localInputToIso, and dateKeyOf
 * below). So a parsed OPS time is shifted here, once, from Zulu to Taipei
 * local (UTC+8, no DST) before it enters that "plain digits" convention —
 * everything downstream (overnight/turnaround day-boundary comparisons,
 * on-screen display) then works in Taipei wall-clock terms without knowing
 * anything about timezones. */
function zuluToTaipeiLocal(zuluIso: string): string {
  return new Date(new Date(zuluIso).getTime() + 8 * 60 * 60 * 1000).toISOString();
}

/** Accepts an Excel serial date, a JS Date (exceljs already returns UTC-based
 * Date objects for date-formatted cells), or a "YYYY-MM-DD HH:mm"-shaped
 * string — and always returns a plain (no-timezone-shift) ISO string, same
 * convention as the manual entry dialog's datetime-local input, after
 * shifting the source Zulu time to Taipei local. */
function parseDateTimeCell(raw: unknown): string | null {
  if (raw instanceof Date) return zuluToTaipeiLocal(raw.toISOString());
  if (typeof raw === "number") {
    const ms = Math.round((raw - 25569) * 86400 * 1000); // Excel serial → epoch
    return zuluToTaipeiLocal(new Date(ms).toISOString());
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})/);
    if (!m) return null;
    const [, y, mo, d, h, mi] = m;
    const rawIso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:00.000Z`;
    return zuluToTaipeiLocal(rawIso);
  }
  return null;
}

function cellToString(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return raw.toISOString();
  return String(raw).trim();
}

/** Most exports are UTF-8, but a raw ops-system export is often Big5
 * (Traditional Chinese, the common Windows encoding for Taiwan airline ops
 * systems). Big5 is ASCII-compatible for the plain columns (registration,
 * station codes, timestamps), so a file read as UTF-8 by mistake still
 * "works" — except every Chinese remark (Check Remark, 計畫大工項目) comes
 * out as U+FFFD replacement characters, silently corrupting exactly the
 * free-text field this import cares most about. Detect that and re-decode
 * as Big5 instead of trusting the file's stated MIME type. */
function decodeFileText(buffer: Buffer): string {
  const utf8Text = buffer.toString("utf-8");
  if (!utf8Text.includes(" ")) return utf8Text;
  try {
    return new TextDecoder("big5").decode(buffer);
  } catch {
    return utf8Text;
  }
}

function findColumnIndex(headerRow: unknown[], names: string[]): number {
  return headerRow.findIndex((h) => names.includes(normalizeHeader(cellToString(h))));
}

/** Minimal RFC4180-ish CSV line splitter — handles quoted fields containing
 * commas, no external dependency needed for something this small. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Parses an uploaded schedule file (.xlsx or .csv) into raw rows keyed by
 * our canonical field names, using a fairly forgiving set of header aliases
 * (機號/registration, 站別/station, 進站/arrival, 離站/departure, 備註/notes)
 * since real-world schedule exports rarely use the same column names twice.
 * Also understands a raw flight-ops export directly (Registration/Dep/STD/
 * STA/Check Remark, plus an arrival-airport column) — when it sees a
 * distinct arrival-station column it keeps only the rows where departure and
 * arrival station match (a ground/maintenance event, not a real flight to
 * somewhere else), so she can upload the export as-is without pre-filtering
 * out the hundreds of ordinary revenue flights herself. */
export async function parseImportFile(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
  longHaulRegistrations: ReadonlySet<string> = new Set()
): Promise<ImportedRow[]> {
  const isCsv = mimeType === "text/csv" || fileName.toLowerCase().endsWith(".csv");

  let headerRow: unknown[];
  let dataRows: unknown[][];

  if (isCsv) {
    const text = decodeFileText(fileBuffer).replace(/^﻿/, "");
    const rows = parseCsv(text);
    if (rows.length < 1) return [];
    headerRow = rows[0];
    dataRows = rows.slice(1);
  } else {
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(fileBuffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const rows: unknown[][] = [];
    sheet.eachRow((row) => {
      rows.push((row.values as unknown[]).slice(1));
    });
    if (rows.length < 1) return [];
    headerRow = rows[0];
    dataRows = rows.slice(1);
  }

  const columnMap: (keyof ImportedRow | null)[] = headerRow.map((h) => {
    const key = normalizeHeader(cellToString(h));
    return HEADER_ALIASES[key] ?? null;
  });
  // A distinct arrival-station column (separate from Dep/station) means this
  // looks like a raw flight-ops export rather than an already-filtered
  // ground-window sheet — see ARRIVAL_STATION_HEADERS.
  const arrivalStationColumnIndex = headerRow.findIndex((h) => ARRIVAL_STATION_HEADERS.has(normalizeHeader(cellToString(h))));

  const parsedRows = dataRows.map((row) => {
    const parsed: ImportedRow = {
      aircraft_registration: "",
      station: null,
      arrival_at: null,
      departure_at: null,
      notes: null,
      major_work_planned: null,
    };
    columnMap.forEach((field, i) => {
      if (!field) return;
      const raw = row[i];
      if (field === "arrival_at" || field === "departure_at") {
        parsed[field] = parseDateTimeCell(raw);
      } else if (field === "aircraft_registration") {
        parsed.aircraft_registration = cellToString(raw).toUpperCase();
      } else if (field === "station") {
        parsed.station = cellToString(raw).toUpperCase() || null;
      } else if (field === "major_work_planned") {
        parsed.major_work_planned = cellToString(raw) || null;
      } else {
        parsed.notes = cellToString(raw) || null;
      }
    });
    return parsed;
  });

  if (arrivalStationColumnIndex === -1) return parsedRows;

  return deriveOpsExportGroundWindows(headerRow, dataRows, arrivalStationColumnIndex, longHaulRegistrations) ?? parsedRows;
}

/** Registrations for the long-haul fleet (A359/A351), normalized the same
 * way as everywhere else that matches an ops-export registration against
 * fleet_master — used to scope the "day stop" rule in
 * deriveOpsExportGroundWindows to the only aircraft whose schedule can
 * actually produce one. */
export async function findLongHaulRegistrations(supabase: DB): Promise<Set<string>> {
  const fleet = await planningLookupsRepo.findAllFleet(supabase, ["A359", "A351"]);
  return new Set(fleet.map((f) => normalizeRegistration(f.aircraft_registration)));
}

type OpsMovement = {
  registration: string;
  depStation: string;
  arrStation: string;
  std: string | null;
  sta: string | null;
  /** Dep === Arr: the aircraft never actually left — a maintenance/ground
   * pseudo-flight rather than a real one. */
  isGroundEvent: boolean;
  flightCode: string;
  remark: string | null;
};

/**
 * Turns a raw ops export into three kinds of rows, kept deliberately
 * separate so the board can show and colour them differently:
 *
 * 1. Overnight ground time — "過夜地停". Walks each aircraft's real flights
 *    (Dep !== Arr) in chronological order and looks at the gap between
 *    landing on one and departing on the next at a home station (TPE/TSA/
 *    RMQ/KHH). Gaps that cross a calendar-day boundary become a row: that's
 *    exactly "came back to TPE/RMQ and didn't go out again until the next
 *    day".
 * 2. Day stops — "日間長地停". Every route used to come back and go out
 *    again the same day, so a same-day gap was never worth keeping — it was
 *    just an ordinary turnaround between two legs. The long-haul fleet
 *    (A359/A351) breaks that: a US/Europe rotation can land early morning
 *    and not leave again until evening, hours later but still the same
 *    calendar day. A same-day gap only becomes a row when the aircraft is in
 *    `longHaulRegistrations` AND the gap is at least DAY_STOP_MIN_MINUTES —
 *    toBoardWindow re-derives the same threshold from the stored
 *    arrival/departure to flag it on the board (isDayStop), so nothing about
 *    "which rows are day stops" needs to be persisted separately.
 * 3. Scheduled work items — "已排定的計畫工作". Every Dep===Arr row
 *    (AD/AWS/LTM/A/HMV/…) that has a Check Remark describing the work
 *    becomes its own row, using that row's own STD/STA exactly as given —
 *    never folded into an overnight/day-stop window's time range, so its
 *    real scheduled start/end stays visible and it can be coloured
 *    differently from plain ground time on the board. A ground-event row
 *    with no remark (just a bare code) carries nothing worth showing on its
 *    own and is skipped.
 */
function deriveOpsExportGroundWindows(
  headerRow: unknown[],
  dataRows: unknown[][],
  arrivalStationColumnIndex: number,
  longHaulRegistrations: ReadonlySet<string>
): ImportedRow[] | null {
  const registrationIdx = findColumnIndex(headerRow, ["機號", "aircraft_registration", "registration", "aircraft"]);
  const depIdx = findColumnIndex(headerRow, ["dep"]);
  const stdIdx = findColumnIndex(headerRow, ["std"]);
  const staIdx = findColumnIndex(headerRow, ["sta"]);
  if (registrationIdx === -1 || depIdx === -1 || stdIdx === -1 || staIdx === -1) return null;
  const flightIdx = findColumnIndex(headerRow, ["flight"]);
  const remarkIdx = findColumnIndex(headerRow, ["check remark", "計畫大工項目", "大工項目", "major_work_planned", "major work"]);

  const movements: OpsMovement[] = dataRows
    .map((row): OpsMovement => {
      const registration = cellToString(row[registrationIdx]).toUpperCase();
      const depStation = cellToString(row[depIdx]).toUpperCase();
      const arrStation = cellToString(row[arrivalStationColumnIndex]).toUpperCase();
      return {
        registration,
        depStation,
        arrStation,
        std: parseDateTimeCell(row[stdIdx]),
        sta: parseDateTimeCell(row[staIdx]),
        isGroundEvent: !!depStation && depStation === arrStation,
        flightCode: flightIdx === -1 ? "" : cellToString(row[flightIdx]),
        remark: remarkIdx === -1 ? null : cellToString(row[remarkIdx]) || null,
      };
    })
    .filter((m) => m.registration && m.depStation && m.arrStation && m.std && m.sta);

  const HOME_STATIONS = new Set<string>(STATIONS);

  const realFlightsByReg = new Map<string, OpsMovement[]>();
  for (const m of movements) {
    if (m.isGroundEvent) continue;
    const key = normalizeRegistration(m.registration);
    const list = realFlightsByReg.get(key);
    if (list) list.push(m);
    else realFlightsByReg.set(key, [m]);
  }

  const groundTimeRows: ImportedRow[] = [];
  for (const [regKey, list] of realFlightsByReg) {
    list.sort((a, b) => (a.std! < b.std! ? -1 : a.std! > b.std! ? 1 : 0));
    for (let i = 0; i < list.length - 1; i++) {
      const cur = list[i];
      const next = list[i + 1];
      // Chain broken (a gap in the export, or a positioning leg we can't
      // see) — can't tell where the aircraft actually sat, so skip rather
      // than guess.
      if (cur.arrStation !== next.depStation) continue;
      const station = cur.arrStation;
      if (!HOME_STATIONS.has(station)) continue;
      if (!(next.std! > cur.sta!)) continue; // zero/negative gap — schedule overlap or duplicate row
      if (dateKeyOf(cur.sta!) === dateKeyOf(next.std!)) {
        // Same-day turnaround — worth a row only for the long-haul fleet's
        // day-stop pattern (see doc comment above); an ordinary short
        // same-day gap on any other aircraft is never kept.
        const gapMinutes = (new Date(next.std!).getTime() - new Date(cur.sta!).getTime()) / 60000;
        if (!longHaulRegistrations.has(regKey) || gapMinutes < DAY_STOP_MIN_MINUTES) continue;
      }
      groundTimeRows.push({
        aircraft_registration: cur.registration,
        station,
        arrival_at: cur.sta,
        departure_at: next.std,
        notes: null,
        major_work_planned: null,
      });
    }
  }

  const workItemRows: ImportedRow[] = movements
    .filter((m) => m.isGroundEvent && HOME_STATIONS.has(m.arrStation) && m.remark)
    .map((ge) => ({
      aircraft_registration: ge.registration,
      station: ge.arrStation,
      arrival_at: ge.std,
      departure_at: ge.sta,
      notes: ge.flightCode || null,
      major_work_planned: ge.remark,
    }));

  return [...groundTimeRows, ...workItemRows];
}

/**
 * Validates + bulk-inserts parsed rows. Every row is checked independently
 * so one bad row doesn't sink the whole file — `skipped` reports why each
 * one didn't make it in, 1-indexed to match what she'd see counting rows in
 * Excel (row 1 = header, so the first data row is reported as row 2).
 *
 * Before inserting, clears out each affected aircraft's stale *imported*
 * ground windows that fall inside this file's date range (see
 * deleteStaleImportWindows) — schedules change often, so re-importing the
 * same days needs to REPLACE the old computed windows with the corrected
 * ones, not pile new ones on top. A window she's since added Planning
 * Information to is left alone even if it's now stale, since her plan
 * matters more than the exact timestamps; a window she built by hand
 * (source = 'manual') is never touched by this at all.
 */
/** Does this row (raw DB shape, snake_case) have ANY Planning Information
 * filled in? Used by the re-import flow to decide whether a schedule change
 * needs to preserve + update it (this) or can just be silently replaced like
 * any other computed window (deleteStaleImportWindows already handles that
 * case for windows where every one of these is still empty). */
function hasPlanningInfo(row: {
  major_work_planned: string | null;
  shift: string | null;
  current_status: string | null;
  estimated_mh: number | null;
  required_skill: string | null;
  required_equipment: string | null;
  required_authorization: string | null;
  planning_status: string | null;
}): boolean {
  return (
    !!(row.major_work_planned && row.major_work_planned.trim()) ||
    row.shift != null ||
    row.current_status != null ||
    row.estimated_mh != null ||
    !!(row.required_skill && row.required_skill.trim()) ||
    !!(row.required_equipment && row.required_equipment.trim()) ||
    !!(row.required_authorization && row.required_authorization.trim()) ||
    row.planning_status != null
  );
}

/** A snapshot of the Planning Information fields worth remembering in a
 * change-log entry — just enough to show "what was planned at the time",
 * not a full duplicate of the row (the row itself still holds the live,
 * possibly since-edited values). */
function planSnapshotOf(row: { major_work_planned: string | null; shift: string | null; estimated_mh: number | null }) {
  return { major_work_planned: row.major_work_planned, shift: row.shift, estimated_mh: row.estimated_mh };
}

/** Finds the closest not-yet-claimed candidate in `candidates` for the same
 * aircraft + station within PLAN_MATCH_TOLERANCE_MS of `targetArrivalIso` —
 * i.e. "which of this file's freshly computed ground windows is probably the
 * same stop as this already-planned one, just at an updated time". Returns
 * -1 when nothing is close enough, meaning the schedule no longer has a
 * matching stop at all. */
function findBestCandidateIndex(
  candidates: Database["taskflow"]["Tables"]["aircraft_ground_windows"]["Insert"][],
  aircraftRegistration: string,
  station: string,
  targetArrivalIso: string
): number {
  let bestIdx = -1;
  let bestDiff = Infinity;
  candidates.forEach((c, idx) => {
    if (c.aircraft_registration !== aircraftRegistration || c.station !== station) return;
    const diff = Math.abs(new Date(c.arrival_at as string).getTime() - new Date(targetArrivalIso).getTime());
    if (diff <= PLAN_MATCH_TOLERANCE_MS && diff < bestDiff) {
      bestDiff = diff;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

export async function importGroundWindows(supabase: DB, rows: ImportedRow[], currentUserId: string): Promise<ImportResult> {
  const fleet = await planningLookupsRepo.findAllFleet(supabase);
  // Keyed by a punctuation-stripped registration so "B58552" (a common ops-
  // export style) still matches fleet_master's "B-58552".
  const fleetByReg = new Map(fleet.map((f) => [normalizeRegistration(f.aircraft_registration), f]));

  const toInsert: Database["taskflow"]["Tables"]["aircraft_ground_windows"]["Insert"][] = [];
  const skipped: { row: number; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // +1 for header, +1 for 1-indexing
    const aircraft = row.aircraft_registration ? fleetByReg.get(normalizeRegistration(row.aircraft_registration)) : undefined;
    if (!row.aircraft_registration) {
      skipped.push({ row: rowNumber, reason: "缺少機號" });
      return;
    }
    if (!aircraft) {
      skipped.push({ row: rowNumber, reason: `機號 ${row.aircraft_registration} 不在機隊清單中` });
      return;
    }
    if (!row.arrival_at) {
      skipped.push({ row: rowNumber, reason: "進站時間格式無法辨識" });
      return;
    }
    if (!row.departure_at) {
      skipped.push({ row: rowNumber, reason: "離站時間格式無法辨識" });
      return;
    }
    if (new Date(row.departure_at).getTime() <= new Date(row.arrival_at).getTime()) {
      skipped.push({ row: rowNumber, reason: "離站時間必須晚於進站時間" });
      return;
    }
    const station = row.station && (STATIONS as string[]).includes(row.station) ? (row.station as Station) : aircraft.station;

    toInsert.push({
      aircraft_registration: aircraft.aircraft_registration,
      station,
      arrival_at: row.arrival_at,
      departure_at: row.departure_at,
      notes: row.notes,
      major_work_planned: row.major_work_planned,
      source: "import",
      created_by: currentUserId,
    });
  });

  // Before inserting, clear out each affected aircraft's stale *imported*
  // ground windows that fall inside this file's date range (see
  // deleteStaleImportWindows) — otherwise a daily re-import would just pile
  // corrected rows on top of the old ones instead of replacing them.
  //
  // The range used per aircraft is the FILE'S overall min/max (across every
  // row, every aircraft), not just that one aircraft's own new rows. An
  // aircraft's earliest new window can start later in the day than an old
  // stale window that's since been superseded (e.g. a same-day turnaround
  // from a previous, different-shaped import) — using only that aircraft's
  // own range would leave such rows behind uncleared.
  const affectedAircraft = new Set(toInsert.map((row) => row.aircraft_registration));
  let fileStart: string | null = null;
  let fileEnd: string | null = null;
  for (const row of toInsert) {
    if (fileStart === null || row.arrival_at < fileStart) fileStart = row.arrival_at;
    if (fileEnd === null || row.departure_at > fileEnd) fileEnd = row.departure_at;
  }
  // Aircraft schedules change constantly, so a re-import should carry an
  // already-*planned* window's time forward to match the new schedule rather
  // than leaving it stuck on stale times (the old behaviour) — but her plan
  // itself (major_work_planned, shift, etc.) must never silently vanish, so
  // every touch here is recorded to ground_window_change_log first. Windows
  // with no Planning Information at all are unaffected by this and keep
  // going through the plain delete-and-replace path below.
  const affectedPlanWindows: AffectedPlanWindow[] = [];
  if (fileStart !== null && fileEnd !== null) {
    for (const aircraftRegistration of affectedAircraft) {
      const existingWindows = await groundWindowsRepo.findWindowsInRange(supabase, aircraftRegistration, fileStart, fileEnd);
      for (const oldRow of existingWindows) {
        if (!hasPlanningInfo(oldRow)) continue;

        const candidateIdx = findBestCandidateIndex(toInsert, oldRow.aircraft_registration, oldRow.station, oldRow.arrival_at);
        if (candidateIdx !== -1) {
          const candidate = toInsert[candidateIdx];
          // 不管時間有沒有異動，這個新班次都已經被這筆舊資料代表了，不用
          // 再另外插入一筆——直接從候選清單移除。
          toInsert.splice(candidateIdx, 1);
          const sameTimes = candidate.arrival_at === oldRow.arrival_at && candidate.departure_at === oldRow.departure_at;
          if (!sameTimes) {
            await groundWindowsRepo.updateWindow(supabase, oldRow.id, {
              arrival_at: candidate.arrival_at,
              departure_at: candidate.departure_at,
              needs_confirmation: false,
            });
            await changeLogRepo.insertChangeLogEntries(supabase, [
              {
                ground_window_id: oldRow.id,
                aircraft_registration: oldRow.aircraft_registration,
                station: oldRow.station,
                change_type: "time_changed",
                old_arrival_at: oldRow.arrival_at,
                old_departure_at: oldRow.departure_at,
                new_arrival_at: candidate.arrival_at as string,
                new_departure_at: candidate.departure_at as string,
                plan_snapshot: planSnapshotOf(oldRow),
                changed_by: currentUserId,
              },
            ]);
            affectedPlanWindows.push({
              id: oldRow.id,
              aircraftRegistration: oldRow.aircraft_registration,
              station: oldRow.station,
              changeType: "time_changed",
              oldArrivalAt: oldRow.arrival_at,
              oldDepartureAt: oldRow.departure_at,
              newArrivalAt: candidate.arrival_at as string,
              newDepartureAt: candidate.departure_at as string,
            });
          } else if (oldRow.needs_confirmation) {
            // 時間跟以前一樣，但之前被標記過需要確認——這次又對上了，順手清掉。
            await groundWindowsRepo.updateWindow(supabase, oldRow.id, { needs_confirmation: false });
          }
        } else if (!oldRow.needs_confirmation) {
          // 新班表裡完全找不到對應的班次——保留舊地停跟計畫內容，只標記需要
          // 人工確認（已經標記過的就不用重複提醒，避免同一筆每天都跳出來）。
          await groundWindowsRepo.updateWindow(supabase, oldRow.id, { needs_confirmation: true });
          await changeLogRepo.insertChangeLogEntries(supabase, [
            {
              ground_window_id: oldRow.id,
              aircraft_registration: oldRow.aircraft_registration,
              station: oldRow.station,
              change_type: "orphaned",
              old_arrival_at: oldRow.arrival_at,
              old_departure_at: oldRow.departure_at,
              new_arrival_at: null,
              new_departure_at: null,
              plan_snapshot: planSnapshotOf(oldRow),
              changed_by: currentUserId,
            },
          ]);
          affectedPlanWindows.push({
            id: oldRow.id,
            aircraftRegistration: oldRow.aircraft_registration,
            station: oldRow.station,
            changeType: "orphaned",
            oldArrivalAt: oldRow.arrival_at,
            oldDepartureAt: oldRow.departure_at,
            newArrivalAt: null,
            newDepartureAt: null,
          });
        }
      }
    }
  }

  if (fileStart !== null && fileEnd !== null) {
    await Promise.all(
      Array.from(affectedAircraft).map((aircraftRegistration) =>
        groundWindowsRepo.deleteStaleImportWindows(supabase, aircraftRegistration, fileStart!, fileEnd!)
      )
    );
  }

  // Chunk to stay well under typical request/payload limits on a big file.
  const CHUNK_SIZE = 500;
  let imported = 0;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const created = await groundWindowsRepo.createWindows(supabase, chunk);
    imported += created.length;
  }

  return { imported, skipped, affectedPlanWindows };
}
