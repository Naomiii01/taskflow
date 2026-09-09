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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDepartments, useFleet, useProjectOptions, useUsers } from "@/hooks/use-lookups";
import { useCreateTask, useUpdateTask, type TaskRow } from "@/hooks/use-tasks";
import {
  AIRCRAFT_TYPES,
  CROSS_DEPT_UNITS,
  IMPACT_LEVELS,
  IMPACT_LEVEL_LABELS,
  PLANNING_STATUSES,
  PLANNING_STATUS_LABELS,
  STATIONS,
  STATION_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  WORK_CATEGORIES,
  WORK_CATEGORY_LABELS,
} from "@/lib/constants";
import { taskFormSchema, type TaskFormValues } from "@/lib/validations/task";

const NONE = "__none__";

function toFormValues(task?: TaskRow | null, initialTitle?: string): TaskFormValues {
  return {
    title: task?.title ?? initialTitle ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "P3",
    status: task?.status,
    department_id: task?.department_id ?? "",
    owner_id: task?.owner_id ?? null,
    due_date: task?.due_date ?? "",
    followup_date: task?.followup_date ?? "",
    tags: task?.tags ?? [],
    // Phase 6.5: Aviation Planning Operations Center
    aircraft_type: task?.aircraft_type ?? null,
    aircraft_registration: task?.aircraft_registration ?? null,
    station: task?.station ?? null,
    work_category: task?.work_category ?? null,
    planning_month: task?.planning_month ?? "",
    source_department: task?.source_department ?? null,
    waiting_owner: task?.waiting_owner ?? null,
    planning_status: task?.planning_status ?? null,
    impact_level: task?.impact_level ?? null,
    project_id: task?.project_id ?? null,
  };
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  initialTitle,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass a task to edit it; omit to create a new one. */
  task?: TaskRow | null;
  /** Prefills the title when creating (ignored when editing). */
  initialTitle?: string;
  /** Called with the newly created task (create mode only), e.g. to auto-link an attachment. */
  onCreated?: (task: TaskRow) => void;
}) {
  const isEdit = !!task;
  const { data: departments } = useDepartments();
  const { data: users } = useUsers();
  const { data: projects } = useProjectOptions();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [tagsInput, setTagsInput] = React.useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: toFormValues(task, initialTitle),
  });

  const previousAircraftType = React.useRef<string | null | undefined>(undefined);
  React.useEffect(() => {
    if (open) {
      const values = toFormValues(task, initialTitle);
      reset(values);
      setTagsInput((values.tags ?? []).join(", "));
      // Reset doesn't count as a user-driven aircraft type change — don't
      // let the cascade effect below clear the registration it just loaded.
      previousAircraftType.current = values.aircraft_type;
    }
  }, [open, task, initialTitle, reset]);

  const departmentId = watch("department_id");
  const ownerId = watch("owner_id");
  const priority = watch("priority");
  const status = watch("status");
  const aircraftType = watch("aircraft_type");
  const aircraftRegistration = watch("aircraft_registration");
  const station = watch("station");
  const workCategory = watch("work_category");
  const sourceDepartment = watch("source_department");
  const waitingOwner = watch("waiting_owner");
  const planningStatus = watch("planning_status");
  const impactLevel = watch("impact_level");
  const projectId = watch("project_id");

  // Aircraft Type 選擇後 Aircraft Registration 自動過濾（切換機型時清空原本的機號）。
  const { data: fleet } = useFleet(aircraftType ?? undefined);
  React.useEffect(() => {
    if (previousAircraftType.current !== aircraftType) {
      previousAircraftType.current = aircraftType;
      setValue("aircraft_registration", null);
    }
  }, [aircraftType, setValue]);

  const onSubmit = async (values: TaskFormValues) => {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      ...values,
      tags,
      description: values.description || null,
      due_date: values.due_date || null,
      followup_date: values.followup_date || null,
      planning_month: values.planning_month || null,
    };

    if (isEdit && task) {
      await updateTask.mutateAsync({ id: task.id, values: payload });
    } else {
      const created = await createTask.mutateAsync(payload);
      onCreated?.(created);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯任務" : "新增任務"}</DialogTitle>
          <DialogDescription>
            {isEdit ? `任務編號 ${task?.task_number}` : "填寫任務資訊，儲存後會立即寫入資料庫。"}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">任務名稱 *</Label>
            <Input id="title" {...register("title")} placeholder="例如：跟進客戶課程延期申請" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">說明</Label>
            <textarea
              id="description"
              {...register("description")}
              rows={3}
              className="flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder="補充任務細節（選填）"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>優先級 *</Label>
              <Select value={priority} onValueChange={(v) => setValue("priority", v as TaskFormValues["priority"])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>部門 *</Label>
              <Select value={departmentId} onValueChange={(v) => setValue("department_id", v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="選擇部門" /></SelectTrigger>
                <SelectContent>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.department_id && <p className="text-xs text-destructive">{errors.department_id.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>負責人</Label>
              <Select
                value={ownerId ?? NONE}
                onValueChange={(v) => setValue("owner_id", v === NONE ? null : v)}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="未指派" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>未指派</SelectItem>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label>狀態</Label>
                <Select value={status} onValueChange={(v) => setValue("status", v as TaskFormValues["status"])}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="due_date">到期日</Label>
              <Input id="due_date" type="date" {...register("due_date")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="followup_date">追蹤日</Label>
              <Input id="followup_date" type="date" {...register("followup_date")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tags">標籤</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="以逗號分隔，例如：VIP, 續約"
            />
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium text-muted-foreground">航空維修 Planning</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Aircraft Type</Label>
                <Select
                  value={aircraftType ?? NONE}
                  onValueChange={(v) => setValue("aircraft_type", v === NONE ? null : v)}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="未指定" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>未指定</SelectItem>
                    {AIRCRAFT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Aircraft Registration</Label>
                <Select
                  value={aircraftRegistration ?? NONE}
                  onValueChange={(v) => setValue("aircraft_registration", v === NONE ? null : v)}
                  disabled={!aircraftType}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={aircraftType ? "選擇機號" : "請先選擇 Aircraft Type"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>未指定</SelectItem>
                    {fleet?.map((f) => (
                      <SelectItem key={f.id} value={f.aircraft_registration}>{f.aircraft_registration}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Station</Label>
                <Select value={station ?? NONE} onValueChange={(v) => setValue("station", v === NONE ? null : v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="未指定" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>未指定</SelectItem>
                    {STATIONS.map((s) => (
                      <SelectItem key={s} value={s}>{STATION_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Work Category</Label>
                <Select
                  value={workCategory ?? NONE}
                  onValueChange={(v) => setValue("work_category", v === NONE ? null : v)}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="未指定" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>未指定</SelectItem>
                    {WORK_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{WORK_CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="planning_month">Planning Month</Label>
                <Input id="planning_month" type="month" {...register("planning_month")} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Planning Status</Label>
                <Select
                  value={planningStatus ?? NONE}
                  onValueChange={(v) => setValue("planning_status", v === NONE ? null : v)}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="未指定" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>未指定</SelectItem>
                    {PLANNING_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{PLANNING_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Source Department（需求來源）</Label>
                <Select
                  value={sourceDepartment ?? NONE}
                  onValueChange={(v) => setValue("source_department", v === NONE ? null : v)}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="未指定" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>未指定</SelectItem>
                    {CROSS_DEPT_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Waiting Owner（等待回覆單位）</Label>
                <Select
                  value={waitingOwner ?? NONE}
                  onValueChange={(v) => setValue("waiting_owner", v === NONE ? null : v)}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="未指定" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>未指定</SelectItem>
                    {CROSS_DEPT_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Impact Level</Label>
                <Select
                  value={impactLevel ?? NONE}
                  onValueChange={(v) => setValue("impact_level", v === NONE ? null : v)}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="未指定" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>未指定</SelectItem>
                    {IMPACT_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>{IMPACT_LEVEL_LABELS[l]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Project（專案）</Label>
                <Select value={projectId ?? NONE} onValueChange={(v) => setValue("project_id", v === NONE ? null : v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="未指定" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>未指定</SelectItem>
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.code} － {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "儲存變更" : "建立任務"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
