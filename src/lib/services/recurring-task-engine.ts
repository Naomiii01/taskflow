import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as planningLookupsRepo from "@/lib/repositories/planning-lookups-repository";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import type { TaskFormValues } from "@/lib/validations/task";
import type { EngineRunResult } from "@/types/domain";

type DB = SupabaseClient<Database, "taskflow">;
type Template = Awaited<ReturnType<typeof planningLookupsRepo.findActiveRecurringTemplates>>[number];

/**
 * Recurring Task Engine — decides whether a template fires *today*.
 * Daily/Weekly/Monthly are direct field matches; Quarterly reuses
 * `day_of_month` + `quarter_start_month` so one row can express "day 15,
 * every 3 months starting in January" without hardcoding calendar quarters;
 * Yearly needs both day_of_month and month_of_year to match.
 */
function shouldFireToday(template: Template, today: Date): boolean {
  switch (template.frequency) {
    case "Daily":
      return true;
    case "Weekly":
      return template.day_of_week !== null && today.getDay() === template.day_of_week;
    case "Monthly":
      return template.day_of_month !== null && today.getDate() === template.day_of_month;
    case "Quarterly": {
      if (template.day_of_month === null || template.quarter_start_month === null) return false;
      if (today.getDate() !== template.day_of_month) return false;
      const offset = (today.getMonth() + 1 - template.quarter_start_month + 12) % 12;
      return offset % 3 === 0;
    }
    case "Yearly":
      return (
        template.day_of_month !== null &&
        template.month_of_year !== null &&
        today.getDate() === template.day_of_month &&
        today.getMonth() + 1 === template.month_of_year
      );
    default:
      return false;
  }
}

/** e.g. created on the 1st with due_day_of_month=20 → due the 20th of the
 * same month; if due_day_of_month has already passed this month (shouldn't
 * happen for the seeded templates, but a manually-edited template could),
 * roll to next month rather than generating an already-overdue task. */
function computeDueDate(template: Template, today: Date): string | null {
  if (template.due_day_of_month === null) return null;
  const year = today.getFullYear();
  const month = today.getMonth();
  let due = new Date(year, month, template.due_day_of_month);
  if (due < today) due = new Date(year, month + 1, template.due_day_of_month);
  return due.toISOString().slice(0, 10);
}

function planningMonthFor(today: Date) {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

async function generateFromTemplate(supabase: DB, template: Template, today: Date, todayStr: string): Promise<boolean> {
  if (!template.default_department_id) {
    console.warn(`[recurring-task-engine] skipping template "${template.name}" — no default_department_id set`);
    return false;
  }
  // Fast path: already generated today per the template's own bookkeeping.
  if (template.last_generated_on === todayStr) return false;
  // Defensive slow path: guards against a duplicate if last_generated_on
  // somehow didn't get persisted on a previous run (e.g. a crash mid-request).
  if (await planningLookupsRepo.templateGeneratedOn(supabase, template.id, todayStr)) {
    await planningLookupsRepo.markTemplateGenerated(supabase, template.id, todayStr);
    return false;
  }

  const values: TaskFormValues = {
    title: `${template.default_title}（${todayStr}）`,
    description: template.default_description ?? undefined,
    priority: template.default_priority,
    department_id: template.default_department_id,
    due_date: computeDueDate(template, today) ?? undefined,
    work_category: template.default_work_category ?? undefined,
    planning_month: planningMonthFor(today),
    planning_status: "Planning",
    source_template_id: template.id,
  };

  await tasksRepo.createTask(supabase, values, null);
  await planningLookupsRepo.markTemplateGenerated(supabase, template.id, todayStr);
  return true;
}

/** Scheduler entry point (00:00, alongside the Daily Checklist Engine):
 * generates today's Monthly Planning Templates (A321/A339短天期整理、額外工單整理
 * on the 1st; 修管月計畫整理 on the 15th; 長工時/人力/工期安排 on the 1st, due the
 * 20th) plus any other active Daily/Weekly/Quarterly/Yearly templates. */
export async function runRecurringTaskEngine(supabase: DB): Promise<EngineRunResult> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const templates = await planningLookupsRepo.findActiveRecurringTemplates(supabase);

  let created = 0;
  let skipped = 0;
  for (const template of templates) {
    if (!shouldFireToday(template, today)) continue;
    const didCreate = await generateFromTemplate(supabase, template, today, todayStr);
    if (didCreate) created++;
    else skipped++;
  }

  return { ran: true, notificationsCreated: created, details: { created, skipped, templatesChecked: templates.length } };
}
