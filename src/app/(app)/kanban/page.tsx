import { redirect } from "next/navigation";

// 看板分頁已從 Planning Operations Center 移除（改用任務列表分頁呈現任務），
// 這裡轉址回總覽，讓舊的書籤／連結不會變成 404。
export default function KanbanPage() {
  redirect("/planning");
}
