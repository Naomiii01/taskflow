"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddFollowup } from "@/hooks/use-followups";
import { followupFormSchema, type FollowupFormValues } from "@/lib/validations/followup";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AddFollowupDialog({
  open,
  onOpenChange,
  taskId,
  defaultDepartment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  defaultDepartment?: string | null;
}) {
  const addFollowup = useAddFollowup();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FollowupFormValues>({
    resolver: zodResolver(followupFormSchema),
    defaultValues: {
      task_id: taskId,
      followup_date: today(),
      department_name: defaultDepartment ?? "",
      content: "",
      result: "",
      next_action: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        task_id: taskId,
        followup_date: today(),
        department_name: defaultDepartment ?? "",
        content: "",
        result: "",
        next_action: "",
      });
    }
  }, [open, taskId, defaultDepartment, reset]);

  const onSubmit = async (values: FollowupFormValues) => {
    await addFollowup.mutateAsync(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新增追蹤紀錄</DialogTitle>
          <DialogDescription>紀錄這次跟進的內容、結果與下一步行動。</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="followup_date">追蹤日期 *</Label>
              <Input id="followup_date" type="date" {...register("followup_date")} />
              {errors.followup_date && <p className="text-xs text-destructive">{errors.followup_date.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="department_name">處理部門</Label>
              <Input id="department_name" {...register("department_name")} placeholder="例如：客服部" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content">追蹤內容 *</Label>
            <textarea
              id="content"
              rows={3}
              {...register("content")}
              className="flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder="這次做了什麼？"
            />
            {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="result">結果</Label>
            <Input id="result" {...register("result")} placeholder="對方的回應 / 處理結果" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="next_action">下一步行動</Label>
            <Input id="next_action" {...register("next_action")} placeholder="下一步要做什麼、什麼時候" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              新增紀錄
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
