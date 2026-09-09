import { differenceInCalendarDays } from "date-fns";

import type { SmartFollowupState } from "@/types/domain";

/**
 * Smart Follow-up Indicator: 0-3 days since the last touch = green,
 * 4-7 = yellow, 8+ = red ("⚠️ Need Follow-up"). "Last touch" is the most
 * recent of the task's last update and its most recent follow-up record.
 */
export function computeSmartFollowup(lastActivityAt: string | Date | null | undefined): SmartFollowupState {
  if (!lastActivityAt) {
    return { level: "green", daysSince: null, needsFollowup: false };
  }
  const days = differenceInCalendarDays(new Date(), new Date(lastActivityAt));

  if (days >= 8) return { level: "red", daysSince: days, needsFollowup: true };
  if (days >= 4) return { level: "yellow", daysSince: days, needsFollowup: false };
  return { level: "green", daysSince: days, needsFollowup: false };
}
