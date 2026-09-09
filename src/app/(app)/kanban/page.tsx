import type { Metadata } from "next";

import { KanbanClient } from "./kanban-client";

export const metadata: Metadata = { title: "看板" };

export default function KanbanPage() {
  return <KanbanClient />;
}
