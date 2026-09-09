import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import * as checklistService from "@/lib/services/checklist-service";
import * as waitingRepo from "@/lib/repositories/waiting-repository";
import * as supervisorRepo from "@/lib/repositories/supervisor-repository";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import { findTopRiskTasks } from "@/lib/services/risk-detection";
import { notifyOnce } from "@/lib/services/engine-utils";
import * as notificationSettingsRepo from "@/lib/repositories/notification-settings-repository";
import { getAnthropicClient, AI_MODEL } from "@/lib/ai/anthropic-client";
import { PLANNING_MONTHLY_MILESTONES } from "@/lib/constants";
import type { PlanningBriefing, EngineRunResult } from "@/types/domain";

type DB = SupabaseClient<Database, "taskflow">;

/** 退工/新增工單 don't have dedicated tables in this spec — the Daily
 * Checklist is where Planning staff records what happened for those two
 * items each day, so the count is read from that item's note (a leading
 * number, e.g. "退工 2 件"). No number in the note but the item is checked
 * off still counts as confirmed-with-zero rather than unknown. */
function countFromChecklistNote(note: string | null | undefined, isCompleted: boolean): number {
  if (!isCompleted) return 0;
  const match = note?.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function buildFallbackNarrative(stats: {
  checklistCompletionRate: number;
  waitingCount: number;
  supervisorOpenCount: number;
  overdueCount: number;
  riskNote: string;
}) {
  return (
    `今日檢查清單完成度 ${stats.checklistCompletionRate}%，` +
    `目前有 ${stats.waitingCount} 件跨部門等待回覆事項、${stats.supervisorOpenCount} 件主管交辦事項待處理、` +
    `${stats.overdueCount} 件任務已超期。${stats.riskNote}`
  );
}

/**
 * Daily AI Briefing (08:00): 昨日發工確認結果/退工統計/新增工單統計/待追蹤事項/
 * 等待回覆事項/主管交辦事項/本週重點工作/本月重要節點/超期事項/AI風險提醒.
 * All the underlying numbers are computed deterministically (same engines the
 * rest of the app uses); only the `narrative` paragraph is AI-generated, and
 * falls back to a plain-text summary if ANTHROPIC_API_KEY isn't configured.
 */
export async function computeDailyBriefing(supabase: DB): Promise<PlanningBriefing> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [checklist, waitingItems, supervisorTasks, planningTasks, topRisks] = await Promise.all([
    checklistService.getTodayChecklist(supabase),
    waitingRepo.findWaitingItems(supabase, { status: "Waiting" }),
    supervisorRepo.findSupervisorTasks(supabase),
    tasksRepo.findAllTasksForPlanning(supabase),
    findTopRiskTasks(supabase, 3),
  ]);

  const dispatchItem = checklist.items.find((i) => i.item_key === "prior_day_dispatch");
  const returnedItem = checklist.items.find((i) => i.item_key === "returned_work");
  const newWorkItem = checklist.items.find((i) => i.item_key === "new_work_order");

  const overdueCount = planningTasks.filter(
    (t) => t.due_date && !["Completed", "Cancelled"].includes(t.status) && t.due_date < todayStr
  ).length;
  const supervisorOpenCount = supervisorTasks.filter((t) => t.status === "Open" || t.status === "In Progress").length;

  const thisWeekHighlights = planningTasks
    .filter((t) => {
      if (!t.due_date || ["Completed", "Cancelled"].includes(t.status)) return false;
      const due = new Date(`${t.due_date}T00:00:00`);
      return due >= today && due <= weekEnd;
    })
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 8)
    .map((t) => `${t.title}（${t.task_number}，到期 ${t.due_date}）`);

  const thisMonthMilestones = PLANNING_MONTHLY_MILESTONES.map((m) => ({
    day: m.day,
    label: m.label,
    isPast: m.day < today.getDate(),
    isToday: m.day === today.getDate(),
  }));

  const riskNote = topRisks.length
    ? `AI 風險提醒：${topRisks.map((r) => `${r.title}（風險分數 ${r.score}）`).join("、")}，建議優先處理。`
    : "AI 風險提醒：目前無明顯高風險任務。";

  const stats = {
    date: todayStr,
    checklist,
    checklistCompletionRate: checklist.completionRate,
    returnedWorkCount: countFromChecklistNote(returnedItem?.note, returnedItem?.is_completed ?? false),
    newWorkOrderCount: countFromChecklistNote(newWorkItem?.note, newWorkItem?.is_completed ?? false),
    waitingCount: waitingItems.length,
    supervisorOpenCount,
    overdueCount,
    thisWeekHighlights,
    thisMonthMilestones,
    riskNote,
  };

  let narrative: string;
  try {
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content:
            `你是航空維修 Planning 部門的助理，請根據以下今日資料，用繁體中文寫一段 3-5 句的「每日簡報」摘要，語氣專業精簡：\n` +
            `昨日發工確認：${dispatchItem?.is_completed ? "已完成" : "尚未確認"}\n` +
            `退工件數：${stats.returnedWorkCount}\n新增工單件數：${stats.newWorkOrderCount}\n` +
            `跨部門等待回覆：${stats.waitingCount} 件\n主管交辦待處理：${stats.supervisorOpenCount} 件\n超期任務：${stats.overdueCount} 件\n` +
            `本週重點工作：${thisWeekHighlights.join("、") || "無"}\n${riskNote}\n` +
            `只回傳摘要文字，不要加標題或條列符號。`,
        },
      ],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    narrative = textBlock && textBlock.type === "text" ? textBlock.text.trim() : buildFallbackNarrative(stats);
  } catch {
    narrative = buildFallbackNarrative(stats);
  }

  return { ...stats, narrative };
}

/** Scheduler entry point (08:00): computes the briefing for every user opted
 * into 每日摘要 and files it as a `daily_summary` notification (reused per
 * the Phase 6.5 decision to avoid a new notification_type enum value). */
export async function runDailyBriefingEngine(supabase: DB): Promise<EngineRunResult> {
  const briefing = await computeDailyBriefing(supabase);
  const userIds = await notificationSettingsRepo.findUsersOptedIntoDigest(supabase, "daily_summary_enabled");

  let created = 0;
  for (const userId of userIds) {
    const ok = await notifyOnce(supabase, {
      userId,
      relatedTaskId: null,
      type: "daily_summary",
      title: `🛩️ Planning 每日簡報（${briefing.date}）`,
      message: briefing.narrative,
    });
    if (ok) created++;
  }

  return { ran: true, notificationsCreated: created, details: { usersNotified: created } };
}
