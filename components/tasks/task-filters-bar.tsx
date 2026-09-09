"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDepartments, useUsers } from "@/hooks/use-lookups";
import type { TaskFilters } from "@/hooks/use-tasks";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";
import { MultiSelectFilter } from "@/components/tasks/multi-select-filter";

export function TaskFiltersBar({
  filters,
  onChange,
}: {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}) {
  const { data: departments } = useDepartments();
  const { data: users } = useUsers();

  const hasActiveFilters =
    !!filters.q ||
    !!filters.status?.length ||
    !!filters.priority?.length ||
    !!filters.department_id?.length ||
    !!filters.owner_id?.length ||
    !!filters.dueThisWeek ||
    !!filters.overdue;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜尋任務編號、標題、內容…"
          className="pl-8"
          value={filters.q ?? ""}
          onChange={(e) => onChange({ ...filters, q: e.target.value, page: 1 })}
        />
      </div>

      <MultiSelectFilter
        label="狀態"
        options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
        selected={filters.status ?? []}
        onChange={(status) => onChange({ ...filters, status, page: 1 })}
      />
      <MultiSelectFilter
        label="優先級"
        options={TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))}
        selected={filters.priority ?? []}
        onChange={(priority) => onChange({ ...filters, priority, page: 1 })}
      />
      <MultiSelectFilter
        label="部門"
        options={(departments ?? []).map((d) => ({ value: d.id, label: d.department_name }))}
        selected={filters.department_id ?? []}
        onChange={(department_id) => onChange({ ...filters, department_id, page: 1 })}
      />
      <MultiSelectFilter
        label="負責人"
        options={(users ?? []).map((u) => ({ value: u.id, label: u.name ?? u.email }))}
        selected={filters.owner_id ?? []}
        onChange={(owner_id) => onChange({ ...filters, owner_id, page: 1 })}
      />

      <Button
        variant={filters.dueThisWeek ? "default" : "outline"}
        size="sm"
        onClick={() => onChange({ ...filters, dueThisWeek: !filters.dueThisWeek, overdue: false, page: 1 })}
      >
        本週到期
      </Button>
      <Button
        variant={filters.overdue ? "default" : "outline"}
        size="sm"
        onClick={() => onChange({ ...filters, overdue: !filters.overdue, dueThisWeek: false, page: 1 })}
      >
        超期事項
      </Button>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() =>
            onChange({ sortBy: filters.sortBy, sortDir: filters.sortDir, page: 1, pageSize: filters.pageSize })
          }
        >
          <X className="size-3.5" /> 清除篩選
        </Button>
      )}
    </div>
  );
}
