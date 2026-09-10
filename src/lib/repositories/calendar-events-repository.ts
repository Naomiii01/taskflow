import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { CalendarEventFormValues, CalendarEventUpdateValues } from "@/lib/validations/calendar";

type DB = SupabaseClient<Database, "taskflow">;

export async function findCalendarEventsInRange(supabase: DB, start: string, end: string) {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .gte("event_date", start)
    .lte("event_date", end)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function findCalendarEventById(supabase: DB, id: string) {
  const { data, error } = await supabase.from("calendar_events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createCalendarEvent(supabase: DB, values: CalendarEventFormValues, createdBy: string) {
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      title: values.title,
      event_date: values.event_date,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      event_type: values.event_type,
      priority: values.priority ?? null,
      notes: values.notes || null,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateCalendarEvent(supabase: DB, id: string, values: CalendarEventUpdateValues) {
  const patch: Database["taskflow"]["Tables"]["calendar_events"]["Update"] = {};
  if (values.title !== undefined) patch.title = values.title;
  if (values.event_date !== undefined) patch.event_date = values.event_date;
  if (values.start_time !== undefined) patch.start_time = values.start_time || null;
  if (values.end_time !== undefined) patch.end_time = values.end_time || null;
  if (values.event_type !== undefined) patch.event_type = values.event_type;
  if (values.priority !== undefined) patch.priority = values.priority ?? null;
  if (values.notes !== undefined) patch.notes = values.notes || null;

  const { data, error } = await supabase
    .from("calendar_events")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCalendarEvent(supabase: DB, id: string) {
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}
