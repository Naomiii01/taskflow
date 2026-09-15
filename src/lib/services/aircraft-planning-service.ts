import "server-only";

import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, AircraftType, Station } from "@/types/database.types";
import { STATIONS } from "@/lib/constants";
import * as groundWindowsRepo from "@/lib/repositories/aircraft-ground-windows-repository";
import * as planningLookupsRepo from "@/lib/repositories/planning-lookups-repository";
import type { GroundWindowValues, GroundWindowUpdateValues } from "@/lib/validations/planning";

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
};

export type PlanningBoardAircraft = {
  aircraftRegistration: string;
  aircraftType: AircraftType;
  homeStation: Station;
  windows: PlanningBoardWindow[];
};

export type PlanningBoard = {
  start: string;
  end: string;
  aircraft: PlanningBoardAircraft[];
};

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
  };
}

/**
 * Aircraft Planning Board Lite: one row per active Fleet Master aircraft,
 * each carrying every ground-time window that overlaps [start, end).
 * `end` should be the day AFTER the board's last visible column (exclusive
 * upper bound) — the grid buckets a window into every day column it
 * touches client-side, since a window can span more than one day.
 */
export async function getPlanningBoard(supabase: DB, start: string, end: string): Promise<PlanningBoard> {
  const [fleet, windows] = await Promise.all([
    planningLookupsRepo.findAllFleet(supabase),
    groundWindowsRepo.findWindowsOverlapping(supabase, start, end),
  ]);

  const windowsByAircraft = new Map<string, PlanningBoardWindow[]>();
  for (const w of windows) {
    const boardWindow = toBoardWindow(w);
    const list = windowsByAircraft.get(w.aircraft_registration);
    if (list) list.push(boardWindow);
    else windowsByAircraft.set(w.aircraft_registration, [boardWindow]);
  }

  return {
    start,
    end,
    aircraft: fleet
      .filter((f) => f.status === "Active")
      .map((f) => ({
        aircraftRegistration: f.aircraft_registration,
        aircraftType: f.aircraft_type,
        homeStation: f.station,
        windows: windowsByAircraft.get(f.aircraft_registration) ?? [],
      })),
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
  });
  return toBoardWindow(row);
}

export async function updateGroundWindow(supabase: DB, id: string, values: GroundWindowUpdateValues) {
  const patch: Database["taskflow"]["Tables"]["aircraft_ground_windows"]["Update"] = {};
  if (values.aircraft_registration !== undefined) patch.aircraft_registration = values.aircraft_registration;
  if (values.station !== undefined) patch.station = values.station as Station;
  if (values.arrival_at !== undefined) patch.arrival_at = values.arrival_at;
  if (values.departure_at !== undefined) patch.departure_at = values.departure_at;
  if (values.notes !== undefined) patch.notes = values.notes || null;
  const row = await groundWindowsRepo.updateWindow(supabase, id, patch);
  return toBoardWindow(row);
}

export async function deleteGroundWindow(supabase: DB, id: string) {
  await groundWindowsRepo.deleteWindow(supabase, id);
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
