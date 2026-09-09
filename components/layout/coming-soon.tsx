import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({
  icon: Icon,
  title,
  phase,
  description,
  bullets,
}: {
  icon: LucideIcon;
  title: string;
  phase: number;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{title}</h1>
        <Badge variant="secondary">Phase {phase} 規劃中</Badge>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-medium">{description}</p>
            <p className="text-sm text-muted-foreground">此功能將於 Phase {phase} 依專案規劃逐步上線。</p>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5 text-left text-sm text-muted-foreground">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                {b}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
