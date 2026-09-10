import { differenceInCalendarDays } from "date-fns";

export type UrgencyTier = "overdue" | "urgent" | "soon" | "normal";

const DONE_STATUSES = ["Completed", "Cancelled"];

/**
 * 到期日緊急程度：已逾期／3 天內到期／一週內到期／其餘。已完成或已取消的任務
 * 一律視為 normal（不需要警示色），沒有到期日的任務也是 normal。
 * 用於看板卡片依到期日顯示不同警示色，而不是只靠狀態欄位分類。
 */
export function getDueUrgency(dueDate: string | null | undefined, status: string): UrgencyTier {
  if (!dueDate || DONE_STATUSES.includes(status)) return "normal";
  const days = differenceInCalendarDays(new Date(`${dueDate}T00:00:00`), new Date());
  if (days < 0) return "overdue";
  if (days <= 3) return "urgent";
  if (days <= 7) return "soon";
  return "normal";
}

/** 卡片左側色條 — 沿用既有的 success/warning/destructive 色票，不新增顏色。 */
export const URGENCY_BORDER_CLASS: Record<UrgencyTier, string> = {
  overdue: "border-l-4 border-l-destructive",
  urgent: "border-l-4 border-l-destructive",
  soon: "border-l-4 border-l-warning",
  normal: "border-l-4 border-l-transparent",
};

export const URGENCY_TEXT_CLASS: Record<UrgencyTier, string> = {
  overdue: "text-destructive font-medium",
  urgent: "text-destructive font-medium",
  soon: "text-warning font-medium",
  normal: "text-muted-foreground",
};

export const URGENCY_LABEL: Record<UrgencyTier, string | null> = {
  overdue: "已逾期",
  urgent: "3 天內到期",
  soon: "一週內到期",
  normal: null,
};
