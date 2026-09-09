import "server-only";

import { getCurrentUser } from "@/lib/auth";
import { PermissionError } from "@/lib/errors";

/**
 * Guards the scheduler endpoints (`/api/reminders/run`, `/api/escalation/run`,
 * and the two summary "run" paths). Two ways in:
 *  - Vercel Cron: sends `Authorization: Bearer <CRON_SECRET>` automatically
 *    once the `CRON_SECRET` env var is set (see vercel.json + README).
 *  - A logged-in Admin, triggering a run manually from the app.
 * Neither configured/authenticated → PermissionError (403 via handleApiError).
 */
export async function requireSchedulerAccess(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return { via: "cron" as const };
  }

  const user = await getCurrentUser();
  if (user?.role === "Admin") return { via: "admin" as const, user };

  throw new PermissionError("僅限排程系統或管理員可觸發此端點");
}
