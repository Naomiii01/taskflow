import type { Metadata } from "next";
import { Building2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { getDepartmentWorkload } from "@/lib/services/departments-service";

export const metadata: Metadata = { title: "部門管理" };
export const revalidate = 0;

export default async function DepartmentsPage() {
  const supabase = await createClient();
  const departments = await getDepartmentWorkload(supabase);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">部門管理</h1>
        <Badge variant="secondary">Department Workload</Badge>
      </div>

      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <span className="inline-flex items-center gap-2">
                    <Building2 className="size-4" /> 部門名稱
                  </span>
                </TableHead>
                <TableHead>主管</TableHead>
                <TableHead>任務數</TableHead>
                <TableHead>完成率</TableHead>
                <TableHead>超期數</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.department}</TableCell>
                  <TableCell className="text-muted-foreground">{d.managerName ?? "未指派"}</TableCell>
                  <TableCell className="tabular-nums">{d.taskCount}</TableCell>
                  <TableCell className="tabular-nums">{d.completionRate}%</TableCell>
                  <TableCell className={d.overdueCount > 0 ? "font-medium text-destructive" : "tabular-nums"}>
                    {d.overdueCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        資料即時計算自 <code className="rounded bg-muted px-1 py-0.5">taskflow.tasks</code>
        。新增部門與指派主管的完整管理介面規劃於後續版本推出。
      </p>
    </div>
  );
}
