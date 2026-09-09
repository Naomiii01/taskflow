"use client";

import * as React from "react";
import { CheckCheck } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelectFilter } from "@/components/tasks/multi-select-filter";
import { NotificationList } from "@/components/notifications/notification-list";
import { useMarkAllNotificationsRead, useNotifications } from "@/hooks/use-notifications";
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/types/database.types";

export function NotificationsClient({ role }: { role: UserRole }) {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<string[]>([]);
  const [readFilter, setReadFilter] = React.useState<"all" | "unread" | "read">("all");
  const [mine, setMine] = React.useState(role === "User");

  const { data, isLoading } = useNotifications({
    q: q || undefined,
    type,
    is_read: readFilter === "all" ? undefined : readFilter === "read",
    mine,
    pageSize: 50,
  });
  const markAllRead = useMarkAllNotificationsRead();

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
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">載入中…</p>
          ) : (
            <NotificationList
              notifications={data?.data ?? []}
              emptyMessage={readFilter === "unread" ? "沒有未讀通知。" : "目前沒有符合條件的通知。"}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
