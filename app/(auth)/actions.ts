"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const authSchema = z.object({
  email: z.string().email("請輸入有效的 Email"),
  password: z.string().min(6, "密碼至少需要 6 個字元"),
});

export type AuthFormState = {
  error?: string;
} | null;

export async function login(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "輸入資料有誤" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "登入失敗：Email 或密碼不正確" };
  }

  redirect("/planning");
}

export async function signup(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = authSchema.extend({ name: z.string().min(1, "請輸入姓名") }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "輸入資料有誤" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });

  if (error) {
    return { error: error.message === "User already registered" ? "此 Email 已被註冊" : "註冊失敗，請稍後再試" };
  }

  redirect("/planning");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
