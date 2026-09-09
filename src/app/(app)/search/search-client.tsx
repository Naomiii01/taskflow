"use client";

import * as React from "react";
import { Search as SearchIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SavedFiltersPanel } from "@/components/tasks/saved-filters-panel";
import { SearchResultRow } from "@/components/tasks/search-result-row";
import { TaskFiltersBar } from "@/components/tasks/task-filters-bar";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskTable } from "@/components/tasks/task-table";
import { DocumentSearchResults } from "@/components/attachments/document-search-results";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSearchTasks } from "@/hooks/use-search";
import { useDeleteTask, useTasks, type TaskFilters, type TaskRow } from "@/hooks/use-tasks";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function SearchClient() {
  const [term, setTerm] = React.useState("");
  const debouncedTerm = useDebouncedValue(term, 300);
  const { data: searchResults, isFetching: searching } = useSearchTasks(debouncedTerm);

  const [filters, setFilters] = React.useState<TaskFilters>({ sortBy: "updated_at", sortDir: "desc", page: 1, pageSize: 10 });
  const { data: filteredTasks, isLoading } = useTasks(filters);

  const [editingTask, setEditingTask] = React.useState<TaskRow | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [deletingTask, setDeletingTask] = React.useState<TaskRow | null>(null);
  const deleteTask = useDeleteTask();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">搜尋中心</h1>
        <p className="text-sm text-muted-foreground">跨任務編號、標題、內容、部門與負責人搜尋，或套用常用篩選條件。</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-5">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="輸入任務編號、標題、內容、部門或負責人姓名…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>

          <Tabs defaultValue="tasks">
            <TabsList>
              <TabsTrigger value="tasks">任務搜尋</TabsTrigger>
              <TabsTrigger value="documents">文件搜尋</TabsTrigger>
            </TabsList>
            <TabsContent value="tasks" className="pt-3">
              {debouncedTerm.trim() ? (
                <div className="flex flex-col gap-2">
                  {searching && <p className="text-sm text-muted-foreground">搜尋中…</p>}
                  {!searching && searchResults?.length === 0 && (
                    <p className="text-sm text-muted-foreground">沒有符合「{debouncedTerm}」的任務。</p>
                  )}
                  {searchResults?.map((task) => (
                    <SearchResultRow key={task.id} task={task} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">輸入關鍵字以搜尋任務編號、標題、內容、部門或負責人。</p>
              )}
            </TabsContent>
            <TabsContent value="documents" className="pt-3">
              <DocumentSearchResults term={debouncedTerm} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <SavedFiltersPanel activeFilters={filters} onApply={setFilters} />
          <TaskFiltersBar filters={filters} onChange={setFilters} />
          {isLoading && !filteredTasks ? (
            <div className="py-10 text-center text-sm text-muted-foreground">載入中…</div>
          ) : (
            <TaskTable
              tasks={filteredTasks?.data ?? []}
              total={filteredTasks?.total ?? 0}
              filters={filters}
              onFiltersChange={setFilters}
              onEdit={(task) => {
                setEditingTask(task);
                setFormOpen(true);
              }}
              onDelete={(task) => setDeletingTask(task)}
            />
          )}
        </CardContent>
      </Card>

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editingTask} />
      <ConfirmDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        title="刪除任務"
        description={`確定要刪除「${deletingTask?.title}」嗎？`}
        confirmLabel="刪除"
        loading={deleteTask.isPending}
        onConfirm={async () => {
          if (!deletingTask) return;
          await deleteTask.mutateAsync(deletingTask.id);
          setDeletingTask(null);
        }}
      />
    </div>
  );
}
