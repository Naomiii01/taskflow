"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNotificationsRealtime, useUnreadCount } from "@/hooks/use-notifications";

/** Navbar bell: shows the live unread count and toasts new notifications as
 * they arrive anywhere in the app (the realtime subscription lives here so
 * it's mounted once, in the Topbar, regardless of which page is open). */
export function NotificationBell({ userId }: { userId: string }) {
  useNotificationsRealtime(userId);
  const { data: unreadCount } = useUnreadCount();

  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link href="/notifications" title="通知中心">
        <Bell />
        {!!unreadCount && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
