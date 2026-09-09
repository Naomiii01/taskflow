import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "default" | "warning" | "critical" | "success";
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 pt-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tabular-nums leading-none">{value}</span>
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            tone === "default" && "bg-primary/10 text-primary",
            tone === "warning" && "bg-[color-mix(in_oklab,var(--warning)_18%,transparent)] text-[var(--warning)]",
            tone === "critical" && "bg-destructive/10 text-destructive",
            tone === "success" && "bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]"
          )}
        >
          <Icon className="size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}
