import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlanningHubTabs } from "@/components/planning/planning-hub-tabs";
import { TasksClient } from "@/app/(app)/tasks/tasks-client";
import { PlanningClient } from "./planning-client";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Planning Operations Center" };

// 儀表板／看板／Planning Operations Center 三個畫面已合併成一個頁面，用分頁籤
// 切換（Planning／任務列表），不用再讓大家在三個畫面之間跳來跳去。總覽分頁
// 依需求移除（單人使用意義不大），Planning 排在任務列表前面。
export default async function PlanningPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          {user.name ? `${user.name}，早安 — Planning Operations Center` : "Planning Operations Center"}
        </h1>
        <p className="text-sm text-muted-foreground">
          團隊工作看板與航空維修 Planning 都在這裡，切換上方分頁籤即可。
        </p>
      </div>

      <PlanningHubTabs
        tasks={<TasksClient showHeader={false} />}
        planning={<PlanningClient showHeader={false} />}
      />
    </div>
  );
}
