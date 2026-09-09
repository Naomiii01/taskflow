import { z } from "zod";

import {
  AIRCRAFT_TYPES,
  CROSS_DEPT_UNITS,
  FOLLOW_UP_ENTITY_TYPES,
  STATIONS,
  SUPERVISOR_TASK_STATUSES,
  TASK_PRIORITIES,
  WAITING_STATUSES,
} from "@/lib/constants";

// --- Fleet Master ------------------------------------------------------------

export const fleetAircraftSchema = z.object({
  aircraft_type: z.enum(AIRCRAFT_TYPES as [string, ...string[]]),
  aircraft_registration: z.string().trim().min(1, "請輸入機號"),
  station: z.enum(STATIONS as [string, ...string[]]).optional(),
  status: z.string().trim().min(1).optional(),
});
export type FleetAircraftValues = z.infer<typeof fleetAircraftSchema>;

// --- Project Center ------------------------------------------------------------

export const projectSchema = z.object({
  code: z.string().trim().min(1, "請輸入專案代號").max(20),
  name: z.string().trim().min(1, "請輸入專案名稱").max(100),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.string().trim().max(20).optional(),
});
export type ProjectValues = z.infer<typeof projectSchema>;

export const milestoneSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().trim().min(1, "請輸入里程碑名稱").max(200),
  target_date: z.string().nullable().optional(),
});
export type MilestoneValues = z.infer<typeof milestoneSchema>;

// --- Daily Checklist Engine ----------------------------------------------------

export const checklistItemUpdateSchema = z.object({
  is_completed: z.boolean(),
  note: z.string().trim().max(1000).nullable().optional(),
});
export type ChecklistItemUpdateValues = z.infer<typeof checklistItemUpdateSchema>;

// --- Waiting Center ------------------------------------------------------------

export const waitingItemSchema = z.object({
  waiting_unit: z.enum(CROSS_DEPT_UNITS as [string, ...string[]]),
  description: z.string().trim().min(1, "請輸入等待事項").max(2000),
  related_task_id: z.string().uuid().nullable().optional(),
  expected_reply_date: z.string().nullable().optional(),
});
export type WaitingItemValues = z.infer<typeof waitingItemSchema>;

export const waitingItemUpdateSchema = waitingItemSchema.partial().extend({
  status: z.enum(WAITING_STATUSES as [string, ...string[]]).optional(),
});
export type WaitingItemUpdateValues = z.infer<typeof waitingItemUpdateSchema>;

export const waitingQuerySchema = z.object({
  status: z.enum(WAITING_STATUSES as [string, ...string[]]).optional(),
  waiting_unit: z.enum(CROSS_DEPT_UNITS as [string, ...string[]]).optional(),
});
export type WaitingQuery = z.infer<typeof waitingQuerySchema>;

// --- Follow-up Center ------------------------------------------------------------

export const followUpRecordSchema = z.object({
  entity_type: z.enum(FOLLOW_UP_ENTITY_TYPES as [string, ...string[]]),
  entity_id: z.string().uuid(),
  next_follow_up_date: z.string().nullable().optional(),
  method: z.string().trim().max(50).nullable().optional(),
  target_person: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type FollowUpRecordValues = z.infer<typeof followUpRecordSchema>;

// --- Supervisor Assignment Center ------------------------------------------------

export const supervisorTaskSchema = z.object({
  title: z.string().trim().min(1, "請輸入交辦事項").max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  assigned_by: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES as [string, ...string[]]).optional(),
});
export type SupervisorTaskValues = z.infer<typeof supervisorTaskSchema>;

export const supervisorTaskUpdateSchema = supervisorTaskSchema.partial().extend({
  status: z.enum(SUPERVISOR_TASK_STATUSES as [string, ...string[]]).optional(),
});
export type SupervisorTaskUpdateValues = z.infer<typeof supervisorTaskUpdateSchema>;

// --- Recurring Task Engine (template management) --------------------------------

export const recurringTemplateSchema = z.object({
  name: z.string().trim().min(1, "請輸入範本名稱").max(200),
  frequency: z.enum(["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"]),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  day_of_month: z.number().int().min(1).max(28).nullable().optional(),
  month_of_year: z.number().int().min(1).max(12).nullable().optional(),
  quarter_start_month: z.number().int().min(1).max(3).nullable().optional(),
  due_day_of_month: z.number().int().min(1).max(28).nullable().optional(),
  default_title: z.string().trim().min(1, "請輸入預設任務標題").max(200),
  default_description: z.string().trim().max(2000).nullable().optional(),
  default_department_id: z.string().uuid().nullable().optional(),
  default_priority: z.enum(TASK_PRIORITIES as [string, ...string[]]).optional(),
  is_active: z.boolean().optional(),
});
export type RecurringTemplateValues = z.infer<typeof recurringTemplateSchema>;
