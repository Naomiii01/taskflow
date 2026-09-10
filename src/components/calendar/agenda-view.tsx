"use client";

import { CalendarEventPill } from "@/components/calendar/calendar-event-pill";
import type { CalendarItem } from "@/types/domain";

export function AgendaView({
  itemsByDate,
  onItemClick,
}: {
  itemsByDate: Map<string, CalendarItem[]>;
  onItemClick: (item: CalendarItem) => void;
}) {
  const dates = Array.from(itemsByDate.keys()).sort();

  if (!dates.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">這段期間沒有安排的工作。</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {dates.map((iso) => {
        const items = itemsByDate.get(iso) ?? [];
        if (!items.length) return null;
        const date = new Date(`${iso}T00:00:00`);
        return (
          <div key={iso} className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {date.toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "short" })}
            </p>
            <ol className="flex flex-col gap-1.5 border-l pl-3">
              {items.map((item) => (
                <li key={item.id}>
                  <CalendarEventPill item={item} dense={false} onClick={onItemClick} />
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
