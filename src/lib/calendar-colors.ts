import type { CalendarItem } from "@/types/domain";

/**
 * Calendar Color Rules — exactly the 5-row table from the Phase 5.5 spec,
 * applied in priority order (a KHH item is always Dusty Rose even if it's
 * also, say, a Supervisor-type item):
 *
 *   1. Station/Project = KHH  → Dusty Rose
 *   2. Station/Project = RMQ  → Soft Taupe
 *   3. Type = Supervisor      → Warm Beige
 *   4. Type = Waiting/Follow-up → Dusty Blue
 *   5. Type = Daily           → Sage Green
 *   (anything else — Meeting/Project/Monthly Plan/Long Hour/Short Term/
 *    Additional Work Card with no station override — gets a neutral tone.)
 *
 * The five named colors reuse the app's existing Morandi tokens 1:1 (Sage
 * Green = accent, Dusty Blue = primary, Warm Beige = secondary, Soft Taupe =
 * muted) so the calendar stays visually consistent with the rest of the app
 * without introducing a second palette; only "Dusty Rose" (KHH) needed a new
 * dedicated pair of CSS variables (--cal-rose / --cal-rose-foreground).
 */
export type CalendarColorKey = "sage" | "dusty-blue" | "warm-beige" | "soft-taupe" | "dusty-rose" | "neutral";

const COLOR_CLASSES: Record<CalendarColorKey, { bg: string; text: string; border: string }> = {
  sage: { bg: "bg-accent", text: "text-accent-foreground", border: "border-l-accent-foreground/40" },
  "dusty-blue": { bg: "bg-primary/15", text: "text-primary", border: "border-l-primary" },
  "warm-beige": { bg: "bg-secondary", text: "text-secondary-foreground", border: "border-l-secondary-foreground/40" },
  "soft-taupe": { bg: "bg-muted", text: "text-muted-foreground", border: "border-l-muted-foreground/40" },
  "dusty-rose": { bg: "bg-cal-rose", text: "text-cal-rose-foreground", border: "border-l-cal-rose-foreground/50" },
  neutral: { bg: "bg-card", text: "text-foreground", border: "border-l-border" },
};

const COLOR_LABELS: Record<CalendarColorKey, string> = {
  sage: "Sage Green · Daily",
  "dusty-blue": "Dusty Blue · Waiting/Follow-up",
  "warm-beige": "Warm Beige · Supervisor",
  "soft-taupe": "Soft Taupe · RMQ",
  "dusty-rose": "Dusty Rose · KHH",
  neutral: "一般",
};

export function calendarColorKey(item: Pick<CalendarItem, "station" | "projectCode" | "eventType">): CalendarColorKey {
  if (item.station === "KHH" || item.projectCode === "KHH") return "dusty-rose";
  if (item.station === "RMQ" || item.projectCode === "RMQ") return "soft-taupe";
  if (item.eventType === "Supervisor") return "warm-beige";
  if (item.eventType === "Waiting" || item.eventType === "Follow-up") return "dusty-blue";
  if (item.eventType === "Daily") return "sage";
  return "neutral";
}

export function calendarColorClasses(item: Pick<CalendarItem, "station" | "projectCode" | "eventType">) {
  return COLOR_CLASSES[calendarColorKey(item)];
}

export function calendarColorLabel(key: CalendarColorKey) {
  return COLOR_LABELS[key];
}

export const CALENDAR_COLOR_LEGEND: { key: Exclude<CalendarColorKey, "neutral">; label: string }[] = [
  { key: "sage", label: COLOR_LABELS.sage },
  { key: "dusty-blue", label: COLOR_LABELS["dusty-blue"] },
  { key: "warm-beige", label: COLOR_LABELS["warm-beige"] },
  { key: "soft-taupe", label: COLOR_LABELS["soft-taupe"] },
  { key: "dusty-rose", label: COLOR_LABELS["dusty-rose"] },
];

/** Capacity View thresholds — Calendar 顯示每日工作量: 高負載 / 一般 / 低負載. */
export function capacityTier(count: number): "high" | "normal" | "low" {
  if (count >= 5) return "high";
  if (count === 0) return "low";
  return "normal";
}

export const CAPACITY_LABEL: Record<ReturnType<typeof capacityTier>, string> = {
  high: "高負載",
  normal: "一般",
  low: "低負載",
};
