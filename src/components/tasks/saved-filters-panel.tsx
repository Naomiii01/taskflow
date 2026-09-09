"use client";

import * as React from "react";
import { Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreateSavedFilter, useDeleteSavedFilter, useSavedFilters } from "@/hooks/use-saved-filters";
import type { TaskFilters } from "@/hooks/use-tasks";
import { SAVED_FILTER_PRESETS } from "@/lib/constants";

export function SavedFiltersPanel({
  activeFilters,
  onApply,
}: {
  activeFilters: TaskFilters;
  onApply: (filters: TaskFilters) => void;
}) {
  const { data } = useSavedFilters();
  const createFilter = useCreateSavedFilter();
  const deleteFilter = useDeleteSavedFilter();
  const [name, setName] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    await createFilter.mutateAsync({ name: name.trim(), filters: activeFilters });
    setName("");
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">常用篩選：</span>
        {SAVED_FILTER_PRESETS.map((preset) => (
          <Button
            key={preset.name}
            variant="outline"
            size="sm"
            onClick={() => onApply({ ...preset.filters, page: 1 } as TaskFilters)}
          >
            {preset.name}
          </Button>
        ))}

        {data?.data.map((f) => (
          <span key={f.id} className="inline-flex items-center gap-1 rounded-xl border px-2 py-1">
            <button
              type="button"
              className="text-sm hover:underline"
              onClick={() => onApply({ ...(f.filters as TaskFilters), page: 1 })}
            >
              {f.name}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => deleteFilter.mutate(f.id)}
            >
              <Trash2 className="size-3" />
            </button>
          </span>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Star className="size-3.5" /> 儲存目前篩選
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64">
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">將目前的篩選條件存成常用篩選，方便下次快速套用。</p>
              <Input
                placeholder="篩選名稱，例如：我負責的高優先"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button size="sm" onClick={handleSave} disabled={!name.trim() || createFilter.isPending}>
                儲存
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
