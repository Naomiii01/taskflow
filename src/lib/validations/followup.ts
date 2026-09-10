import { z } from "zod";

export const followupFormSchema = z.object({
  task_id: z.string().uuid(),
  followup_date: z.string().min(1, "請選擇追蹤日期"),
  department_name: z.string().trim().max(100).optional().nullable(),
  content: z.string().trim().min(1, "請輸入追蹤內容").max(2000),
  result: z.string().trim().max(2000).optional().nullable(),
  next_action: z.string().trim().max(2000).optional().nullable(),
});

export type FollowupFormValues = z.infer<typeof followupFormSchema>;

// 編輯既有追蹤紀錄用 — task_id 不可變更，其餘欄位皆可修改（例如打錯字要能訂正）。
export const followupUpdateSchema = followupFormSchema.omit({ task_id: true }).partial();

export type FollowupUpdateValues = z.infer<typeof followupUpdateSchema>;

export const savedFilterSchema = z.object({
  name: z.string().trim().min(1, "請輸入名稱").max(60),
  filters: z.record(z.string(), z.unknown()),
});

export type SavedFilterValues = z.infer<typeof savedFilterSchema>;
