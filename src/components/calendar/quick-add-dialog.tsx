"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";

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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCreateCalendarEvent, useDeleteCalendarEvent, useUpdateCalendarEvent } from "@/hooks/use-calendar";
import { calendarEventFormSchema, type CalendarEventFormValues } from "@/lib/validations/calendar";
import { CALENDAR_EVENT_TYPE_LABELS, CALENDAR_EVENT_TYPES, TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/constants";
import type { CalendarItem } from "@/types/domain";

const NONE = "__none__";

function emptyValues(dateIso: string): CalendarEventFormValues {
  return { title: "", event_date: dateIso, start_time: "", end_time: "", event_type: "Meeting", priority: null, notes: "" };
}

/** Quick Add — 使用者點選日期即可新增工作，也用同一個對話框編輯既有的
 * calendar_events 項目（來自 Task/追蹤紀錄/主管交辦等其他來源的項目不可在此
 * 編輯，請到各自的頁面處理，符合各功能單一資料來源的原則）。 */
export function QuickAddDialog({
  open,
  onOpenChange,
  defaultDate,
  editingItem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  /** Only calendar_event-sourced items can be edited here. */
  editingItem: (CalendarItem & { source: "calendar_event" }) | null;
}) {
  const isEditing = !!editingItem;
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CalendarEventFormValues>({
    resolver: zodResolver(calendarEventFormSchema),
    defaultValues: emptyValues(defaultDate),
  });

  React.useEffect(() => {
    if (!open) return;
    if (editingItem) {
      reset({
        title: editingItem.title,
        event_date: editingItem.date,
        start_time: editingItem.startTime ?? "",
        end_time: editingItem.endTime ?? "",
        event_type: editingItem.eventType ?? "Meeting",
        priority: editingItem.priority,
        notes: "",
      });
    } else {
      reset(emptyValues(defaultDate));
    }
  }, [open, defaultDate, editingItem, reset]);

  const onSubmit = async (values: CalendarEventFormValues) => {
    if (isEditing && editingItem) {
      await updateEvent.mutateAsync({ id: editingItem.sourceId, values });
    } else {
      await createEvent.mutateAsync(values);
    }
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "編輯工作" : "新增工作"}</DialogTitle>
            <DialogDescription>{editingItem?.date ?? defaultDate}</DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">標題 *</Label>
              <Input id="title" {...register("title")} placeholder="例如：與 LE 討論修管月計畫" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event_date">日期 *</Label>
                <Input id="event_date" type="date" {...register("event_date")} />
                {errors.event_date && <p className="text-xs text-destructive">{errors.event_date.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="start_time">開始時間</Label>
                <Input id="start_time" type="time" {...register("start_time")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="end_time">結束時間</Label>
                <Input id="end_time" type="time" {...register("end_time")} />
                {errors.end_time && <p className="text-xs text-destructive">{errors.end_time.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>類型</Label>
                <Controller
                  control={control}
                  name="event_type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CALENDAR_EVENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{CALENDAR_EVENT_TYPE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>優先級</Label>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="未指定" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>未指定</SelectItem>
                        {TASK_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">備註</Label>
              <textarea
                id="notes"
                rows={3}
                {...register("notes")}
                className="flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>

            <DialogFooter className="sm:justify-between">
              {isEditing ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="size-3.5" /> 刪除
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

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="刪除這筆工作"
        description="確定要刪除這筆行事曆工作嗎？此動作無法復原。"
        confirmLabel="刪除"
        loading={deleteEvent.isPending}
        onConfirm={async () => {
          if (!editingItem) return;
          await deleteEvent.mutateAsync(editingItem.sourceId);
          setConfirmDeleteOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
