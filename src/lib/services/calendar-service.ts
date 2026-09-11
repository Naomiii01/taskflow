import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as calendarRepo from "@/lib/repositories/calendar-events-repository";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import * as followupsRepo from "@/lib/repositories/followups-repository";
import * as planningLookupsRepo from "@/lib/repositories/planning-lookups-repository";
import * as supervisorService from "@/lib/services/supervisor-service";
import * as waitingService from "@/lib/services/waiting-service";
import type {
  CalendarEventFormValues,
  CalendarEventUpdateValues,
  CalendarQueryValues,
} from "@/lib/validations/calendar";
import type { CalendarItem, CalendarItemSource } from "@/types/domain";
import type { AircraftType, CalendarEventType, Station, WorkCategory } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

/** Task Integration: 任務的 Work Category 對應到 Calendar Event Type，讓看板上
 * 已經用到的分類詞彙（每日檢查/短天期/長工時…）在日曆上顯示一致的類型與色彩。
 * 沒有 work_category 的一般任務回傳 null（走預設中性色，不強行歸類）。 */
function workCategoryToEventType(wc: WorkCategory | null): CalendarEventType | null {
  switch (wc) {
    case "Daily Check":
      return "Daily";
    case "Short Term":
      return "Short Term";
    case "Long Hour":
      return "Long Hour";
    case "Monthly Plan":
      return "Monthly Plan";
    case "Additional Work Card":
      return "Additional Work Card";
    case "Project":
      return "Project";
    case "Supervisor Assignment":
      return "Supervisor";
    case "Special Request":
      return "Meeting";
    default:
      return null;
  }
}

function inRange(date: string | null | undefined, start: string, end: string): date is string {
  return !!date && date >= start && date <= end;
}

/**
 * Unifies every calendar-relevant source into one flat, date-sorted list:
 *   - calendar_events (manually created "Quick Add" entries — the only
 *     source actually stored in the calendar_events table)
 *   - tasks (by due_date)
 *   - followups (by followup_date)
 *   - supervisor_tasks (by due_date)
 *   - waiting_items still Waiting (by expected_reply_date)
 *   - project_milestones (by target_date)
 * Nothing here duplicates data — each source is read straight from its own
 * table/service, so editing a task elsewhere in the app is instantly
 * reflected on the calendar with no sync step.
 */
export async function listCalendarItems(supabase: DB, query: CalendarQueryValues): Promise<CalendarItem[]> {
  const { start, end } = query;
  const items: CalendarItem[] = [];

  const [events, allTasks, projects, followups, supervisorTasks, waitingItems] = await Promise.all([
    calendarRepo.findCalendarEventsInRange(supabase, start, end),
    tasksRepo.findAllTasksForPlanning(supabase),
    planningLookupsRepo.findAllProjects(supabase),
    followupsRepo.findFollowupsInRange(supabase, start, end),
    supervisorService.listSupervisorTasks(supabase),
    waitingService.listWaitingItems(supabase, { status: "Waiting" }),
  ]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const milestones = await planningLookupsRepo.findMilestonesByProjects(supabase, projects.map((p) => p.id));

  for (const e of events) {
    items.push({
      id: `calendar_event:${e.id}`,
      source: "calendar_event" as CalendarItemSource,
      sourceId: e.id,
      title: e.title,
      date: e.event_date,
      startTime: e.start_time,
      endTime: e.end_time,
      eventType: e.event_type,
      priority: e.priority,
      station: [],
      aircraftType: [],
      projectCode: null,
      editable: true,
      href: null,
    });
  }

  for (const t of allTasks) {
    if (!inRange(t.due_date, start, end)) continue;
    items.push({
      id: `task:${t.id}`,
      source: "task",
      sourceId: t.id,
      title: t.title,
      date: t.due_date,
      startTime: null,
      endTime: null,
      eventType: workCategoryToEventType(t.work_category),
      priority: t.priority,
      station: t.station,
      aircraftType: t.aircraft_type,
      projectCode: t.project_id ? (projectById.get(t.project_id)?.code ?? null) : null,
      editable: true,
      href: `/tasks/${t.id}`,
    });
  }

  for (const f of followups) {
    items.push({
      id: `followup:${f.id}`,
      source: "followup",
      sourceId: f.id,
      title: f.content?.slice(0, 60) || "追蹤紀錄",
      date: f.followup_date,
      startTime: null,
      endTime: null,
      eventType: "Follow-up",
      priority: null,
      station: [],
      aircraftType: [],
      projectCode: null,
      editable: false,
      href: `/tasks/${f.task_id}`,
    });
  }

  for (const s of supervisorTasks) {
    if (!inRange(s.due_date, start, end)) continue;
    items.push({
      id: `supervisor_task:${s.id}`,
      source: "supervisor_task",
      sourceId: s.id,
      title: s.title,
      date: s.due_date,
      startTime: null,
      endTime: null,
      eventType: "Supervisor",
      priority: s.priority,
      station: [],
      aircraftType: [],
      projectCode: null,
      editable: false,
      href: null,
    });
  }

  for (const w of waitingItems) {
    if (!inRange(w.expected_reply_date, start, end)) continue;
    items.push({
      id: `waiting_item:${w.id}`,
      source: "waiting_item",
      sourceId: w.id,
      title: w.description?.slice(0, 60) || `等待 ${w.waiting_unit} 回覆`,
      date: w.expected_reply_date as string,
      startTime: null,
      endTime: null,
      eventType: "Waiting",
      priority: null,
      station: [],
      aircraftType: [],
      projectCode: null,
      editable: false,
      href: w.related_task_id ? `/tasks/${w.related_task_id}` : null,
    });
  }

  for (const m of milestones) {
    if (!inRange(m.target_date, start, end)) continue;
    const project = projectById.get(m.project_id);
    items.push({
      id: `milestone:${m.id}`,
      source: "milestone",
      sourceId: m.id,
      title: project?.code ? `${project.code} ${m.title}` : m.title,
      date: m.target_date as string,
      startTime: null,
      endTime: null,
      eventType: "Project",
      priority: null,
      station: [],
      aircraftType: [],
      projectCode: project?.code ?? null,
      editable: false,
      href: null,
    });
  }

  let filtered = items;
  // aircraftType/station are now arrays (a task can cover more than one) —
  // filtering means "this item includes the requested value", not equality.
  if (query.aircraft_type) filtered = filtered.filter((i) => i.aircraftType.includes(query.aircraft_type as AircraftType));
  if (query.station) filtered = filtered.filter((i) => i.station.includes(query.station as Station));
  if (query.project_code) filtered = filtered.filter((i) => i.projectCode === query.project_code);

  return filtered.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });
}

export async function createCalendarEvent(supabase: DB, values: CalendarEventFormValues, createdBy: string) {
  return calendarRepo.createCalendarEvent(supabase, values, createdBy);
}

export async function updateCalendarEvent(supabase: DB, id: string, values: CalendarEventUpdateValues) {
  const existing = await calendarRepo.findCalendarEventById(supabase, id);
  if (!existing) throw new Error("找不到這筆行事曆事件");
  return calendarRepo.updateCalendarEvent(supabase, id, values);
}

export async function deleteCalendarEvent(supabase: DB, id: string) {
  const existing = await calendarRepo.findCalendarEventById(supabase, id);
  if (!existing) throw new Error("找不到這筆行事曆事件");
  await calendarRepo.deleteCalendarEvent(supabase, id);
}
