"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OwnerAvatar, PriorityBadge, SmartFollowupIndicator, StatusBadge } from "@/components/tasks/task-badges";
import type { TaskFilters, TaskRow } from "@/hooks/use-tasks";

type SortableColumn = "task_number" | "title" | "priority" | "status" | "due_date" | "followup_date" | "updated_at";

const COLUMNS: { key: SortableColumn; label: string }[] = [
  { key: "task_number", label: "任務編號" },
  { key: "title", label: "標題" },
  { key: "priority", label: "優先級" },
  { key: "status", label: "狀態" },
  { key: "due_date", label: "到期日" },
  { key: "followup_date", label: "追蹤日" },
  { key: "updated_at", label: "最後更新" },
];

export function TaskTable({
  tasks,
  total,
  filters,
  onFiltersChange,
  onEdit,
  onDelete,
}: {
  tasks: TaskRow[];
  total: number;
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  onEdit: (task: TaskRow) => void;
  onDelete: (task: TaskRow) => void;
}) {
  const router = useRouter();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleSort = (column: SortableColumn) => {
    if (filters.sortBy === column) {
      onFiltersChange({ ...filters, sortDir: filters.sortDir === "asc" ? "desc" : "asc" });
    } else {
      onFiltersChange({ ...filters, sortBy: column, sortDir: "asc" });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col.key}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort(col.key)}
                  >
                    {col.label}
                    {filters.sortBy === col.key ? (
                      filters.sortDir === "asc" ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-30" />
                    )}
                  </button>
                </TableHead>
              ))}
              <TableHead>部門</TableHead>
              <TableHead>負責人</TableHead>
              <TableHead>跟進狀態</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                  沒有符合條件的任務
                </TableCell>
              </TableRow>
            )}
            {tasks.map((task) => (
              <TableRow
                key={task.id}
                className="cursor-pointer"
                onClick={() => router.push(`/tasks/${task.id}`)}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">{task.task_number}</TableCell>
                <TableCell className="max-w-[220px] truncate font-medium">{task.title}</TableCell>
                <TableCell><PriorityBadge priority={task.priority} /></TableCell>
                <TableCell><StatusBadge status={task.status} /></TableCell>
                <TableCell>{task.due_date ?? "—"}</TableCell>
                <TableCell>{task.followup_date ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(task.updated_at).toLocaleDateString("zh-TW")}
                </TableCell>
                <TableCell>{task.department?.department_name ?? "未分配"}</TableCell>
                <TableCell><OwnerAvatar name={task.owner?.name} /></TableCell>
                <TableCell><SmartFollowupIndicator state={task.smartFollowup} /></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(task)}>
                        <Pencil className="size-3.5" /> 編輯
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
                        <Trash2 className="size-3.5" /> 刪除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          共 {total} 筆，第 {page} / {totalPages} 頁
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onFiltersChange({ ...filters, page: page - 1 })}
          >
            上一頁
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onFiltersChange({ ...filters, page: page + 1 })}
          >
            下一頁
          </Button>
        </div>
      </div>
    </div>
  );
}
