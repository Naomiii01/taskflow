"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { login, signup } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );
}

export function LoginForm() {
  const [loginState, loginAction, loginPending] = useActionState(login, null);
  const [signupState, signupAction, signupPending] = useActionState(signup, null);

  return (
    <Tabs defaultValue="login">
      <TabsList className="mb-4 w-full">
        <TabsTrigger value="login">登入</TabsTrigger>
        <TabsTrigger value="signup">建立帳號</TabsTrigger>
      </TabsList>

      <TabsContent value="login">
        <form action={loginAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input id="login-email" name="email" type="email" placeholder="you@company.com" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-password">密碼</Label>
            <Input id="login-password" name="password" type="password" required />
          </div>
          {loginState?.error && <p className="text-sm text-destructive">{loginState.error}</p>}
          <SubmitButton pending={loginPending} label="登入" />
        </form>
      </TabsContent>

      <TabsContent value="signup">
        <form action={signupAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-name">姓名</Label>
            <Input id="signup-name" name="name" placeholder="王小明" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-email">Email</Label>
            <Input id="signup-email" name="email" type="email" placeholder="you@company.com" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-password">密碼</Label>
            <Input id="signup-password" name="password" type="password" required minLength={6} />
          </div>
          {signupState?.error && <p className="text-sm text-destructive">{signupState.error}</p>}
          <SubmitButton pending={signupPending} label="建立帳號" />
          <p className="text-xs text-muted-foreground">
            新帳號預設為「一般使用者」角色，如需管理員權限請洽系統管理員調整。
          </p>
        </form>
      </TabsContent>
    </Tabs>
  );
}
