"use client";

import {
  CheckCircle2,
  Flag,
  History,
  PlusCircle,
  RotateCcw,
  Trash2,
  User as UserIcon,
  CalendarClock,
  Building2,
} from "lucide-react";

import { useDepartments, useUsers } from "@/hooks/use-lookups";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import type { TaskPriority, TaskStatus } from "@/types/database.types";
import type { TaskLogWithUser } from "@/types/domain";

const ACTION_ICON: Record<string, React.ElementType> = {
  created: PlusCircle,
  status_changed: CheckCircle2,
  priority_changed: Flag,
  owner_changed: UserIcon,
  department_changed: Building2,
  due_date_changed: CalendarClock,
  followup_date_changed: History,
  deleted: Trash2,
  restored: RotateCcw,
};

function useLabelResolvers() {
  const { data: users } = useUsers();
  const { data: departments } = useDepartments();

  const userName = (id: unknown) => users?.find((u) => u.id === id)?.name ?? (id ? "（未知使用者）" : "未指派");
  const deptName = (id: unknown) => departments?.find((d) => d.id === id)?.department_name ?? "未分配";

  return { userName, deptName };
}

function describeLog(log: TaskLogWithUser, resolve: ReturnType<typeof useLabelResolvers>) {
  const from = log.old_value as string | null;
  const to = log.new_value as string | null;

  switch (log.action_type) {
    case "created":
      return "建立了這個任務";
    case "status_changed":
      return `狀態從「${TASK_STATUS_LABELS[from as TaskStatus] ?? from ?? "—"}」改為「${TASK_STATUS_LABELS[to as TaskStatus] ?? to}」`;
    case "priority_changed":
      return `優先級從「${TASK_PRIORITY_LABELS[from as TaskPriority] ?? from ?? "—"}」改為「${TASK_PRIORITY_LABELS[to as TaskPriority] ?? to}」`;
    case "owner_changed":
      return `負責人從「${resolve.userName(from)}」改為「${resolve.userName(to)}」`;
    case "department_changed":
      return `部門從「${resolve.deptName(from)}」改為「${resolve.deptName(to)}」`;
    case "due_date_changed":
      return `到期日從「${from ?? "未設定"}」改為「${to ?? "未設定"}」`;
    case "followup_date_changed":
      return `追蹤日從「${from ?? "未設定"}」改為「${to ?? "未設定"}」`;
    case "deleted":
      return "刪除了這個任務（軟刪除）";
    case "restored":
      return "還原了這個任務";
    default:
      return log.action_type;
  }
}

export function ActivityTimeline({ logs }: { logs: TaskLogWithUser[] }) {
  const resolve = useLabelResolvers();

  if (!logs.length) {
    return <p className="text-sm text-muted-foreground">尚無異動紀錄。</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {logs.map((log) => {
        const Icon = ACTION_ICON[log.action_type] ?? History;
        return (
          <li key={log.id} className="flex gap-3">
            <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-3.5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm">
                <span className="font-medium">{log.user?.name ?? "系統"}</span> {describeLog(log, resolve)}
              </p>
              <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("zh-TW")}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
