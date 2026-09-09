import { z } from "zod";

export const chatRequestSchema = z.object({
  conversation_id: z.string().uuid().optional(),
  message: z.string().trim().min(1, "請輸入問題").max(4000),
});

export type ChatRequestValues = z.infer<typeof chatRequestSchema>;

export const historyQuerySchema = z.object({
  conversation_id: z.string().uuid().optional(),
});

export const reportRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }),
  z.object({ type: z.literal("weekly") }),
  z.object({ type: z.literal("monthly"), month: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
  z.object({ type: z.literal("project"), keyword: z.string().trim().min(1).max(100) }),
  z.object({ type: z.literal("department"), department_id: z.string().uuid() }),
]);

export type ReportRequestValues = z.infer<typeof reportRequestSchema>;

export const searchRequestSchema = z.object({
  q: z.string().trim().min(1, "請輸入搜尋內容").max(500),
});

export type SearchRequestValues = z.infer<typeof searchRequestSchema>;
