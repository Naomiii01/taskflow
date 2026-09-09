"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(updateProfile, null);

  useEffect(() => {
    if (state?.success) toast.success("個人資料已更新");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">姓名</Label>
        <Input id="name" name="name" defaultValue={defaultName} required />
      </div>
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        儲存
      </Button>
    </form>
  );
}
