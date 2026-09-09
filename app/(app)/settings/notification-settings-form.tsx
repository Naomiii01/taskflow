"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNotificationSettings, useUpdateNotificationSettings } from "@/hooks/use-notifications";

const ROWS: { key: "email_enabled" | "in_app_enabled" | "push_enabled" | "daily_summary_enabled" | "weekly_summary_enabled"; label: string; description: string }[] = [
  { key: "email_enabled", label: "Email 通知", description: "重要通知同步寄送到你的 Email。" },
  { key: "in_app_enabled", label: "站內通知", description: "顯示於通知中心與導覽列鈴鐺。" },
  { key: "push_enabled", label: "Push 通知", description: "透過瀏覽器 / PWA 推播即時提醒。" },
  { key: "daily_summary_enabled", label: "每日摘要", description: "每天早上 9:00 收到今日待辦、超期與待追蹤總覽。" },
  { key: "weekly_summary_enabled", label: "每週摘要", description: "每週一早上 9:00 收到新增、完成、部門排行總覽。" },
];

export function NotificationSettingsForm() {
  const { data: settings, isLoading } = useNotificationSettings();
  const updateSettings = useUpdateNotificationSettings();

  if (isLoading || !settings) {
    return <p className="text-sm text-muted-foreground">載入中…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {ROWS.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={row.key} className="text-sm font-medium">
              {row.label}
            </Label>
            <p className="text-xs text-muted-foreground">{row.description}</p>
          </div>
          <Switch
            id={row.key}
            checked={settings[row.key]}
            disabled={updateSettings.isPending}
            onCheckedChange={(checked) => updateSettings.mutate({ [row.key]: checked })}
          />
        </div>
      ))}
    </div>
  );
}
