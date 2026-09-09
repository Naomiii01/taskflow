import "server-only";

import { differenceInCalendarDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import type { EngineTaskSnapshot } from "@/lib/repositories/tasks-repository";
import * as followupsRepo from "@/lib/repositories/followups-repository";
import * as notificationsRepo from "@/lib/repositories/notifications-repository";
import { runFollowUpDueEngine } from "@/lib/services/follow-up-service";
import { notifyOnce } from "@/lib/services/engine-utils";
import { AI_MODEL, extractJson, getAnthropicClient } from "@/lib/ai/anthropic-client";
import { DUE_SOON_WINDOWS, FOLLOWUP_MONITOR_THRESHOLDS } from "@/lib/constants";
import type { EngineRunResult } from "@/types/domain";

type DB = SupabaseClient<Database, "taskflow">;

function latestActivityFor(task: EngineTaskSnapshot, latestActivityMap: Map<string, string>) {
  const latestFollowupAt = latestActivityMap.get(task.id);
  return latestFollowupAt && latestFollowupAt > task.updated_at ? latestFollowupAt : task.updated_at;
}

/** Reminder Engine: 今日/明日/3天內到期 → task_due_soon. */
export async function checkDueSoon(supabase: DB, tasks: EngineTaskSnapshot[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let created = 0;

  for (const t of tasks) {
    if (!t.due_date || !t.owner_id) continue;
    const due = new Date(`${t.due_date}T00:00:00`);
    const diff = differenceInCalendarDays(due, today);
    if (!(DUE_SOON_WINDOWS as readonly number[]).includes(diff)) continue;

    const label = diff === 0 ? "今天" : diff === 1 ? "明天" : `${diff} 天後`;
    const ok = await notifyOnce(supabase, {
      userId: t.owner_id,
      relatedTaskId: t.id,
      type: "task_due_soon",
      title: `任務即將到期：${t.title}`,
      message: `任務 ${t.task_number} 將於${label}（${t.due_date}）到期，請確認進度。`,
    });
    if (ok) created++;
  }
  return created;
}

/** Overdue Engine: buckets into 超期1-3天 / 4-7天 / 8天以上 → task_overdue. */
export async function checkOverdue(supabase: DB, tasks: EngineTaskSnapshot[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let created = 0;

  for (const t of tasks) {
    if (!t.due_date || !t.owner_id) continue;
    const due = new Date(`${t.due_date}T00:00:00`);
    const daysOverdue = differenceInCalendarDays(today, due);
    if (daysOverdue <= 0) continue;

    const bucket = daysOverdue <= 3 ? "超期1-3天" : daysOverdue <= 7 ? "超期4-7天" : "超期8天以上";
    const ok = await notifyOnce(supabase, {
      userId: t.owner_id,
      relatedTaskId: t.id,
      type: "task_overdue",
      title: `⚠️ 任務已超期：${t.title}`,
      message: `任務 ${t.task_number} 已超期 ${daysOverdue} 天（${bucket}），請盡快處理。`,
    });
    if (ok) created++;
  }
  return created;
}

/** Follow-up Monitoring Engine: 7天提醒 / 14天警示 / 30天升級通知 → followup_due. */
export async function checkFollowupMonitoring(
  supabase: DB,
  tasks: EngineTaskSnapshot[],
  latestActivityMap: Map<string, string>
) {
  let created = 0;

  for (const t of tasks) {
    if (!t.owner_id) continue;
    const days = differenceInCalendarDays(new Date(), new Date(latestActivityFor(t, latestActivityMap)));

    let tier: "reminder" | "warning" | "escalationNotice" | null = null;
    if (days >= FOLLOWUP_MONITOR_THRESHOLDS.escalationNotice) tier = "escalationNotice";
    else if (days >= FOLLOWUP_MONITOR_THRESHOLDS.warning) tier = "warning";
    else if (days >= FOLLOWUP_MONITOR_THRESHOLDS.reminder) tier = "reminder";
    if (!tier) continue;

    const copy = {
      reminder: {
        title: `待追蹤提醒：${t.title}`,
        message: `任務 ${t.task_number} 已超過 7 天未更新，建議盡快追蹤。`,
      },
      warning: {
        title: `⚠️ 追蹤警示：${t.title}`,
        message: `任務 ${t.task_number} 已超過 14 天未更新，請優先處理。`,
      },
      escalationNotice: {
        title: `🔺 已建立升級通知：${t.title}`,
        message: `任務 ${t.task_number} 已超過 30 天未更新，已通知相關主管進行升級處理。`,
      },
    }[tier];

    const ok = await notifyOnce(supabase, {
      userId: t.owner_id,
      relatedTaskId: t.id,
      type: "followup_due",
      ...copy,
    });
    if (ok) created++;
  }
  return created;
}

const AI_SUGGESTION_CAP = 10;
const AI_SUGGESTION_COOLDOWN_DAYS = 7;

/** Smart Follow-up Engine: AI drafts a follow-up suggestion + date for stale
 * Waiting Response / Pending Approval tasks. Soft-fails (returns 0) if
 * ANTHROPIC_API_KEY isn't configured — this is a bonus, not a blocker. */
export async function generateSmartFollowupSuggestions(
  supabase: DB,
  tasks: EngineTaskSnapshot[],
  latestActivityMap: Map<string, string>
) {
  const candidates = tasks
    .filter((t) => t.owner_id && (t.status === "Waiting Response" || t.status === "Pending Approval"))
    .map((t) => ({ t, days: differenceInCalendarDays(new Date(), new Date(latestActivityFor(t, latestActivityMap))) }))
    .filter((x) => x.days >= FOLLOWUP_MONITOR_THRESHOLDS.reminder)
    .sort((a, b) => b.days - a.days)
    .slice(0, AI_SUGGESTION_CAP);

  if (!candidates.length) return 0;

  let anthropic;
  try {
    anthropic = getAnthropicClient();
  } catch {
    return 0;
  }

  let created = 0;
  const cooldownSince = new Date(Date.now() - AI_SUGGESTION_COOLDOWN_DAYS * 86400000).toISOString();

  for (const { t, days } of candidates) {
    const alreadySuggested = await notificationsRepo.notificationExistsSince(supabase, {
      userId: t.owner_id!,
      relatedTaskId: t.id,
      type: "ai_recommendation",
      since: cooldownSince,
    });
    if (alreadySuggested) continue;

    try {
      const message = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content:
              `任務「${t.title}」（編號 ${t.task_number}）目前狀態為「${t.status}」，已 ${days} 天沒有更新。` +
              `請以繁體中文給出一句簡短具體的追蹤建議，並建議下一次追蹤日期（以今天為基準）。` +
              `以 JSON 回覆 {"suggestion": string, "suggested_date": "YYYY-MM-DD"}，只回傳 JSON，不要有其他文字。`,
          },
        ],
      });
      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") continue;
      const parsed = extractJson<{ suggestion: string; suggested_date?: string }>(textBlock.text);

      await notificationsRepo.createNotification(supabase, {
        user_id: t.owner_id!,
        related_task_id: t.id,
        type: "ai_recommendation",
        title: `AI 追蹤建議：${t.title}`,
        message: parsed.suggested_date ? `${parsed.suggestion}（建議追蹤日：${parsed.suggested_date}）` : parsed.suggestion,
      });
      created++;
    } catch (err) {
      console.error("[reminder-engine] AI suggestion failed for task", t.id, err);
    }
  }
  return created;
}

