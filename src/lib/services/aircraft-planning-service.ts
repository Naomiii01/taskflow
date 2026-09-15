import "server-only";

import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  AircraftType,
  Station,
  AircraftCurrentStatus,
  MajorWorkPlanningStatus,
} from "@/types/database.types";
import { STATIONS } from "@/lib/constants";
import * as groundWindowsRepo from "@/lib/repositories/aircraft-ground-windows-repository";
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
  notes: string | null;
  // Planning Information — all null when no major work is planned for this stay.
  currentStatus: AircraftCurrentStatus | null;
  majorWorkPlanned: string | null;
  estimatedMh: number | null;
  requiredSkill: string | null;
  requiredEquipment: string | null;
  requiredAuthorization: string | null;
  planningStatus: MajorWorkPlanningStatus | null;
};

export type PlanningBoardAircraft = {
  aircraftRegistration: string;
  aircraftType: AircraftType;
  homeStation: Station;
  windows: PlanningBoardWindow[];
};

export type DailyCapacity = {
  date: string;
  majorWorkCount: number;
  mhTotal: number;
  rmqAircraftCount: number;
  khhAircraftCount: number;
  tpeAircraftCount: number;
};

export type DashboardSummary = {
  todayMajorWorkCount: number;
  weekMajorWorkCount: number;
  rmqResidentCount: number;
  khhResidentCount: number;
  overnightAircraftCount: number;
  unscheduledTaskCount: number;
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

function toBoardWindow(row: Awaited<ReturnType<typeof groundWindowsRepo.findWindowsOverlapping>>[number]): PlanningBoardWindow {
  const groundTimeMinutes = Math.round(
    (new Date(row.departure_at).getTime() - new Date(row.arrival_at).getTime()) / 60000
  );
  return {
    id: row.id,
    station: row.station,
    arrivalAt: row.arrival_at,
    departureAt: row.departure_at,
    groundTimeMinutes,
    isOvernight: dateKeyOf(row.arrival_at) !== dateKeyOf(row.departure_at),
    notes: row.notes,
    currentStatus: row.current_status,
    majorWorkPlanned: row.major_work_planned,
    estimatedMh: row.estimated_mh,
    requiredSkill: row.required_skill,
    requiredEquipment: row.required_equipment,
    requiredAuthorization: row.required_authorization,
    planningStatus: row.planning_status,
  };
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

  const [fleet, windows, todayWindows, weekWindows, settings, unscheduledTaskCount] = await Promise.all([
    planningLookupsRepo.findAllFleet(supabase),
    groundWindowsRepo.findWindowsOverlapping(supabase, start, end),
    groundWindowsRepo.findWindowsOverlapping(supabase, todayKey, nextDayKey),
    groundWindowsRepo.findWindowsOverlapping(supabase, weekStart, weekEnd),
    boardSettingsRepo.getSettings(supabase),
    tasksRepo.countUnscheduledTodoTasks(supabase),
  ]);

  const windowsByAircraft = new Map<string, PlanningBoardWindow[]>();
  for (const w of windows) {
    const boardWindow = toBoardWindow(w);
    const list = windowsByAircraft.get(w.aircraft_registration);
    if (list) list.push(boardWindow);
    else windowsByAircraft.set(w.aircraft_registration, [boardWindow]);
  }

  const aircraft: PlanningBoardAircraft[] = fleet
    .filter((f) => f.status === "Active")
    .map((f) => ({
      aircraftRegistration: f.aircraft_registration,
      aircraftType: f.aircraft_type,
      homeStation: f.station,
      windows: windowsByAircraft.get(f.aircraft_registration) ?? [],
    }));

  // Capacity Information — one bucket per visible day, tallied from every
  // window touching that day (a multi-day stay counts toward each day it
  // occupies, per dayKeysTouched — capacity is consumed on every day a big
  // job is in progress, not only the day it starts).
  const dailyMap = new Map<string, DailyCapacity>();
  for (const w of windows) {
    const boardWindow = toBoardWindow(w);
    for (const day of dayKeysTouched(boardWindow, start, end)) {
      let bucket = dailyMap.get(day);
      if (!bucket) {
        bucket = { date: day, majorWorkCount: 0, mhTotal: 0, rmqAircraftCount: 0, khhAircraftCount: 0, tpeAircraftCount: 0 };
        dailyMap.set(day, bucket);
      }
      if (hasMajorWork(boardWindow)) {
        bucket.majorWorkCount += 1;
        bucket.mhTotal += boardWindow.estimatedMh ?? 0;
      }
      if (w.station === "RMQ") bucket.rmqAircraftCount += 1;
      if (w.station === "KHH") bucket.khhAircraftCount += 1;
      if (w.station === "TPE") bucket.tpeAircraftCount += 1;
    }
  }
  const dailyCapacity = Array.from(dailyMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1));

  // Dashboard Summary.
  const todayEntries = todayWindows.map((w) => ({ reg: w.aircraft_registration, bw: toBoardWindow(w) }));
  const weekEntries = weekWindows.map((w) => ({ bw: toBoardWindow(w) }));
  const todayMajorWorkCount = todayEntries.filter((e) => hasMajorWork(e.bw)).length;
  const weekMajorWorkCount = weekEntries.filter((e) => hasMajorWork(e.bw)).length;
  const rmqResidentCount = new Set(todayWindows.filter((w) => w.station === "RMQ").map((w) => w.aircraft_registration)).size;
  const khhResidentCount = new Set(todayWindows.filter((w) => w.station === "KHH").map((w) => w.aircraft_registration)).size;
  const overnightAircraftCount = new Set(todayEntries.filter((e) => e.bw.isOvernight).map((e) => e.reg)).size;

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
  });
  if (values.linked_task_ids !== undefined) {
    await tasksRepo.setLinkedTasksForWindow(supabase, row.id, values.linked_task_ids);
  }
  return toBoardWindow(row);
}

