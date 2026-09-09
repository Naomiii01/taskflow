import type { Metadata } from "next";

import { TaskDetailClient } from "./task-detail-client";

export const metadata: Metadata = { title: "任務詳情" };

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaskDetailClient taskId={id} />;
}
