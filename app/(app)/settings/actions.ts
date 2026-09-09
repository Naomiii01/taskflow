"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({ name: z.string().min(1, "請輸入姓名").max(100) });

export type SettingsFormState = { error?: string; success?: boolean } | null;

export async function updateProfile(_prevState: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const parsed = schema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "輸入資料有誤" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請重新登入" };

  const { error } = await supabase.from("users").update({ name: parsed.data.name }).eq("id", user.id);
  if (error) return { error: "更新失敗，請稍後再試" };

  revalidatePath("/settings");
  return { success: true };
}
