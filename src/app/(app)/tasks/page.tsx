import type { Metadata } from "next";

import { TasksClient } from "./tasks-client";

export const metadata: Metadata = { title: "任務列表" };

export default function TasksPage() {
  return <TasksClient />;
}
