"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type HubTab = "overview" | "kanban" | "planning";

const VALID_TABS: HubTab[] = ["overview", "kanban", "planning"];

/**
 * Merges the former separate 儀表板 / 看板 / Planning Operations Center pages
 * into one screen with tab switching, so the team isn't hopping between three
 * screens to see the same work. Each panel keeps fetching its own data
 * (server-rendered for 總覽, client-fetched for 看板/Planning) — Radix Tabs
 * only mounts the active panel, so switching tabs is what triggers that
 * panel's first fetch.
 */
export function PlanningHubTabs({
  overview,
  kanban,
  planning,
}: {
  overview: React.ReactNode;
  kanban: React.ReactNode;
  planning: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = React.useState<HubTab>(
    VALID_TABS.includes(initialTab as HubTab) ? (initialTab as HubTab) : "overview"
  );

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as HubTab)} className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="overview">總覽</TabsTrigger>
        <TabsTrigger value="kanban">看板</TabsTrigger>
        <TabsTrigger value="planning">Planning</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="kanban">{kanban}</TabsContent>
      <TabsContent value="planning">{planning}</TabsContent>
    </Tabs>
  );
}
