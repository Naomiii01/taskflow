"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCEPTED_ATTACHMENT_TYPES, ATTACHMENT_CATEGORIES, ATTACHMENT_CATEGORY_LABELS } from "@/lib/constants";
import { validateAttachmentFile } from "@/lib/validations/attachment";
import { useUploadAttachment } from "@/hooks/use-attachments";
import type { AttachmentCategory } from "@/types/database.types";

/**
 * Drag-drop multi-file upload area. Supports JPG/PNG/PDF/DOCX/XLSX, and lets
 * the person pick a category folder (screenshots/documents/emails/teams/
 * line) — otherwise it's inferred from the file type. Each file is uploaded
 * independently via POST /api/upload; OCR + AI analysis then run in the
 * background (see attachments-service.uploadAttachment).
 */
export function UploadDropzone({ taskId }: { taskId?: string | null }) {
  const upload = useUploadAttachment();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [category, setCategory] = React.useState<AttachmentCategory | "auto">("auto");

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const invalid = validateAttachmentFile(file);
      if (invalid) {
        toast.error(`${file.name}：${invalid}`);
        continue;
      }
      await upload.mutateAsync({ file, taskId, category: category === "auto" ? undefined : category }).catch(() => undefined);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
      >
        <UploadCloud className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          拖曳檔案到這裡，或<span className="text-primary underline">點擊選擇檔案</span>
        </p>
        <p className="text-xs text-muted-foreground">支援 JPG / PNG / PDF / DOCX / XLSX，單檔上限 15MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={Object.keys(ACCEPTED_ATTACHMENT_TYPES).join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">分類資料夾：</span>
        <Select value={category} onValueChange={(v) => setCategory(v as AttachmentCategory | "auto")}>
          <SelectTrigger size="sm" className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">自動判斷</SelectItem>
            {ATTACHMENT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {ATTACHMENT_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {upload.isPending && <span className="text-muted-foreground">上傳中…</span>}
      </div>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => inputRef.current?.click()}>
        選擇檔案上傳
      </Button>
    </div>
  );
}