/** Runs the full daily sweep: due-soon + overdue + follow-up monitoring + AI suggestions. */
export async function runReminderEngine(supabase: DB): Promise<EngineRunResult> {
  const tasks = await tasksRepo.findOpenTasksForEngines(supabase);
  const followups = await followupsRepo.findFollowupsByTasks(supabase, tasks.map((t) => t.id));

  const latestActivityMap = new Map<string, string>();
  for (const f of followups) {
    const existing = latestActivityMap.get(f.task_id);
    if (!existing || f.created_at > existing) latestActivityMap.set(f.task_id, f.created_at);
  }

  const dueSoon = await checkDueSoon(supabase, tasks);
  const overdue = await checkOverdue(supabase, tasks);
  const followupMonitoring = await checkFollowupMonitoring(supabase, tasks, latestActivityMap);
  const aiSuggestions = await generateSmartFollowupSuggestions(supabase, tasks, latestActivityMap);
  // Phase 6.5 Follow-up Center 到期自動提醒 rides along on the same daily
  // sweep — it's the same "a follow-up is due" signal, just for Waiting
  // Center / Supervisor Center entities instead of tasks.
  const planningFollowUps = (await runFollowUpDueEngine(supabase)).notificationsCreated;

  return {
    ran: true,
    notificationsCreated: dueSoon + overdue + followupMonitoring + aiSuggestions + planningFollowUps,
    details: { dueSoon, overdue, followupMonitoring, aiSuggestions, planningFollowUps },
  };
}
