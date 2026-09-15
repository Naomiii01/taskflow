"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  useCreateGroundWindow,
  useDeleteGroundWindow,
  useLinkableTasks,
  useUpdateGroundWindow,
  type PlanningBoardWindow,
} from "@/hooks/use-aircraft-planning";
import { groundWindowSchema, type GroundWindowValues } from "@/lib/validations/planning";
import {
  AIRCRAFT_CURRENT_STATUS_LABELS,
  AIRCRAFT_CURRENT_STATUSES,
  MAJOR_WORK_PLANNING_STATUS_LABELS,
  MAJOR_WORK_PLANNING_STATUSES,
  STATIONS,
  STATION_LABELS,
} from "@/lib/constants";

export type AircraftOption = { registration: string; aircraftType: string; homeStation: string };

const NONE_VALUE = "__none__";

/** Converts our storage format (a plain ISO string that is never timezone-
 * converted — see aircraft-planning-service.ts) to/from the value an
 * `<input type="datetime-local">` needs, which is just the same wall-clock
 * digits with no "Z" suffix. Plain string slicing both ways keeps this
 * feature's one consistent rule: never let a real timezone conversion touch
 * these values. */
function isoToLocalInput(iso: string) {
  return iso.slice(0, 16);
}
function localInputToIso(value: string) {
  return `${value}:00.000Z`;
}

function emptyValues(defaultAircraft?: string, defaultStation?: string, defaultDateIso?: string): GroundWindowValues {
  const arrival = defaultDateIso ? `${defaultDateIso}T08:00` : "";
  const departure = defaultDateIso ? `${defaultDateIso}T18:00` : "";
  return {
    aircraft_registration: defaultAircraft ?? "",
    station: defaultStation ?? STATIONS[0],
    arrival_at: arrival ? localInputToIso(arrival) : "",
    departure_at: departure ? localInputToIso(departure) : "",
    notes: "",
    current_status: null,
    major_work_planned: "",
    estimated_mh: null,
    required_skill: "",
    required_equipment: "",
    required_authorization: "",
    planning_status: null,
  };
}

function valuesFromWindow(aircraftRegistration: string, window: PlanningBoardWindow): GroundWindowValues {
  return {
    aircraft_registration: aircraftRegistration,
    station: window.station,
    arrival_at: window.arrivalAt,
    departure_at: window.departureAt,
    notes: window.notes ?? "",
    current_status: (window.currentStatus as GroundWindowValues["current_status"]) ?? null,
    major_work_planned: window.majorWorkPlanned ?? "",
    estimated_mh: window.estimatedMh,
    required_skill: window.requiredSkill ?? "",
    required_equipment: window.requiredEquipment ?? "",
    required_authorization: window.requiredAuthorization ?? "",
    planning_status: (window.planningStatus as GroundWindowValues["planning_status"]) ?? null,
  };
}

/**
 * 新增／編輯一段地面時間（進站～離站）。從機板的空白格點「＋」新增時會帶入
 * 該機號跟那一天的日期；點既有的色塊則是編輯／刪除那一段。
 */
