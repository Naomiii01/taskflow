import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { addDays, format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import * as calendarService from "@/lib/services/calendar-service";
import { calendarColorClasses } from "@/lib/calendar-colors";

/** Calendar Dashboard Widget: 首頁顯示未來 7 天重要工作，讓人不用切到行事曆
 * 分頁就能一眼看到本週安排。點項目／查看全部都會帶到行事曆的議程檢視。 */
export async function UpcomingWeekWidget() {
  const supabase = await createClient();
  const today = new Date();
  const start = format(today, "yyyy-MM-dd");
  const end = format(addDays(today, 6), "yyyy-MM-dd");
  const items = (await calendarService.listCalendarItems(supabase, { start, end })).slice(0, 8);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock className="size-3.5" /> Upcoming 7 Days
        </CardTitle>
        <Link href="/calendar?view=agenda" className="text-xs text-primary hover:underline">
          查看行事曆 →
        </Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">未來 7 天沒有安排的工作。</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {items.map((item) => {
              const colors = calendarColorClasses(item);
              const content = (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-14 shrink-0 text-xs text-muted-foreground">
                    {format(new Date(`${item.date}T00:00:00`), "MM/dd")}
                  </span>
                  <span className={`truncate rounded-md border-l-2 px-1.5 py-0.5 text-xs ${colors.bg} ${colors.text} ${colors.border}`}>
                    {item.title}
                  </span>
                </div>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link href={item.href} className="block hover:opacity-80">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
