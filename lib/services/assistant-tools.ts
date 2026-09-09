import "server-only";

import { differenceInCalendarDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";

import type { Database } from "@/types/database.types";
import * as tasksRepo from "@/lib/repositories/tasks-repository";
import type { EngineTaskSnapshot } from "@/lib/repositories/tasks-repository";
import * as followupsRepo from "@/lib/repositories/followups-repository";
import * as lookupsRepo from "@/lib/repositories/lookups-repository";
import { taskQuerySchema } from "@/lib/validations/task";
import { findTopRiskTasks } from "@/lib/services/risk-detection";
import { computeDepartmentDelay } from "@/lib/services/department-delay";
import { searchDocuments } from "@/lib/services/attachments-service";
import * as checklistService from "@/lib/services/checklist-service";
import * as waitingService from "@/lib/services/waiting-service";
import * as supervisorService from "@/lib/services/supervisor-service";
import { listProjectSummaries } from "@/lib/services/project-service";
import {
  AIRCRAFT_TYPES,
  CROSS_DEPT_UNITS,
  FOLLOWUP_MONITOR_THRESHOLDS,
  PLANNING_STATUSES,
  STATIONS,
  WORK_CATEGORIES,
} from "@/lib/constants";
import type { CrossDeptUnit, SupervisorTaskStatus, WaitingStatus } from "@/types/database.types";

type DB = SupabaseClient<Database, "taskflow">;

/**
 * Natural Language Query Layer — implemented as Claude tool-use over a fixed
 * set of read-only, parameterized query functions, NOT as "AI writes raw SQL
 * and we execute it". Letting a model generate arbitrary SQL against a
 * production database is a real security risk (injection-style abuse,
 * accidental writes, runaway queries, RLS bypass via crafted queries) for no
 * real benefit here — the assistant only ever needs to ask a small, known
 * set of questions about tasks/followups/documents. Each tool below is a
 * thin, safe wrapper around the same repository/service functions the rest
 * of the app already uses, so the assistant can't do anything a normal user
 * of the UI couldn't already do.
 */

async function findDepartmentByName(supabase: DB, name: string) {
  const departments = await lookupsRepo.findAllDepartments(supabase);
  const term = name.trim().toLowerCase();
  return (
    departments.find((d) => d.department_name.toLowerCase() === term) ??
    departments.find((d) => d.department_name.toLowerCase().includes(term) || term.includes(d.department_name.toLowerCase())) ??
    null
  );
}

function summarizeTask(t: EngineTaskSnapshot | (EngineTaskSnapshot & { department_name?: string })) {
  return {
    task_number: t.task_number,
    title: t.title,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    department_name: "department_name" in t ? t.department_name : undefined,
  };
}

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_tasks_due_soon",
    description: "查詢今天/明天/3天內到期的任務清單。用於回答「今天有哪些待辦」「本週到期有哪些任務」之類的問題。",
    input_schema: {
      type: "object",
      properties: {
        window: { type: "string", enum: ["today", "tomorrow", "3days", "this_week"], description: "查詢區間，預設 today" },
      },
    },
  },
  {
    name: "get_overdue_tasks",
    description: "查詢目前已超期的任務，可選擇依部門篩選。用於回答「哪些任務超期」「工程部有哪些卡關事項」之類的問題。",
    input_schema: {
      type: "object",
      properties: {
        department_name: { type: "string", description: "部門名稱關鍵字（選填），例如「工程部」「採購部」" },
      },
    },
  },
  {
    name: "get_stale_tasks",
    description: "查詢已經超過 N 天沒有更新/追蹤的任務。用於回答「哪些事項超過14天沒更新」「哪些待追蹤」之類的問題。",
    input_schema: {
      type: "object",
      properties: {
        min_days: { type: "number", description: "無更新天數門檻，預設 7" },
        department_name: { type: "string", description: "部門名稱關鍵字（選填）" },
      },
    },
  },
  {
    name: "get_project_status",
    description:
      "依關鍵字（通常是專案代號或任務編號的一部分，例如「KHH」）查詢符合的任務，回傳總數/完成率/進行中/超期數與清單。用於回答「XX專案進度如何」之類的問題。",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "專案代號或關鍵字，會比對任務編號、標題、標籤" },
      },
      required: ["keyword"],
    },
  },
  {
    name: "get_department_analysis",
    description: "查詢單一部門的工作量、平均回覆天數、平均結案天數、超期率。用於回答「XX部門有哪些待追蹤」之類的問題。",
    input_schema: {
      type: "object",
      properties: {
        department_name: { type: "string", description: "部門名稱關鍵字" },
      },
      required: ["department_name"],
    },
  },
  {
    name: "get_monthly_completion",
    description: "查詢某個月份新增/完成/超期的任務數。用於回答「本月完成多少任務」之類的問題。month 省略時預設為本月。",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "格式 YYYY-MM，省略則為本月" },
      },
    },
  },
  {
    name: "get_high_risk_tasks",
    description:
      "查詢目前風險分數（0-100，綜合超期天數/長時間無更新/多部門卡關/重複追蹤）最高的任務。用於回答「最近有哪些高風險事項」之類的問題。",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "回傳筆數上限，預設 10" },
      },
    },
  },
  {
    name: "search_documents",
    description: "以關鍵字搜尋附件檔名、OCR 全文、AI 摘要、Email/Teams/LINE 內容，回傳命中的文件與所屬任務。用於「文件查詢」。",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜尋關鍵字" },
      },
      required: ["query"],
    },
  },

  // --- Phase 6.5: Aviation Planning Operations Center -----------------------
  {
    name: "get_planning_tasks",
    description:
      "依 Aircraft Type/Aircraft Registration/Station/Work Category/Planning Status/Planning Month/等待單位/到期日 等條件篩選任務，回傳筆數、完成率與清單。" +
      "用於回答「A321短天期完成度」「A339本月工作量」「哪些長工時工作尚未安排」「本月20日前還有哪些工作未完成」之類的問題。",
    input_schema: {
      type: "object",
      properties: {
        aircraft_type: { type: "string", enum: [...AIRCRAFT_TYPES], description: "機型" },
        station: { type: "string", enum: [...STATIONS], description: "基地" },
        work_category: { type: "string", enum: [...WORK_CATEGORIES], description: "工作類別" },
        planning_status: { type: "string", enum: [...PLANNING_STATUSES], description: "規劃狀態" },
        planning_month: { type: "string", description: "規劃月份，格式 YYYY-MM" },
        waiting_owner: { type: "string", enum: [...CROSS_DEPT_UNITS], description: "等待回覆單位" },
        due_before: { type: "string", description: "到期日上限，格式 YYYY-MM-DD（例如本月20日）" },
        due_after: { type: "string", description: "到期日下限，格式 YYYY-MM-DD" },
        unfinished_only: { type: "boolean", description: "只列出尚未完成/取消的任務，預設 false" },
      },
    },
  },
  {
    name: "get_daily_checklist_status",
    description:
      "查詢每日檢查清單（昨日發工完成確認/退工確認/新增工單需求確認/修管需求確認/LE需求確認/工程部需求確認/採購需求確認/主管交辦追蹤）的完成狀態與備註。" +
      "用於回答「今天有哪些工作」「昨天發工完成了嗎」「有哪些退工事項」之類的問題。",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "'today'、'yesterday'，或 YYYY-MM-DD 日期，預設 today" },
      },
    },
  },
  {
    name: "get_waiting_items",
    description:
      "查詢跨部門等待回覆中心（Waiting Center）事項，可依等待單位（修管/LE/工程部/採購/維修部/品保/其他）與狀態篩選，回傳已等待天數與燈號。" +
      "用於回答「有哪些等待工程部回覆」「有哪些等待修管回覆」之類的問題。",
    input_schema: {
      type: "object",
      properties: {
        waiting_unit: { type: "string", enum: [...CROSS_DEPT_UNITS], description: "等待單位" },
        status: { type: "string", enum: ["Waiting", "Replied", "Cancelled"], description: "狀態，預設 Waiting" },
      },
    },
  },
  {
    name: "get_project_progress",
    description:
      "查詢 Project Center 專案進度（預設專案：RMQ/KHH/其他專案），回傳任務數/完成率/待追蹤/超期/風險指數/里程碑。" +
      "用於回答「KHH專案進度」「RMQ專案進度」之類的問題。",
    input_schema: {
      type: "object",
      properties: {
        project_code: { type: "string", description: "專案代號或名稱關鍵字，例如 RMQ、KHH" },
      },
      required: ["project_code"],
    },
  },
  {
    name: "get_supervisor_tasks",
    description: "查詢主管交辦事項（Supervisor Assignment Center），預設只列出待處理/處理中的項目。用於回答「主管交辦還有哪些未完成」之類的問題。",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["Open", "In Progress", "Completed", "Cancelled"], description: "狀態篩選，省略則列出 Open + In Progress" },
      },
    },
  },
];

