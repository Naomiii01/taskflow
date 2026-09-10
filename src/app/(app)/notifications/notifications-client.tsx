"use client";

import * as React from "react";
import { CheckCheck, Trash2, X } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelectFilter } from "@/components/tasks/multi-select-filter";
import { NotificationList } from "@/components/notifications/notification-list";
import { useDeleteNotifications, useMarkAllNotificationsRead, useNotifications } from "@/hooks/use-notifications";
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/types/database.types";

export function NotificationsClient({ role }: { role: UserRole }) {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<string[]>([]);
  const [readFilter, setReadFilter] = React.useState<"all" | "unread" | "read">("all");
  const [mine, setMine] = React.useState(role === "User");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

  const { data, isLoading } = useNotifications({
    q: q || undefined,
    type,
    is_read: readFilter === "all" ? undefined : readFilter === "read",
    mine,
    pageSize: 50,
  });
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotifications = useDeleteNotifications();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">通知中心</h1>
          <p className="text-sm text-muted-foreground">
            任務指派、到期提醒、超期警示、待追蹤、部門延遲、AI 建議與文件處理通知。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
          <CheckCheck className="size-4" /> 全部標為已讀
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <Tabs value={readFilter} onValueChange={(v) => setReadFilter(v as typeof readFilter)}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="unread">未讀</TabsTrigger>
              <TabsTrigger value="read">已讀</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="搜尋通知內容…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 w-44 text-xs"
            />
            <MultiSelectFilter
              label="類型"
              options={NOTIFICATION_TYPES.map((t) => ({ value: t, label: NOTIFICATION_TYPE_LABELS[t] }))}
              selected={type}
              onChange={setType}
            />
            {role !== "User" && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
                只看我的通知
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
              <span>已選擇 {selectedIds.size} 筆通知</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  <X className="size-3.5" /> 取消選取
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="size-3.5" /> 刪除選取項目
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">載入中…</p>
          ) : (
            <NotificationList
              notifications={data?.data ?? []}
              emptyMessage={readFilter === "unread" ? "沒有未讀通知。" : "目前沒有符合條件的通知。"}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="刪除選取的通知"
        description={`確定要刪除選取的 ${selectedIds.size} 筆通知嗎？刪除後無法復原。`}
        confirmLabel="刪除"
        loading={deleteNotifications.isPending}
        onConfirm={async () => {
          await deleteNotifications.mutateAsync(Array.from(selectedIds));
          setSelectedIds(new Set());
          setBulkDeleteOpen(false);
        }}
      />
    </div>
  );
}
