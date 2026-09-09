"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavLinks } from "./nav-links";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu />
          <span className="sr-only">開啟選單</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="glass-panel w-72 text-sidebar-foreground p-0">
        <SheetHeader className="border-b border-sidebar-border">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold shadow-soft">
              TF
            </div>
            TaskFlow
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-3">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
