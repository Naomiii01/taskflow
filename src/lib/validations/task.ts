import { z } from "zod";

import {
  AIRCRAFT_TYPES,
  CROSS_DEPT_UNITS,
  IMPACT_LEVELS,
  PLANNING_STATUSES,
  STATIONS,
  TASK_PRIORITIES,
  TASK_SOURCE_CHANNELS,
  TASK_STATUSES,
  WORK_CATEGORIES,
} from "@/lib/constants";

// Note: HTML <input type="date"> posts "" for "no value picked" — callers
// (task-form-dialog's onSubmit) normalize "" to null *before* validation, so
// these schemas can stay plain string|null|undefined without z.preprocess
// (preprocess's `unknown` input type breaks the zodResolver<TaskFormValues>
// generic match in react-hook-form).
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "請輸入任務名稱").max(200, "任務名稱過長"),
  description: z.string().trim().max(5000).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES as [string, ...string[]], { message: "請選擇優先級" }),
  status: z.enum(TASK_STATUSES as [string, ...string[]]).optional(),
  // No longer collected in the task form (部門 was replaced by 提出需求單位 /
  // source_department as the primary categorization) — kept nullable/optional
  // so existing tasks that already have a department keep it untouched.
  department_id: z.string().uuid().nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  owner_name: z.string().trim().max(100).nullable().optional(),
  due_date: z.string().nullable().optional(),
  followup_date: z.string().nullable().optional(),
  tags: z.array(z.string().trim().min(1)).max(20).optional(),
  // Phase 6.5: Aviation Planning Operations Center
  // Aircraft Type/Station can each cover more than one value (全機型 or a
  // job spanning two types; A321/A339 aircraft based at more than one
  // station) — both are multi-select, stored as arrays.
  aircraft_type: z.array(z.enum(AIRCRAFT_TYPES as [string, ...string[]])).max(10).optional(),
  // 機號也是多選：實務上常常不是整個機隊都排，可能只挑其中 3 架或 5 架。
  aircraft_registration: z.array(z.string().trim().min(1)).max(50).optional(),
  station: z.array(z.enum(STATIONS as [string, ...string[]])).max(10).optional(),
  work_category: z.enum(WORK_CATEGORIES as [string, ...string[]]).nullable().optional(),
  planning_month: z.string().nullable().optional(),
  source_department: z.enum(CROSS_DEPT_UNITS as [string, ...string[]]).nullable().optional(),
  waiting_owner: z.enum(CROSS_DEPT_UNITS as [string, ...string[]]).nullable().optional(),
  planning_status: z.enum(PLANNING_STATUSES as [string, ...string[]]).nullable().optional(),
  impact_level: z.enum(IMPACT_LEVELS as [string, ...string[]]).nullable().optional(),
  parent_task_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  // System-set only (Recurring Task Engine) — not exposed in the task form.
  source_template_id: z.string().uuid().nullable().optional(),
  // 來源：任務需求是怎麼來的（Email／會議／口頭告知／其他）＋自由輸入的細節
  // （例如「9/10 王小姐」「週一晨會」「陳經理」）。
  source_channel: z.enum(TASK_SOURCE_CHANNELS as [string, ...string[]]).nullable().optional(),
  source_note: z.string().trim().max(500).nullable().optional(),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const taskUpdateSchema = taskFormSchema.partial();

export type TaskUpdateValues = z.infer<typeof taskUpdateSchema>;

export const taskQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.array(z.enum(TASK_STATUSES as [string, ...string[]])).optional(),
  priority: z.array(z.enum(TASK_PRIORITIES as [string, ...string[]])).optional(),
  department_id: z.array(z.string().uuid()).optional(),
  owner_id: z.array(z.string().uuid()).optional(),
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional(),
  mine: z.coerce.boolean().optional(),
  dueThisWeek: z.coerce.boolean().optional(),
  overdue: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().optional(),
  aircraft_type: z.array(z.enum(AIRCRAFT_TYPES as [string, ...string[]])).optional(),
  station: z.array(z.enum(STATIONS as [string, ...string[]])).optional(),
  work_category: z.array(z.enum(WORK_CATEGORIES as [string, ...string[]])).optional(),
  planning_status: z.array(z.enum(PLANNING_STATUSES as [string, ...string[]])).optional(),
  project_id: z.array(z.string().uuid()).optional(),
  sortBy: z
    .enum(["task_number", "title", "priority", "status", "due_date", "followup_date", "updated_at"])
    .optional()
    .default("updated_at"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type TaskQuery = z.infer<typeof taskQuerySchema>;
