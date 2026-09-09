import type { Metadata } from "next";

import { AttachmentsClient } from "./attachments-client";

export const metadata: Metadata = { title: "附件與 OCR" };

export default function AttachmentsPage() {
  return <AttachmentsClient />;
}
