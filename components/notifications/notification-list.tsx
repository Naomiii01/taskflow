"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  FileCheck2,
  Lightbulb,
  ListTodo,
  Megaphone,
  PencilLine,
  Trash2,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_TYPE_BADGE, NOTIFICATION_TYPE_LABELS } from "@/lib/constants";
import { useDeleteNotification, useMarkNotificationRead } from "@/hooks/use-notifications";
import type { NotificationWithTask } from "@/types/domain";
import type { NotificationType } from "@/types/database.types";

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  task_assigned: ListTodo,
  task_updated: PencilLine,
  task_overdue: AlertTriangle,
  task_due_soon: CalendarClock,
  followup_due: Bell,
  department_delay: TrendingUp,
  ai_recommendation: Lightbulb,
  document_processed: FileCheck2,
  escalation: Megaphone,
  daily_summary: CalendarClock,
  weekly_summary: CalendarClock,
};

export function NotificationList({
  notifications,
  emptyMessage = "目前沒有通知",
}: {
  notifications: NotificationWithTask[];
  emptyMessage?: string;
}) {
  const markRead = useMarkNotificationRead();
  const deleteNotification = useDeleteNotification();

  if (!notifications.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col divide-y overflow-hidden rounded-xl border border-border/70">
      {notifications.map((n) => {
        const Icon = TYPE_ICON[n.type] ?? Bell;
        const body = (
          <div className="flex flex-1 min-w-0 items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {!n.is_read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                <p className={n.is_read ? "text-sm text-muted-foreground" : "text-sm font-medium"}>{n.title}</p>
                <Badge variant={NOTIFICATION_TYPE_BADGE[n.type]} className="ml-auto shrink-0 sm:ml-0">
                  {NOTIFICATION_TYPE_LABELS[n.type]}
                </Badge>
              </div>
              {n.message && <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: zhTW })}
                {n.task && <> · {n.task.task_number} {n.task.title}</>}
              </p>
            </div>
          </div>
        );

        return (
          <div key={n.id} className="flex items-start gap-2 p-3 hover:bg-muted/50">
            {n.related_task_id ? (
              <Link
                href={`/tasks/${n.related_task_id}`}
                className="flex flex-1 min-w-0"
                onClick={() => !n.is_read && markRead.mutate({ id: n.id, is_read: true })}
              >
                {body}
              </Link>
            ) : (
              <button
                type="button"
                className="flex flex-1 min-w-0 text-left"
                onClick={() => !n.is_read && markRead.mutate({ id: n.id, is_read: true })}
              >
                {body}
              </button>
            )}
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => markRead.mutate({ id: n.id, is_read: !n.is_read })}
              >
                {n.is_read ? "標為未讀" : "標為已讀"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:text-destructive"
                onClick={() => deleteNotification.mutate(n.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
