import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { PermissionError, UnauthorizedError } from "@/lib/errors";
import { AiNotConfiguredError } from "@/lib/ai/anthropic-client";
import { ServiceRoleNotConfiguredError } from "@/lib/supabase/service";

export { UnauthorizedError };

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError("請先登入");
  return user;
}

/** Splits a comma-separated query param into an array, or undefined if absent. */
export function parseListParam(searchParams: URLSearchParams, key: string): string[] | undefined {
  const raw = searchParams.getAll(key).flatMap((v) => v.split(","));
  const cleaned = raw.map((v) => v.trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof PermissionError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "資料格式錯誤", issues: error.issues }, { status: 400 });
  }
  if (error instanceof AiNotConfiguredError || error instanceof ServiceRoleNotConfiguredError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  console.error("[api] unhandled error", error);
  const message = error instanceof Error ? error.message : "伺服器發生錯誤";
  return NextResponse.json({ error: message }, { status: 500 });
}