export async function executeTool(
  supabase: DB,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "get_tasks_due_soon": {
      const window = (args.window as string) ?? "today";
      const tasks = await tasksRepo.findOpenTasksForEngines(supabase);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const matches = tasks.filter((t) => {
        if (!t.due_date) return false;
        const diff = differenceInCalendarDays(new Date(`${t.due_date}T00:00:00`), today);
        if (window === "today") return diff === 0;
        if (window === "tomorrow") return diff === 1;
        if (window === "3days") return diff >= 0 && diff <= 3;
        if (window === "this_week") return diff >= 0 && diff <= 7;
        return diff === 0;
      });
      return { window, count: matches.length, tasks: matches.slice(0, 30).map(summarizeTask) };
    }

    case "get_overdue_tasks": {
      const departmentName = args.department_name as string | undefined;
      const department = departmentName ? await findDepartmentByName(supabase, departmentName) : null;
      const tasks = await tasksRepo.findOpenTasksForEngines(supabase);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overdue = tasks.filter((t) => {
        if (!t.due_date) return false;
        if (department && t.department_id !== department.id) return false;
        return differenceInCalendarDays(today, new Date(`${t.due_date}T00:00:00`)) > 0;
      });
      if (departmentName && !department) return { error: `找不到符合「${departmentName}」的部門` };
      return { department: department?.department_name ?? "全部部門", count: overdue.length, tasks: overdue.slice(0, 30).map(summarizeTask) };
    }

    case "get_stale_tasks": {
      const minDays = (args.min_days as number) ?? FOLLOWUP_MONITOR_THRESHOLDS.reminder;
      const departmentName = args.department_name as string | undefined;
      const department = departmentName ? await findDepartmentByName(supabase, departmentName) : null;
      if (departmentName && !department) return { error: `找不到符合「${departmentName}」的部門` };

      const allTasks = await tasksRepo.findOpenTasksForEngines(supabase);
      const tasks = department ? allTasks.filter((t) => t.department_id === department.id) : allTasks;
      const followups = await followupsRepo.findFollowupsByTasks(supabase, tasks.map((t) => t.id));
      const latestByTask = new Map<string, string>();
      for (const f of followups) {
        const existing = latestByTask.get(f.task_id);
        if (!existing || f.created_at > existing) latestByTask.set(f.task_id, f.created_at);
      }
      const stale = tasks
        .map((t) => {
          const latest = latestByTask.get(t.id);
          const lastActivity = latest && latest > t.updated_at ? latest : t.updated_at;
          const days = differenceInCalendarDays(new Date(), new Date(lastActivity));
          return { t, days };
        })
        .filter((x) => x.days >= minDays)
        .sort((a, b) => b.days - a.days);
      return {
        min_days: minDays,
        department: department?.department_name ?? "全部部門",
        count: stale.length,
        tasks: stale.slice(0, 30).map((x) => ({ ...summarizeTask(x.t), days_since_update: x.days })),
      };
    }

    case "get_project_status": {
      const keyword = String(args.keyword ?? "").trim();
      if (!keyword) return { error: "請提供專案關鍵字" };
      const query = taskQuerySchema.parse({ q: keyword, pageSize: 100, includeDeleted: false });
      // currentUserId only affects the `mine` filter, which we don't set here.
      const { data, total } = await tasksRepo.findTasks(supabase, query, "");
      const completed = data.filter((t) => t.status === "Completed").length;
      const inProgress = data.filter((t) => !["Completed", "Cancelled"].includes(t.status)).length;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overdue = data.filter(
        (t) => t.due_date && !["Completed", "Cancelled"].includes(t.status) && differenceInCalendarDays(today, new Date(`${t.due_date}T00:00:00`)) > 0
      ).length;
      const byDept = new Map<string, number>();
      for (const t of data) {
        const name = t.department?.department_name ?? "未分配";
        byDept.set(name, (byDept.get(name) ?? 0) + 1);
      }
      return {
        keyword,
        total_tasks: total,
        completed,
        in_progress: inProgress,
        overdue,
        completion_rate: total ? Math.round((completed / total) * 100) : 0,
        department_breakdown: Array.from(byDept.entries()).map(([department_name, count]) => ({ department_name, count })),
        sample_tasks: data.slice(0, 15).map((t) => ({
          task_number: t.task_number,
          title: t.title,
          status: t.status,
          due_date: t.due_date,
          department_name: t.department?.department_name ?? null,
        })),
      };
    }

    case "get_department_analysis": {
      const departmentName = String(args.department_name ?? "").trim();
      const department = await findDepartmentByName(supabase, departmentName);
      if (!department) return { error: `找不到符合「${departmentName}」的部門` };
      const departments = await lookupsRepo.findAllDepartments(supabase);
      const delays = await computeDepartmentDelay(supabase, departments);
      const delay = delays.find((d) => d.departmentId === department.id);
      const allTasks = await tasksRepo.findOpenTasksForEngines(supabase);
      const deptTasks = allTasks.filter((t) => t.department_id === department.id);
      return {
        department_name: department.department_name,
        open_tasks: deptTasks.length,
        avg_response_days: delay?.avgResponseDays ?? null,
        avg_resolution_days: delay?.avgResolutionDays ?? null,
        overdue_rate: delay ? Math.round(delay.overdueRate * 100) : 0,
        tasks: deptTasks.slice(0, 20).map(summarizeTask),
      };
    }

    case "get_monthly_completion": {
      const monthStr = args.month as string | undefined;
      const now = monthStr ? new Date(`${monthStr}-01T00:00:00`) : new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const tasks = await tasksRepo.findAllTasksForAnalysis(supabase);
      const created = tasks.filter((t) => {
        const d = new Date(t.created_at);
        return d >= monthStart && d <= monthEnd;
      }).length;
      const completed = tasks.filter((t) => {
        if (t.status !== "Completed") return false;
        const d = new Date(t.updated_at);
        return d >= monthStart && d <= monthEnd;
      }).length;
      const overdue = tasks.filter(
        (t) =>
          t.due_date &&
          t.status !== "Completed" &&
          t.status !== "Cancelled" &&
          differenceInCalendarDays(monthEnd, new Date(`${t.due_date}T00:00:00`)) > 0
      ).length;
      return {
        month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
        created,
        completed,
        overdue,
      };
    }

    case "get_high_risk_tasks": {
      const limit = (args.limit as number) ?? 10;
      const risky = await findTopRiskTasks(supabase, limit);
      return { count: risky.length, tasks: risky };
    }

    case "search_documents": {
      const query = String(args.query ?? "").trim();
      if (!query) return { error: "請提供搜尋關鍵字" };
      const results = await searchDocuments(supabase, query);
      return {
        count: results.length,
        results: results.slice(0, 15).map((r) => ({
          file_name: r.attachment.file_name,
          task_number: r.attachment.task?.task_number ?? null,
          task_title: r.attachment.task?.title ?? null,
          matched_in: r.matchedIn,
        })),
      };
    }

    case "get_planning_tasks": {
      let tasks = await tasksRepo.findAllTasksForPlanning(supabase);
      const aircraftType = args.aircraft_type as string | undefined;
      const station = args.station as string | undefined;
      const workCategory = args.work_category as string | undefined;
      const planningStatus = args.planning_status as string | undefined;
      const planningMonth = args.planning_month as string | undefined;
      const waitingOwner = args.waiting_owner as string | undefined;
      const dueBefore = args.due_before as string | undefined;
      const dueAfter = args.due_after as string | undefined;
      const unfinishedOnly = Boolean(args.unfinished_only);

      if (aircraftType) tasks = tasks.filter((t) => t.aircraft_type === aircraftType);
      if (station) tasks = tasks.filter((t) => t.station === station);
      if (workCategory) tasks = tasks.filter((t) => t.work_category === workCategory);
      if (planningStatus) tasks = tasks.filter((t) => t.planning_status === planningStatus);
      if (planningMonth) tasks = tasks.filter((t) => t.planning_month === planningMonth);
      if (waitingOwner) tasks = tasks.filter((t) => t.waiting_owner === waitingOwner);
      if (dueBefore) tasks = tasks.filter((t) => t.due_date && t.due_date <= dueBefore);
      if (dueAfter) tasks = tasks.filter((t) => t.due_date && t.due_date >= dueAfter);
      if (unfinishedOnly) tasks = tasks.filter((t) => !["Completed", "Cancelled"].includes(t.status));

      const completed = tasks.filter((t) => t.status === "Completed").length;
      return {
        count: tasks.length,
        completed,
        completion_rate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
        tasks: tasks.slice(0, 30).map((t) => ({
          task_number: t.task_number,
          title: t.title,
          status: t.status,
          due_date: t.due_date,
          aircraft_type: t.aircraft_type,
          station: t.station,
          work_category: t.work_category,
          planning_status: t.planning_status,
          planning_month: t.planning_month,
        })),
      };
    }

    case "get_daily_checklist_status": {
      const dateArg = (args.date as string) ?? "today";
      const todayStr = new Date().toISOString().slice(0, 10);
      let dateStr = todayStr;
      if (dateArg === "yesterday") {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        dateStr = d.toISOString().slice(0, 10);
      } else if (dateArg !== "today") {
        dateStr = dateArg;
      }

      const checklist =
        dateStr === todayStr
          ? await checklistService.getTodayChecklist(supabase)
          : await checklistService.getChecklistForDate(supabase, dateStr);
      if (!checklist) return { date: dateStr, found: false, message: "查無該日期的每日檢查清單紀錄" };

      return {
        date: dateStr,
        completion_rate: checklist.completionRate,
        items: checklist.items.map((i) => ({ label: i.item_label, completed: i.is_completed, note: i.note })),
      };
    }

    case "get_waiting_items": {
      const waitingUnit = args.waiting_unit as CrossDeptUnit | undefined;
      const status = (args.status as WaitingStatus) ?? "Waiting";
      const items = await waitingService.listWaitingItems(supabase, { status, waiting_unit: waitingUnit });
      return {
        count: items.length,
        items: items.slice(0, 30).map((i) => ({
          waiting_unit: i.waiting_unit,
          description: i.description,
          created_date: i.created_date,
          expected_reply_date: i.expected_reply_date,
          waiting_days: i.waitingDays,
          color: i.color,
          related_task_number: i.related_task?.task_number ?? null,
        })),
      };
    }

    case "get_project_progress": {
      const keyword = String(args.project_code ?? "").trim();
      if (!keyword) return { error: "請提供專案代號，例如 RMQ 或 KHH" };
      const summaries = await listProjectSummaries(supabase);
      const match =
        summaries.find((p) => p.code.toLowerCase() === keyword.toLowerCase()) ??
        summaries.find((p) => p.name.includes(keyword) || keyword.includes(p.code));
      if (!match) return { error: `找不到專案代號「${keyword}」`, available: summaries.map((p) => p.code) };
      return {
        code: match.code,
        name: match.name,
        task_count: match.taskCount,
        completed: match.completed,
        completion_rate: match.completionRate,
        waiting: match.waiting,
        overdue: match.overdue,
        risk_index: match.riskIndex,
        milestones: match.milestones.map((m) => ({
          title: m.title,
          target_date: m.target_date,
          is_completed: m.is_completed,
        })),
      };
    }

    case "get_supervisor_tasks": {
      const status = args.status as SupervisorTaskStatus | undefined;
      const tasks = await supervisorService.listSupervisorTasks(supabase, status);
      const filtered = status ? tasks : tasks.filter((t) => t.status === "Open" || t.status === "In Progress");
      return {
        count: filtered.length,
        tasks: filtered.slice(0, 30).map((t) => ({
          title: t.title,
          status: t.status,
          due_date: t.due_date,
          priority: t.priority,
          assignee: t.assignee?.name ?? null,
          assigner: t.assigner?.name ?? null,
        })),
      };
    }

    default:
      return { error: `未知的工具：${name}` };
  }
}
