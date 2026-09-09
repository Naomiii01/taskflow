import { z } from "zod";

import { NOTIFICATION_TYPES } from "@/lib/constants";

export const notificationQuerySchema = z.object({
  type: z.array(z.enum(NOTIFICATION_TYPES as [string, ...string[]])).optional(),
  is_read: z.coerce.boolean().optional(),
  q: z.string().trim().optional(),
  /** Manager/Admin default to seeing everything RLS allows them (own +
   * department, or everything); `mine=true` narrows back to just their own,
   * same as what a User always sees regardless of this flag. */
  mine: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;

export const markReadSchema = z.object({
  /** Mark one notification read/unread, or omit `id` + set `all: true` to mark everything read. */
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
  is_read: z.boolean().optional().default(true),
});

export type MarkReadValues = z.infer<typeof markReadSchema>;

export const notificationSettingsSchema = z.object({
  email_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  daily_summary_enabled: z.boolean().optional(),
  weekly_summary_enabled: z.boolean().optional(),
});

export type NotificationSettingsValues = z.infer<typeof notificationSettingsSchema>;
