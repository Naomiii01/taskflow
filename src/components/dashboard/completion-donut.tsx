"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import type { CompletionRate } from "@/lib/dashboard-queries";

export function CompletionDonut({ data }: { data: CompletionRate }) {
  const rate = data.total === 0 ? 0 : Math.round((data.completed / data.total) * 100);
  const chartData = [
    { name: "已完成", value: data.completed },
    { name: "未完成", value: Math.max(data.total - data.completed, 0) },
  ];

  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius="70%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="var(--card)"
            strokeWidth={2}
          >
            <Cell fill="var(--chart-1)" />
            <Cell fill="var(--muted)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums">{rate}%</span>
        <span className="text-xs text-muted-foreground">
          {data.completed} / {data.total} 件已完成
        </span>
      </div>
    </div>
  );
}
