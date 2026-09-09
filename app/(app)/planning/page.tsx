import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlanningClient } from "./planning-client";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Planning Operations Center" };

export default async function PlanningPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <PlanningClient userName={user.name} />;
}
