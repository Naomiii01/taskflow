import Link from "next/link";

import { NavLinks } from "./nav-links";

export function Sidebar() {
  return (
    <aside className="glass-panel hidden w-64 shrink-0 flex-col border-r text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Link href="/planning" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="flex size-7 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold shadow-soft">
            TF
          </div>
          <span>TaskFlow</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        <NavLinks />
      </div>
      <div className="border-t border-sidebar-border p-3 text-xs text-muted-foreground">
        Aviation Planning Operations Center
      </div>
    </aside>
  );
}
