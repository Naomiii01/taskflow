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
import { useAddFollowup, useUpdateFollowup } from "@/hooks/use-followups";
import { followupFormSchema, type FollowupFormValues } from "@/lib/validations/followup";
import type { FollowupWithAuthor } from "@/types/domain";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyValues(taskId: string, defaultDepartment?: string | null): FollowupFormValues {
  return {
    task_id: taskId,
    followup_date: today(),
    department_name: defaultDepartment ?? "",
    content: "",
    result: "",
    next_action: "",
  };
}

function valuesFromFollowup(followup: FollowupWithAuthor): FollowupFormValues {
  return {
    task_id: followup.task_id,
    followup_date: followup.followup_date,
    department_name: followup.department_name ?? "",
    content: followup.content ?? "",
    result: followup.result ?? "",
    next_action: followup.next_action ?? "",
  };
}

/**
 * 新增／編輯追蹤紀錄共用同一個表單 — 傳入 `followup` 就是編輯既有紀錄（例如
 * 打錯字要能訂正），不傳就是新增一筆。跟 TaskFormDialog 新增/編輯共用同一個
 * dialog 的做法一致。
 */
export function AddFollowupDialog({
  open,
  onOpenChange,
  taskId,
  defaultDepartment,
  followup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  defaultDepartment?: string | null;
  followup?: FollowupWithAuthor | null;
}) {
  const isEditing = !!followup;
  const addFollowup = useAddFollowup();
  const updateFollowup = useUpdateFollowup();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FollowupFormValues>({
    resolver: zodResolver(followupFormSchema),
    defaultValues: emptyValues(taskId, defaultDepartment),
  });

  React.useEffect(() => {
    if (open) {
      reset(followup ? valuesFromFollowup(followup) : emptyValues(taskId, defaultDepartment));
    }
  }, [open, taskId, defaultDepartment, followup, reset]);

  const onSubmit = async (values: FollowupFormValues) => {
    if (isEditing && followup) {
      const { followup_date, department_name, content, result, next_action } = values;
      await updateFollowup.mutateAsync({
        id: followup.id,
        taskId: followup.task_id,
        values: { followup_date, department_name, content, result, next_action },
      });
    } else {
      await addFollowup.mutateAsync(values);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "編輯追蹤紀錄" : "新增追蹤紀錄"}</DialogTitle>
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
              {isEditing ? "儲存變更" : "新增紀錄"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
