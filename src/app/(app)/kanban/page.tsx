import { redirect } from "next/navigation";

// 看板已併入 Planning Operations Center 頁面的「看板」分頁，這裡只保留一個
// 轉址，讓舊的書籤／連結不會變成 404。
export default function KanbanPage() {
  redirect("/planning?tab=kanban");
}
