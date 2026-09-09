import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DepartmentDelay } from "@/types/domain";

/** Dashboard "Top Delay Departments": ranked by overdue rate, worst first. */
export function DepartmentDelayTable({ departments }: { departments: DepartmentDelay[] }) {
  if (!departments.length) {
    return <p className="text-sm text-muted-foreground">目前沒有部門資料。</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>部門</TableHead>
          <TableHead className="text-right">進行中任務</TableHead>
          <TableHead className="text-right">平均回覆天數</TableHead>
          <TableHead className="text-right">平均結案天數</TableHead>
          <TableHead className="text-right">超期率</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {departments.map((d) => (
          <TableRow key={d.departmentId}>
            <TableCell className="font-medium">{d.departmentName}</TableCell>
            <TableCell className="text-right tabular-nums">{d.openTasks}</TableCell>
            <TableCell className="text-right tabular-nums">{d.avgResponseDays ?? "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{d.avgResolutionDays ?? "—"}</TableCell>
            <TableCell className="text-right">
              <Badge variant={d.overdueRate >= 0.3 ? "destructive" : d.overdueRate > 0 ? "warning" : "secondary"}>
                {Math.round(d.overdueRate * 100)}%
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
