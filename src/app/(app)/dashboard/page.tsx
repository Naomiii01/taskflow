import { redirect } from "next/navigation";

// 儀表板已併入 Planning Operations Center 頁面的「總覽」分頁，這裡只保留一個
// 轉址，讓舊的書籤／連結不會變成 404。
export default function DashboardPage() {
  redirect("/planning?tab=overview");
}
