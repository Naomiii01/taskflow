import { redirect } from "next/navigation";

// 任務列表已併入 Planning Operations Center 頁面的「任務列表」分頁，這裡只保留
// 一個轉址，讓舊的書籤／連結不會變成 404。任務詳情頁（/tasks/[id]）不受影響。
export default function TasksPage() {
  redirect("/planning?tab=tasks");
}
