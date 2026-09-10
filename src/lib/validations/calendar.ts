import { z } from "zod";

const CALENDAR_EVENT_TYPES = [
  "Daily",
  "Follow-up",
  "Meeting",
  "Project",
  "Supervisor",
  "Waiting",
  "Monthly Plan",
  "Long Hour",
  "Short Term",
  "Additional Work Card",
] as const;

const TASK_PRIORITY_VALUES = ["P1", "P2", "P3", "P4"] as const;

const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

/** Quick Add 表單欄位：標題／日期／開始時間／結束時間／類型／優先級／備註. */
export const calendarEventFormSchema = z
  .object({
    title: z.string().trim().min(1, "請輸入標題").max(200),
    event_date: z.string().min(1, "請選擇日期"),
    start_time: z.string().regex(timeRegex, "時間格式錯誤").optional().nullable().or(z.literal("")),
    end_time: z.string().regex(timeRegex, "時間格式錯誤").optional().nullable().or(z.literal("")),
    event_type: z.enum(CALENDAR_EVENT_TYPES),
    priority: z.enum(TASK_PRIORITY_VALUES).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((v) => !v.start_time || !v.end_time || v.start_time <= v.end_time, {
    message: "結束時間不可早於開始時間",
    path: ["end_time"],
  });

export type CalendarEventFormValues = z.infer<typeof calendarEventFormSchema>;

// 編輯／拖曳排程更新用 — 所有欄位皆可選填，拖曳排程只會送 event_date。
export const calendarEventUpdateSchema = calendarEventFormSchema.innerType().partial();

export type CalendarEventUpdateValues = z.infer<typeof calendarEventUpdateSchema>;

export const calendarQuerySchema = z.object({
  start: z.string().min(1, "請提供起始日期"),
  end: z.string().min(1, "請提供結束日期"),
  aircraft_type: z.string().optional(),
  station: z.string().optional(),
  project_code: z.string().optional(),
});

export type CalendarQueryValues = z.infer<typeof calendarQuerySchema>;
