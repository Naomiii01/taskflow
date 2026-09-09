import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileForm } from "./profile-form";
import { NotificationSettingsForm } from "./notification-settings-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { USER_ROLE_LABELS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "設定" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">個人設定</h1>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>個人資料</CardTitle>
          <CardDescription>更新你的顯示名稱，Email 與角色由管理員管理。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ProfileForm defaultName={user.name ?? ""} />
          <Separator />
          <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.email}</dd>
            <dt className="text-muted-foreground">角色</dt>
            <dd>
              <Badge variant="outline">{USER_ROLE_LABELS[user.role]}</Badge>
            </dd>
            <dt className="text-muted-foreground">加入時間</dt>
            <dd>{new Date(user.created_at).toLocaleString("zh-TW")}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>通知設定</CardTitle>
          <CardDescription>選擇你想接收的通知管道與每日 / 每週摘要。</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}
