import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Search,
  Bell,
  Settings,
  Sparkles,
  PlaneTakeoff,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Set when the feature ships in a later phase; renders a "Phase N" badge and a coming-soon page. */
  phase?: number;
};

// 儀表板／看板／任務列表都已併入 Planning Operations Center 頁面的分頁籤，
// 不再各自佔一個導覽項目（/dashboard、/kanban、/tasks 仍會轉址過去，只是不
// 出現在側邊選單）。
// 附件與 OCR、部門管理：目前僅單人使用，暫時從側邊選單移除以精簡導覽；頁面與
// 功能本身都還在（/attachments、/departments 仍可直接訪問，任務詳情頁的附件
// 上傳也不受影響），未來要多人協作時可以再加回選單。
export const NAV_ITEMS: NavItem[] = [
  { title: "Planning Operations Center", href: "/planning", icon: PlaneTakeoff },
  { title: "行事曆", href: "/calendar", icon: CalendarDays },
  { title: "搜尋中心", href: "/search", icon: Search },
  { title: "通知中心", href: "/notifications", icon: Bell },
  { title: "AI 助理", href: "/assistant", icon: Sparkles },
  { title: "設定", href: "/settings", icon: Settings },
];