export function AddGroundWindowDialog({
  open,
  onOpenChange,
  aircraftOptions,
  editingWindow,
  editingAircraftRegistration,
  defaultAircraftRegistration,
  defaultStation,
  defaultDateIso,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftOptions: AircraftOption[];
  editingWindow?: PlanningBoardWindow | null;
  editingAircraftRegistration?: string;
  defaultAircraftRegistration?: string;
  defaultStation?: string;
  defaultDateIso?: string;
}) {
  const isEditing = !!editingWindow && !!editingAircraftRegistration;
  const createWindow = useCreateGroundWindow();
  const updateWindow = useUpdateGroundWindow();
  const deleteWindow = useDeleteGroundWindow();
  // 工單連結只在編輯模式提供——新增中的窗口還沒有 id 可以連結。
  const { data: linkableTasks } = useLinkableTasks();
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GroundWindowValues>({
    resolver: zodResolver(groundWindowSchema),
    defaultValues: emptyValues(defaultAircraftRegistration, defaultStation, defaultDateIso),
  });

  React.useEffect(() => {
    if (!open) return;
    if (isEditing && editingWindow && editingAircraftRegistration) {
      reset(valuesFromWindow(editingAircraftRegistration, editingWindow));
    } else {
      reset(emptyValues(defaultAircraftRegistration, defaultStation, defaultDateIso));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditing, editingWindow, editingAircraftRegistration, defaultAircraftRegistration, defaultStation, defaultDateIso]);

  React.useEffect(() => {
    if (!open) return;
    if (isEditing && editingWindow && linkableTasks) {
      setSelectedTaskIds(linkableTasks.filter((t) => t.linkedGroundWindowId === editingWindow.id).map((t) => t.id));
    } else {
      setSelectedTaskIds([]);
    }
  }, [open, isEditing, editingWindow, linkableTasks]);

  const aircraftRegistration = watch("aircraft_registration");
  const station = watch("station");
  const arrivalAt = watch("arrival_at");
  const departureAt = watch("departure_at");
  const currentStatus = watch("current_status");
  const planningStatus = watch("planning_status");

  const toggleTask = (taskId: string, checked: boolean) => {
    setSelectedTaskIds((prev) => (checked ? [...prev, taskId] : prev.filter((id) => id !== taskId)));
  };

  const onSubmit = async (values: GroundWindowValues) => {
    if (isEditing && editingWindow) {
      await updateWindow.mutateAsync({ id: editingWindow.id, values: { ...values, linked_task_ids: selectedTaskIds } });
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "編輯地面時間" : "新增地面時間"}</DialogTitle>
          <DialogDescription>登記這架飛機在某一站的進站～離站時間，用來算可用窗口與過夜機會。</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
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
              <Label>站別 *</Label>
              <Select value={station} onValueChange={(v) => setValue("station", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATIONS.map((s) => (
                    <SelectItem key={s} value={s}>{STATION_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="arrival_at">進站時間 *</Label>
              <Input
                id="arrival_at"
                type="datetime-local"
                value={arrivalAt ? isoToLocalInput(arrivalAt) : ""}
                onChange={(e) => setValue("arrival_at", e.target.value ? localInputToIso(e.target.value) : "")}
              />
              {errors.arrival_at && <p className="text-xs text-destructive">{errors.arrival_at.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="departure_at">離站時間 *</Label>
              <Input
                id="departure_at"
                type="datetime-local"
                value={departureAt ? isoToLocalInput(departureAt) : ""}
                onChange={(e) => setValue("departure_at", e.target.value ? localInputToIso(e.target.value) : "")}
              />
              {errors.departure_at && <p className="text-xs text-destructive">{errors.departure_at.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">備註</Label>
            <Input id="notes" {...register("notes")} placeholder="選填" />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">規劃資訊（選填——若這段地面時間有排大工再填）</p>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>航機現況</Label>
                  <Select
                    value={currentStatus ?? NONE_VALUE}
                    onValueChange={(v) => setValue("current_status", v === NONE_VALUE ? null : (v as GroundWindowValues["current_status"]))}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="未設定" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>未設定</SelectItem>
                      {AIRCRAFT_CURRENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{AIRCRAFT_CURRENT_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>規劃狀態</Label>
                  <Select
                    value={planningStatus ?? NONE_VALUE}
                    onValueChange={(v) => setValue("planning_status", v === NONE_VALUE ? null : (v as GroundWindowValues["planning_status"]))}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="未設定" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>未設定</SelectItem>
                      {MAJOR_WORK_PLANNING_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{MAJOR_WORK_PLANNING_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="major_work_planned">計畫大工項目</Label>
                <Textarea id="major_work_planned" rows={2} {...register("major_work_planned")} placeholder="例如：C 級檢查、引擎更換⋯" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="estimated_mh">預估工時（MH）</Label>
                  <Input
                    id="estimated_mh"
                    type="number"
                    step="0.1"
                    min="0"
                    {...register("estimated_mh", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
                    placeholder="選填"
                  />
                  {errors.estimated_mh && <p className="text-xs text-destructive">{errors.estimated_mh.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="required_skill">所需技術能力</Label>
                  <Input id="required_skill" {...register("required_skill")} placeholder="選填" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="required_equipment">所需設備</Label>
                  <Input id="required_equipment" {...register("required_equipment")} placeholder="選填" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="required_authorization">所需授權資格</Label>
                  <Input id="required_authorization" {...register("required_authorization")} placeholder="選填" />
                </div>
              </div>

              {isEditing && (
                <div className="flex flex-col gap-1.5">
                  <Label>排入此窗口的工單</Label>
                  {!linkableTasks ? (
                    <p className="text-xs text-muted-foreground">載入中⋯</p>
                  ) : linkableTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">目前沒有待辦工單可供排入</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto rounded-md border p-2 flex flex-col gap-2">
                      {linkableTasks.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedTaskIds.includes(t.id)}
                            onCheckedChange={(checked) => toggleTask(t.id, checked === true)}
                          />
                          <span className="truncate">{t.taskNumber} {t.title}</span>
                          {t.linkedGroundWindowId && t.linkedGroundWindowId !== editingWindow?.id && (
                            <span className="text-xs text-muted-foreground shrink-0">（已排入其他窗口）</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {isEditing ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
                刪除
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isEditing ? "儲存變更" : "新增"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
