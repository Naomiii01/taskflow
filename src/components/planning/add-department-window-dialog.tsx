"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AircraftOption } from "@/components/planning/add-ground-window-dialog";
import {
  useCreateDepartmentWindow,
  useDeleteDepartmentWindow,
  useUpdateDepartmentWindow,
  type PlanningBoardDepartmentWindow,
} from "@/hooks/use-aircraft-planning";
import { departmentWindowSchema, type DepartmentWindowValues } from "@/lib/validations/planning";

function emptyValues(defaultAircraft?: string, defaultDateIso?: string): DepartmentWindowValues {
  return {
    aircraft_registration: defaultAircraft ?? "",
    department: "基地",
    start_date: defaultDateIso ?? "",
    end_date: defaultDateIso ?? "",
    description: "",
  };
}

function valuesFromWindow(aircraftRegistration: string, window: PlanningBoardDepartmentWindow): DepartmentWindowValues {
  return {
    aircraft_registration: aircraftRegistration,
    department: window.department,
    start_date: window.startDate,
    end_date: window.endDate,
    description: window.description ?? "",
  };
}

/**
 * 新增／編輯一段「機坪／基地部門標示」——哪個部門正在執行這架飛機的工作。
 * 通常從年度維修計畫表匯入，但臨時計畫（例如 HMV 提前/延後）常會變動，所以
 * 開放直接在畫面上編輯，不用每次都回頭改資料庫。跟地面時間格子不同，這裡是
 * 純日期區間（不含時分），結束日含當天。
 */
export function AddDepartmentWindowDialog({
  open,
  onOpenChange,
  aircraftOptions,
  editingWindow,
  editingAircraftRegistration,
  defaultAircraftRegistration,
  defaultDateIso,
  readOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftOptions: AircraftOption[];
  editingWindow?: PlanningBoardDepartmentWindow | null;
  editingAircraftRegistration?: string;
  defaultAircraftRegistration?: string;
  defaultDateIso?: string;
  readOnly?: boolean;
}) {
  const isEditing = !!editingWindow && !!editingAircraftRegistration;
  const createWindow = useCreateDepartmentWindow();
  const updateWindow = useUpdateDepartmentWindow();
  const deleteWindow = useDeleteDepartmentWindow();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentWindowValues>({
    resolver: zodResolver(departmentWindowSchema),
    defaultValues: emptyValues(defaultAircraftRegistration, defaultDateIso),
  });

  React.useEffect(() => {
    if (!open) return;
    if (isEditing && editingWindow && editingAircraftRegistration) {
      reset(valuesFromWindow(editingAircraftRegistration, editingWindow));
    } else {
      reset(emptyValues(defaultAircraftRegistration, defaultDateIso));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditing, editingWindow, editingAircraftRegistration, defaultAircraftRegistration, defaultDateIso]);

  const aircraftRegistration = watch("aircraft_registration");
  const department = watch("department");
  const startDate = watch("start_date");
  const endDate = watch("end_date");

  const onSubmit = async (values: DepartmentWindowValues) => {
    if (isEditing && editingWindow) {
      await updateWindow.mutateAsync({ id: editingWindow.id, values });
    } else {
      await createWindow.mutateAsync(values);
    }
    onOpenChange(false);
  };

  const onDelete = async () => {
    if (!editingWindow) return;
    await deleteWindow.mutateAsync(editingWindow.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "編輯部門標示" : "新增部門標示"}</DialogTitle>
          <DialogDescription>
            標示這段期間這架飛機是機坪維修部（接送機LINE上作業）還是基地維修部（長地停重工）在執行，通常來自年度維修計畫表，臨時計畫異動時可以直接在這裡修改。
          </DialogDescription>
        </DialogHeader>
        {readOnly && (
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
            檢視模式——您的帳號目前沒有 Aircraft Planning Board 的編輯權限，只能查看內容。
          </div>
        )}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <fieldset disabled={readOnly} className="contents">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>機號 *</Label>
                <Select
                  value={aircraftRegistration}
                  onValueChange={(v) => setValue("aircraft_registration", v)}
                  disabled={isEditing}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="選擇機號" /></SelectTrigger>
                  <SelectContent>
                    {aircraftOptions.map((a) => (
                      <SelectItem key={a.registration} value={a.registration}>
                        {a.registration}（{a.aircraftType}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.aircraft_registration && (
                  <p className="text-xs text-destructive">{errors.aircraft_registration.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>部門 *</Label>
                <Select value={department} onValueChange={(v) => setValue("department", v as DepartmentWindowValues["department"])}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="機坪">機坪維修部</SelectItem>
                    <SelectItem value="基地">基地維修部</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="start_date">起始日 *</Label>
                <Input id="start_date" type="date" value={startDate} onChange={(e) => setValue("start_date", e.target.value)} />
                {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="end_date">結束日 *（含當天）</Label>
                <Input id="end_date" type="date" value={endDate} onChange={(e) => setValue("end_date", e.target.value)} />
                {errors.end_date && <p className="text-xs text-destructive">{errors.end_date.message}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">工作說明</Label>
              <Textarea id="description" rows={2} {...register("description")} placeholder="選填，例如：C01、48MO、結構維修⋯" />
            </div>
          </fieldset>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {isEditing && !readOnly ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
                刪除
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {readOnly ? "關閉" : "取消"}
              </Button>
              {!readOnly && (
                <Button type="submit" disabled={isSubmitting}>
                  {isEditing ? "儲存變更" : "新增"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
