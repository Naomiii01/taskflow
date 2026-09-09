import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_BADGE,
  TASK_STATUS_LABELS,
} from "@/lib/constants";
import type { TaskPriority, TaskStatus } from "@/types/database.types";
import type { SmartFollowupState } from "@/types/domain";

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge variant={TASK_PRIORITY_BADGE[priority]}>{TASK_PRIORITY_LABELS[priority]}</Badge>;
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={TASK_STATUS_BADGE[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

export function OwnerAvatar({ name }: { name: string | null | undefined }) {
  const initials = (name ?? "未指派").trim().slice(0, 2);
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="text-sm">{name ?? "未指派"}</span>
    </div>
  );
}

const SMART_DOT: Record<SmartFollowupState["level"], string> = {
  green: "bg-success",
  yellow: "bg-warning",
  red: "bg-destructive",
};

export function SmartFollowupIndicator({ state }: { state: SmartFollowupState }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("size-2 shrink-0 rounded-full", SMART_DOT[state.level])} />
      {state.needsFollowup ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
          <AlertTriangle className="size-3" /> Need Follow-up
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {state.daysSince === null ? "尚無紀錄" : `${state.daysSince} 天前更新`}
        </span>
      )}
    </div>
  );
}
