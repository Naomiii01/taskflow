import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Paperclip,
  Search,
  Bell,
  Building2,
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
export const NAV_ITEMS: NavItem[] = [
  { title: "Planning Operations Center", href: "/planning", icon: PlaneTakeoff },
  { title: "行事曆", href: "/calendar", icon: CalendarDays, phase: 5 },
  { title: "附件與 OCR", href: "/attachments", icon: Paperclip },
  { title: "搜尋中心", href: "/search", icon: Search },
  { title: "通知中心", href: "/notifications", icon: Bell },
  { title: "AI 助理", href: "/assistant", icon: Sparkles },
  { title: "部門管理", href: "/departments", icon: Building2 },
  { title: "設定", href: "/settings", icon: Settings },
];
