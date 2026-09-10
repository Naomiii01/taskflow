"use client";

import { Fragment } from "react";
import { eachDayOfInterval, endOfMonth, isToday, startOfMonth } from "date-fns";

import { CalendarEventPill } from "@/components/calendar/calendar-event-pill";
import { AIRCRAFT_TYPES } from "@/lib/constants";
import { toIso } from "@/lib/calendar-date-utils";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "@/types/domain";

/**
 * Aircraft Planning Calendar / Timeline View: 一列一個機型（A321/A339/A351/
 * A359），依到期日在當月天數軸上標出工作。只用 due_date 這個單一日期點位，
 * 不是完整的甘特圖（起訖日期）— 任務資料本身也只有到期日，沒有開始日期。
 */
export function PlanningTimelineView({ anchor, items, onItemClick }: { anchor: Date; items: CalendarItem[]; onItemClick: (item: CalendarItem) => void }) {
  const days = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });

  const byAircraftAndDate = new Map<string, Map<string, CalendarItem[]>>();
  for (const type of AIRCRAFT_TYPES) byAircraftAndDate.set(type, new Map());
  for (const item of items) {
    if (!item.aircraftType) continue;
    const byDate = byAircraftAndDate.get(item.aircraftType);
    if (!byDate) continue;
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);
  }

  return (
    <div className="flex flex-col gap-4 overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-[64px_1fr] gap-y-3">
        <div />
        <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(22px, 1fr))` }}>
          {days.map((d) => (
            <div key={toIso(d)} className={cn("text-center text-[10px] text-muted-foreground", isToday(d) && "font-semibold text-primary")}>
              {d.getDate()}
            </div>
          ))}
        </div>

        {AIRCRAFT_TYPES.map((type) => {
          const byDate = byAircraftAndDate.get(type) ?? new Map<string, CalendarItem[]>();
          return (
            <Fragment key={type}>
              <div className="flex items-center text-sm font-medium">{type}</div>
              <div className="grid items-center gap-y-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(22px, 1fr))` }}>
                {days.map((d) => {
                  const iso = toIso(d);
                  const dayItems = byDate.get(iso) ?? [];
                  return (
                    <div key={iso} className="flex justify-center">
                      {dayItems.length > 0 ? (
                        <button
                          type="button"
                          title={dayItems.map((i) => i.title).join("、")}
                          onClick={() => onItemClick(dayItems[0])}
                          className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground"
                        >
                          {dayItems.length > 1 ? dayItems.length : ""}
                        </button>
                      ) : (
                        <span className="size-1 rounded-full bg-border" />
                      )}
                    </div>
                  );
                })}
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">本月清單</p>
        <ol className="flex flex-col gap-1">
          {items
            .filter((i) => i.aircraftType)
            .map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 text-muted-foreground">{item.date}</span>
                <span className="w-12 shrink-0 font-medium">{item.aircraftType}</span>
                <CalendarEventPill item={item} onClick={onItemClick} />
              </li>
            ))}
          {items.every((i) => !i.aircraftType) && (
            <p className="text-xs text-muted-foreground">本月沒有指定機型的工作。</p>
          )}
        </ol>
      </div>
    </div>
  );
}
