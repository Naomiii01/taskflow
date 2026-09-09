import { FileSpreadsheet, FileText, Image as ImageIcon, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  ATTACHMENT_CATEGORY_LABELS,
  PROCESSING_STATUS_BADGE,
  PROCESSING_STATUS_LABELS,
  SCREEN_TYPE_LABELS,
} from "@/lib/constants";
import type { AttachmentCategory, ProcessingStatus, ScreenType } from "@/types/database.types";

export function ProcessingStatusBadge({ label, status }: { label: string; status: ProcessingStatus }) {
  return (
    <Badge variant={PROCESSING_STATUS_BADGE[status]} className="gap-1">
      {(status === "pending" || status === "processing") && <Loader2 className="size-3 animate-spin" />}
      {label}：{PROCESSING_STATUS_LABELS[status]}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: AttachmentCategory }) {
  return <Badge variant="outline">{ATTACHMENT_CATEGORY_LABELS[category]}</Badge>;
}

export function ScreenTypeBadge({ screenType }: { screenType: ScreenType | null }) {
  if (!screenType) return null;
  return <Badge variant="secondary">{SCREEN_TYPE_LABELS[screenType]}</Badge>;
}

export function FileTypeIcon({ fileType }: { fileType: string | null }) {
  if (fileType === "image/jpeg" || fileType === "image/png") return <ImageIcon className="size-4" />;
  if (fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    return <FileSpreadsheet className="size-4" />;
  return <FileText className="size-4" />;
}
