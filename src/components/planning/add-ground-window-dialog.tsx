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
import {
  useCreateGroundWindow,
  useDeleteGroundWindow,
  useUpdateGroundWindow,
  type PlanningBoardWindow,
} from "@/hooks/use-aircraft-planning";
import { groundWindowSchema, type GroundWindowValues } from "@/lib/validations/planning";
import { STATIONS, STATION_LABELS } from "@/lib/constants";

export type AircraftOption = { registration: string; aircraftType: string; homeStation: string };

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
  };
}

function valuesFromWindow(aircraftRegistration: string, window: PlanningBoardWindow): GroundWindowValues {
  return {
    aircraft_registration: aircraftRegistration,
    station: window.station,
    arrival_at: window.arrivalAt,
    departure_at: window.departureAt,
    notes: window.notes ?? "",
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

  const aircraftRegistration = watch("aircraft_registration");
  const station = watch("station");
  const arrivalAt = watch("arrival_at");
  const departureAt = watch("departure_at");

  const onSubmit = async (values: GroundWindowValues) => {
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
