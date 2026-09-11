"use client";

import { cn } from "@/lib/utils";

/**
 * Small multi-select control rendered as toggleable chips — used for fields
 * with a short, fixed option list (Aircraft Type, Station) where a full
 * dropdown-with-checkboxes would be overkill. Includes an optional "全選"
 * quick-select-all chip (a task is often "全機型" / spans every station).
 */
export function MultiSelectChips<T extends string>({
  options,
  labels,
  value,
  onChange,
  selectAllLabel = "全選",
}: {
  options: readonly T[];
  labels?: Record<T, string>;
  value: T[];
  onChange: (next: T[]) => void;
  selectAllLabel?: string;
}) {
  const allSelected = options.length > 0 && options.every((o) => value.includes(o));

  function toggle(option: T) {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  }

  function toggleAll() {
    onChange(allSelected ? [] : [...options]);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={toggleAll}
        className={cn(
          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          allSelected
            ? "border-transparent bg-foreground text-background"
            : "border-dashed border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        {selectAllLabel}
      </button>
      {options.map((option) => {
        const selected = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              selected
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-input text-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {labels ? labels[option] : option}
          </button>
        );
      })}
    </div>
  );
}
