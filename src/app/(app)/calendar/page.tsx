import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "行事曆" };

export default function CalendarPage() {
  return (
    <ComingSoon
      icon={CalendarDays}
      title="行事曆"
      phase={5}
      description="月 / 週 / 日檢視，顯示到期日與追蹤日"
      bullets={[
        "月檢視、週檢視、日檢視切換",
        "顯示 Due Date 與 Follow Up Date",
        "與自動提醒系統整合，每日 09:00 產出提醒清單",
      ]}
    />
  );
}