export async function updateGroundWindow(supabase: DB, id: string, values: GroundWindowUpdateValues) {
  const patch: Database["taskflow"]["Tables"]["aircraft_ground_windows"]["Update"] = {};
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
  const row = await groundWindowsRepo.updateWindow(supabase, id, patch);
  if (values.linked_task_ids !== undefined) {
    await tasksRepo.setLinkedTasksForWindow(supabase, id, values.linked_task_ids);
  }
  return toBoardWindow(row);
}

export async function deleteGroundWindow(supabase: DB, id: string) {
  await groundWindowsRepo.deleteWindow(supabase, id);
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
};

export type ImportResult = {
  imported: number;
  skipped: { row: number; reason: string }[];
};

const HEADER_ALIASES: Record<string, keyof ImportedRow> = {
  "機號": "aircraft_registration",
  "aircraft_registration": "aircraft_registration",
  "registration": "aircraft_registration",
  "aircraft": "aircraft_registration",
  "站別": "station",
  "station": "station",
  "進站時間": "arrival_at",
  "進站": "arrival_at",
  "arrival": "arrival_at",
  "arrival_at": "arrival_at",
  "離站時間": "departure_at",
  "離站": "departure_at",
  "departure": "departure_at",
  "departure_at": "departure_at",
  "備註": "notes",
  "notes": "notes",
  "remark": "notes",
  "remarks": "notes",
};

function normalizeHeader(raw: string) {
  return raw.trim().toLowerCase();
}

/** Accepts an Excel serial date, a JS Date (exceljs already returns UTC-based
 * Date objects for date-formatted cells), or a "YYYY-MM-DD HH:mm"-shaped
 * string — and always returns a plain (no-timezone-shift) ISO string, same
 * convention as the manual entry dialog's datetime-local input. */
function parseDateTimeCell(raw: unknown): string | null {
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "number") {
    const ms = Math.round((raw - 25569) * 86400 * 1000); // Excel serial → epoch
    return new Date(ms).toISOString();
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})/);
    if (!m) return null;
    const [, y, mo, d, h, mi] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:00.000Z`;
  }
  return null;
}

function cellToString(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return raw.toISOString();
  return String(raw).trim();
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
 * since real-world schedule exports rarely use the same column names twice. */
export async function parseImportFile(fileBuffer: Buffer, mimeType: string, fileName: string): Promise<ImportedRow[]> {
  const isCsv = mimeType === "text/csv" || fileName.toLowerCase().endsWith(".csv");

  let headerRow: unknown[];
  let dataRows: unknown[][];

  if (isCsv) {
    const text = fileBuffer.toString("utf-8").replace(/^﻿/, "");
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

  return dataRows.map((row) => {
    const parsed: ImportedRow = { aircraft_registration: "", station: null, arrival_at: null, departure_at: null, notes: null };
    columnMap.forEach((field, i) => {
      if (!field) return;
      const raw = row[i];
      if (field === "arrival_at" || field === "departure_at") {
        parsed[field] = parseDateTimeCell(raw);
      } else if (field === "aircraft_registration") {
        parsed.aircraft_registration = cellToString(raw).toUpperCase();
      } else if (field === "station") {
        parsed.station = cellToString(raw).toUpperCase() || null;
      } else {
        parsed.notes = cellToString(raw) || null;
      }
    });
    return parsed;
  });
}

/**
 * Validates + bulk-inserts parsed rows. Every row is checked independently
 * so one bad row doesn't sink the whole file — `skipped` reports why each
 * one didn't make it in, 1-indexed to match what she'd see counting rows in
 * Excel (row 1 = header, so the first data row is reported as row 2).
 */
export async function importGroundWindows(supabase: DB, rows: ImportedRow[], currentUserId: string): Promise<ImportResult> {
  const fleet = await planningLookupsRepo.findAllFleet(supabase);
  const fleetByReg = new Map(fleet.map((f) => [f.aircraft_registration.toUpperCase(), f]));

  const toInsert: Database["taskflow"]["Tables"]["aircraft_ground_windows"]["Insert"][] = [];
  const skipped: { row: number; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // +1 for header, +1 for 1-indexing
    const aircraft = fleetByReg.get(row.aircraft_registration);
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
      source: "import",
      created_by: currentUserId,
    });
  });

  // Chunk to stay well under typical request/payload limits on a big file.
  const CHUNK_SIZE = 500;
  let imported = 0;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const created = await groundWindowsRepo.createWindows(supabase, chunk);
    imported += created.length;
  }

  return { imported, skipped };
}
