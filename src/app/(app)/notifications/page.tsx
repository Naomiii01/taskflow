import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NotificationsClient } from "./notifications-client";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "通知中心" };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <NotificationsClient role={user.role} />;
}
