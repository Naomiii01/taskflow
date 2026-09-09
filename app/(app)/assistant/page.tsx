import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AssistantClient } from "./assistant-client";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "AI 助理" };

export default async function AssistantPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <AssistantClient />;
}
