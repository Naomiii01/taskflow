"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, endOfMonth, startOfMonth } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { DayView } from "@/components/calendar/day-view";
import { AgendaView } from "@/components/calendar/agenda-view";
import { PlanningTimelineView } from "@/components/calendar/planning-timeline-view";
import { QuickAddDialog } from "@/components/calendar/quick-add-dialog";
import { CalendarFiltersBar, type CalendarFilterState } from "@/components/calendar/calendar-filters-bar";
import { useCalendarItems, useUpdateCalendarEvent } from "@/hooks/use-calendar";
import { useUpdateTask } from "@/hooks/use-tasks";
import { monthGridRange, toIso, weekRange, shiftAnchor } from "@/lib/calendar-date-utils";
import { CALENDAR_COLOR_LEGEND } from "@/lib/calendar-colors";
import type { CalendarItem } from "@/types/domain";

type ViewMode = "month" | "week" | "day" | "agenda" | "timeline";

export function CalendarClient({ showHeader = true }: { showHeader?: boolean }) {
  const [view, setView] = React.useState<ViewMode>("month");
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [filters, setFilters] = React.useState<CalendarFilterState>({});
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);
  const [quickAddDate, setQuickAddDate] = React.useState(toIso(new Date()));
  const [editingItem, setEditingItem] = React.useState<(CalendarItem & { source: "calendar_event" }) | null>(null);

  const updateCalendarEvent = useUpdateCalendarEvent();
  const updateTask = useUpdateTask();

  const range = React.useMemo(() => {
    if (view === "week") return weekRange(anchor);
    if (view === "day") return { start: anchor, end: anchor, days: [anchor] };
    if (view === "agenda") return { start: anchor, end: addDays(anchor, 29), days: [] };
    if (view === "timeline") return { start: startOfMonth(anchor), end: endOfMonth(anchor), days: [] };
    return monthGridRange(anchor); // month
  }, [view, anchor]);

  const { data, isLoading } = useCalendarItems({
    start: toIso(range.start),
    end: toIso(range.end),
    aircraft_type: filters.aircraft_type,
    station: filters.station,
    project_code: filters.project_code,
  });

  const items = React.useMemo(() => data?.data ?? [], [data]);

  const itemsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [items]);

  function openQuickAdd(dateIso: string) {
    setEditingItem(null);
    setQuickAddDate(dateIso);
    setQuickAddOpen(true);
  }

  function handleItemClick(item: CalendarItem) {
    if (item.source !== "calendar_event") return; // 其他來源請到各自頁面編輯
    setEditingItem(item as CalendarItem & { source: "calendar_event" });
    setQuickAddDate(item.date);
    setQuickAddOpen(true);
  }

  function handleDrop(item: CalendarItem, newDateIso: string) {
    if (item.date === newDateIso || !item.editable) return;
    if (item.source === "calendar_event") {
      updateCalendarEvent.mutate({ id: item.sourceId, values: { event_date: newDateIso } });
    } else if (item.source === "task") {
      updateTask.mutate({ id: item.sourceId, values: { due_date: newDateIso } });
    }
  }

  const periodLabel = React.useMemo(() => {
    if (view === "week") {
      return `${range.start.toLocaleDateString("zh-TW", { month: "short", day: "numeric" })} - ${range.end.toLocaleDateString("zh-TW", { month: "short", day: "numeric" })}`;
    }
    if (view === "day") return anchor.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
    if (view === "agenda") return "未來 30 天";
    return anchor.toLocaleDateString("zh-TW", { year: "numeric", month: "long" });
  }, [view, anchor, range]);

  return (
    <div className="flex flex-col gap-4">
      {showHeader && (
        <div>
          <h1 className="text-xl font-semibold">行事曆</h1>
          <p className="text-sm text-muted-foreground">Calendar Planning Center — Planning 排程中心。</p>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="month">月</TabsTrigger>
                <TabsTrigger value="week">週</TabsTrigger>
                <TabsTrigger value="day">日</TabsTrigger>
                <TabsTrigger value="agenda">議程</TabsTrigger>
                <TabsTrigger value="timeline">機型時間軸</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" onClick={() => openQuickAdd(toIso(anchor))}>
              <Plus className="size-4" /> 新增工作
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="size-8" onClick={() => setAnchor((a) => shiftAnchor(a, view, -1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>今天</Button>
              <Button variant="outline" size="icon" className="size-8" onClick={() => setAnchor((a) => shiftAnchor(a, view, 1))}>
                <ChevronRight className="size-4" />
              </Button>
              <span className="ml-1 text-sm font-medium">{periodLabel}</span>
            </div>
            <CalendarFiltersBar value={filters} onChange={setFilters} />
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">載入中…</div>
          ) : (
            <>
              {view === "month" && (
                <MonthView anchor={anchor} itemsByDate={itemsByDate} onDayClick={openQuickAdd} onItemClick={handleItemClick} onDropOnDate={handleDrop} />
              )}
              {view === "week" && (
                <WeekView anchor={anchor} itemsByDate={itemsByDate} onDayClick={openQuickAdd} onItemClick={handleItemClick} onDropOnDate={handleDrop} />
              )}
              {view === "day" && <DayView anchor={anchor} itemsByDate={itemsByDate} onAdd={openQuickAdd} onItemClick={handleItemClick} />}
              {view === "agenda" && <AgendaView itemsByDate={itemsByDate} onItemClick={handleItemClick} />}
              {view === "timeline" && <PlanningTimelineView anchor={anchor} items={items} onItemClick={handleItemClick} />}
            </>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            {CALENDAR_COLOR_LEGEND.map((c) => (
              <span key={c.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <LegendSwatch swatchKey={c.key} /> {c.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <QuickAddDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} defaultDate={quickAddDate} editingItem={editingItem} />
    </div>
  );
}

function LegendSwatch({ swatchKey }: { swatchKey: "sage" | "dusty-blue" | "warm-beige" | "soft-taupe" | "dusty-rose" }) {
  const map: Record<typeof swatchKey, string> = {
    sage: "bg-accent",
    "dusty-blue": "bg-primary/40",
    "warm-beige": "bg-secondary",
    "soft-taupe": "bg-muted",
    "dusty-rose": "bg-cal-rose",
  };
  return <span className={`size-2.5 rounded-full ${map[swatchKey]}`} />;
}
