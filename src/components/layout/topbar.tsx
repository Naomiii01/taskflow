import Link from "next/link";
import { Search } from "lucide-react";

import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notification-bell";
import type { CurrentUser } from "@/lib/auth";

export function Topbar({ user }: { user: CurrentUser }) {
  return (
    <header className="glass-panel sticky top-0 z-40 flex h-14 items-center gap-2 border-b px-3 md:px-4">
      <MobileNav />
      <Link
        href="/search"
        className="flex flex-1 items-center gap-2 rounded-full border bg-muted/40 px-3.5 py-1.5 text-sm text-muted-foreground max-w-md transition-colors hover:bg-muted/60"
      >
        <Search className="size-4" />
        <span className="truncate">搜尋任務、部門、附件、AI 摘要...</span>
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <NotificationBell userId={user.id} />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
