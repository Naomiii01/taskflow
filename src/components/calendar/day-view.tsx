"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CalendarEventPill } from "@/components/calendar/calendar-event-pill";
import { toIso } from "@/lib/calendar-date-utils";
import type { CalendarItem } from "@/types/domain";

export function DayView({
  anchor,
  itemsByDate,
  onAdd,
  onItemClick,
}: {
  anchor: Date;
  itemsByDate: Map<string, CalendarItem[]>;
  onAdd: (dateIso: string) => void;
  onItemClick: (item: CalendarItem) => void;
}) {
  const iso = toIso(anchor);
  const items = itemsByDate.get(iso) ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {anchor.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </p>
        <Button size="sm" variant="outline" onClick={() => onAdd(iso)}>
          <Plus className="size-3.5" /> 新增工作
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">這天沒有安排的工作。</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <CalendarEventPill item={item} dense={false} onClick={onItemClick} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
