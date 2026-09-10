"use client";

import * as React from "react";
import { isToday } from "date-fns";

import { CalendarEventPill } from "@/components/calendar/calendar-event-pill";
import { weekRange, toIso } from "@/lib/calendar-date-utils";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "@/types/domain";

export function WeekView({
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
  const { days } = weekRange(anchor);
  const [dragOverDate, setDragOverDate] = React.useState<string | null>(null);
  const draggingItemRef = React.useRef<CalendarItem | null>(null);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((day) => {
        const iso = toIso(day);
        const items = itemsByDate.get(iso) ?? [];

        return (
          <div
            key={iso}
            className={cn(
              "flex min-h-[220px] flex-col gap-1.5 rounded-lg border bg-card p-2",
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
            <button type="button" className="flex items-center justify-between text-left" onClick={() => onDayClick(iso)}>
              <span className="text-xs text-muted-foreground">
                {day.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", weekday: "short" })}
              </span>
              <span className={cn("flex size-5 items-center justify-center rounded-full text-xs", isToday(day) && "bg-primary font-semibold text-primary-foreground")}>
                {day.getDate()}
              </span>
            </button>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {items.map((item) => (
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
                  <CalendarEventPill item={item} dense={false} draggable onClick={onItemClick} />
                </div>
              ))}
              {items.length === 0 && <p className="text-center text-[11px] text-muted-foreground/70">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
