"use client";

import * as React from "react";
import { isSameMonth, isToday } from "date-fns";

import { CalendarEventPill } from "@/components/calendar/calendar-event-pill";
import { CAPACITY_LABEL, capacityTier } from "@/lib/calendar-colors";
import { monthGridRange, toIso, WEEKDAY_LABELS } from "@/lib/calendar-date-utils";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "@/types/domain";

const MAX_VISIBLE = 3;

export function MonthView({
  anchor,
  itemsByDate,
  onDayClick,
  onItemClick,
  onDropOnDate,
}: {
  anchor: Date;
  itemsByDate: Map<string, CalendarItem[]>;
  onDayClick: (dateIso: string) => void;
  onItemClick: (item: CalendarItem) => void;
  onDropOnDate: (item: CalendarItem, dateIso: string) => void;
}) {
  const { days } = monthGridRange(anchor);
  const [dragOverDate, setDragOverDate] = React.useState<string | null>(null);
  const draggingItemRef = React.useRef<CalendarItem | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = toIso(day);
          const items = itemsByDate.get(iso) ?? [];
          const tier = capacityTier(items.length);
          const inMonth = isSameMonth(day, anchor);
          const overflow = items.length - MAX_VISIBLE;

          return (
            <div
              key={iso}
              className={cn(
                "flex min-h-[92px] flex-col gap-1 rounded-lg border p-1.5 transition-colors sm:min-h-[112px]",
                inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground",
                dragOverDate === iso && "ring-2 ring-primary"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverDate(iso);
              }}
              onDragLeave={() => setDragOverDate((d) => (d === iso ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverDate(null);
                if (draggingItemRef.current) onDropOnDate(draggingItemRef.current, iso);
              }}
            >
              <button
                type="button"
                className="flex items-center justify-between gap-1 text-left"
                onClick={() => onDayClick(iso)}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-xs",
                    isToday(day) && "bg-primary font-semibold text-primary-foreground"
                  )}
                >
                  {day.getDate()}
                </span>
                {items.length > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px]",
                      tier === "high" ? "bg-destructive/15 text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {items.length}件{tier === "high" ? ` · ${CAPACITY_LABEL.high}` : ""}
                  </span>
                )}
              </button>

              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {items.slice(0, MAX_VISIBLE).map((item) => (
                  <div
                    key={item.id}
                    onDragStart={(e) => {
                      draggingItemRef.current = item;
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      draggingItemRef.current = null;
                    }}
                  >
                    <CalendarEventPill item={item} draggable onClick={onItemClick} />
                  </div>
                ))}
                {overflow > 0 && (
                  <button
                    type="button"
                    className="px-1 text-left text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => onDayClick(iso)}
                  >
                    +{overflow} 更多
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
