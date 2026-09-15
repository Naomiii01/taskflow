import { redirect } from "next/navigation";

export default function Home() {
  // Phase 6.6 pivot: Aircraft Planning Board (/aircraft-board) is now the
  // main homepage —航機可用窗口/停留時間/過夜機會 is the actual core of
  // aviation maintenance planning, not the task/calendar-centric Planning
  // Operations Center (still reachable from the sidebar).
  redirect("/aircraft-board");
}
