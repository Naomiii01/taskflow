import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";

export const ISO_DATE = "yyyy-MM-dd";

export function toIso(date: Date): string {
  return format(date, ISO_DATE);
}

/** Full 6-week grid for a month view (leading/trailing days from adjacent
 * months included), starting on Monday to match zh-TW convention. */
export function monthGridRange(anchor: Date) {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  return { start, end, days: eachDayOfInterval({ start, end }) };
}

export function weekRange(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = endOfWeek(anchor, { weekStartsOn: 1 });
  return { start, end, days: eachDayOfInterval({ start, end }) };
}

export function shiftAnchor(anchor: Date, view: "month" | "week" | "day" | "agenda" | "timeline", direction: 1 | -1) {
  if (view === "month" || view === "timeline") return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1);
  if (view === "week") return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
  return addDays(anchor, direction);
}

export const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
