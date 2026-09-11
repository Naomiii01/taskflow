"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type HubTab = "planning" | "tasks";

const VALID_TABS: HubTab[] = ["planning", "tasks"];

/**
 * Merges the former separate 看板 / 任務列表 / Planning Operations Center
 * pages into one screen with tab switching, so the team isn't hopping
 * between screens to see the same work. (看板分頁後來依需求移除，改用任務
 * 列表分頁呈現任務；總覽分頁後來也依需求移除，因為對單人使用的看板意義不
 * 大，Planning 分頁已經涵蓋每日重點。) Radix Tabs only mounts the active
 * panel, so switching tabs is what triggers that panel's first fetch.
 * Planning 排在任務列表前面，因為那是每天一開始最先要看的內容。
 */
export function PlanningHubTabs({
  tasks,
  planning,
}: {
  tasks: React.ReactNode;
  planning: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = React.useState<HubTab>(
    VALID_TABS.includes(initialTab as HubTab) ? (initialTab as HubTab) : "planning"
  );

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as HubTab)} className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="planning">Planning</TabsTrigger>
        <TabsTrigger value="tasks">任務列表</TabsTrigger>
      </TabsList>
      <TabsContent value="planning">{planning}</TabsContent>
      <TabsContent value="tasks">{tasks}</TabsContent>
    </Tabs>
  );
}
