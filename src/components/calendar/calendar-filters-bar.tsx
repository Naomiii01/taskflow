"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectOptions } from "@/hooks/use-lookups";
import { AIRCRAFT_TYPES, STATION_LABELS, STATIONS } from "@/lib/constants";

const ALL = "__all__";

export type CalendarFilterState = {
  aircraft_type?: string;
  station?: string;
  project_code?: string;
};

export function CalendarFiltersBar({
  value,
  onChange,
}: {
  value: CalendarFilterState;
  onChange: (value: CalendarFilterState) => void;
}) {
  const { data: projects } = useProjectOptions();
  const hasActive = !!value.aircraft_type || !!value.station || !!value.project_code;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.aircraft_type ?? ALL}
        onValueChange={(v) => onChange({ ...value, aircraft_type: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="w-[120px]"><SelectValue placeholder="機型" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>全部機型</SelectItem>
          {AIRCRAFT_TYPES.map((a) => (
            <SelectItem key={a} value={a}>{a}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.station ?? ALL}
        onValueChange={(v) => onChange({ ...value, station: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="基地" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>全部基地</SelectItem>
          {STATIONS.map((s) => (
            <SelectItem key={s} value={s}>{STATION_LABELS[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.project_code ?? ALL}
        onValueChange={(v) => onChange({ ...value, project_code: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="專案" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>全部專案</SelectItem>
          {(projects ?? []).map((p) => (
            <SelectItem key={p.id} value={p.code}>{p.code}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActive && (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange({})}>
          <X className="size-3.5" /> 清除篩選
        </Button>
      )}
    </div>
  );
}
