import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "登入" };

export default function LoginPage() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <LoginForm />
    </div>
  );
}
