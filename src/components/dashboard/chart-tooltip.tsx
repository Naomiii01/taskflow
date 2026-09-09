"use client";

type ChartTooltipPayloadItem = {
  name?: string;
  value?: number | string;
  color?: string;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
};

export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-popover px-3 py-2 text-xs shadow-soft-lg">
      {label !== undefined && <div className="mb-1 font-medium text-popover-foreground">{label}</div>}
      <div className="flex flex-col gap-0.5">
        {payload.map((entry, i) => (
          <div key={entry.name ?? i} className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums text-popover-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
