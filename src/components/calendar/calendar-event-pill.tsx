"use client";

import Link from "next/link";

import { calendarColorClasses } from "@/lib/calendar-colors";
import type { CalendarItem } from "@/types/domain";
import { cn } from "@/lib/utils";

export function CalendarEventPill({
  item,
  dense = true,
  onClick,
  draggable = false,
  onDragStart,
}: {
  item: CalendarItem;
  dense?: boolean;
  onClick?: (item: CalendarItem) => void;
  draggable?: boolean;
  onDragStart?: (item: CalendarItem, e: React.DragEvent) => void;
}) {
  const colors = calendarColorClasses(item);
  const label = item.startTime ? `${item.startTime.slice(0, 5)} ${item.title}` : item.title;

  const content = (
    <span
      className={cn(
        "block truncate rounded-md border-l-2 px-1.5 py-0.5 text-left text-xs leading-tight",
        colors.bg,
        colors.text,
        colors.border,
        dense ? "" : "whitespace-normal"
      )}
      title={item.title}
    >
      {label}
    </span>
  );

  const commonProps = {
    draggable: draggable && item.editable,
    onDragStart: (e: React.DragEvent) => onDragStart?.(item, e),
    className: "block w-full",
  };

  if (item.href) {
    return (
      <Link href={item.href} {...commonProps}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" {...commonProps} onClick={() => onClick?.(item)}>
      {content}
    </button>
  );
}
