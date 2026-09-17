import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AircraftPlanningBoard } from "@/components/planning/aircraft-planning-board";
import { getCurrentUser, canEditPlanningBoard } from "@/lib/auth";

export const metadata: Metadata = { title: "Aircraft Planning Board" };

// Phase 6.6 pivot: 系統過度以 Task / Calendar 為中心，但航空維修規劃的核心其實
// 是 Aircraft Availability / Ground Time / Overnight Opportunity（之後再擴充
// Station/Manpower/Equipment/Authorization/Due Risk）。這個畫面現在是登入後
// 的預設主畫面，Planning Operations Center（Task/Waiting/Supervisor/Project/
// 原本的每日簡報）整個保留，改成側邊選單裡的另一個項目。
export default async function AircraftBoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <AircraftPlanningBoard canEdit={canEditPlanningBoard(user)} />;
}
