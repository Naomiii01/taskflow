import type { Metadata } from "next";

import { CalendarClient } from "./calendar-client";

export const metadata: Metadata = { title: "行事曆" };

export default function CalendarPage() {
  return <CalendarClient />;
}
