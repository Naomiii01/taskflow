"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/** 登入/建立帳號都只需要輸入「帳號」（Email 的 @ 前半段），不需要打完整 Email。
 * 帳號只允許英數字、點、底線、連字號，避免有人不小心打進 @ 或空白。 */
const usernameSchema = z
  .string()
  .trim()
  .min(1, "請輸入帳號")
  .regex(/^[a-zA-Z0-9._-]+$/, "帳號只能包含英數字、點、底線或連字號，不需要輸入 @ 之後的部分");

const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "請輸入密碼"),
});

const signupSchema = z.object({
  username: usernameSchema,
  password: z.string().min(6, "密碼至少需要 6 個字元"),
  name: z.string().min(1, "請輸入姓名"),
});

export type AuthFormState = {
  error?: string;
} | null;

export async function login(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "輸入資料有誤" };
  }

  const supabase = await createClient();
  const { data: email, error: resolveError } = await supabase.rpc("resolve_login_email", {
    p_username: parsed.data.username,
  });

  if (resolveError || !email) {
    return { error: "登入失敗：帳號或密碼不正確" };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });

  if (error) {
    return { error: "登入失敗：帳號或密碼不正確" };
  }

  redirect("/aircraft-board");
}

export async function signup(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "輸入資料有誤" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: `${parsed.data.username.toLowerCase()}@taskflow.local`,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });

  if (error) {
    return { error: error.message === "User already registered" ? "此帳號已被註冊" : "註冊失敗，請稍後再試" };
  }

  redirect("/aircraft-board");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
