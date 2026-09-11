import type {
  AircraftType,
  AttachmentCategory,
  CalendarEventType,
  CrossDeptUnit,
  FollowUpEntityType,
  ImpactLevel,
  NotificationType,
  OcrEntityType,
  PlanningStatus,
  ProcessingStatus,
  RecurrenceFrequency,
  ScreenType,
  Station,
  SupervisorTaskStatus,
  TaskPriority,
  TaskSourceChannel,
  TaskStatus,
  UserRole,
  WaitingStatus,
  WorkCategory,
} from "@/types/database.types";

export const TASK_STATUSES: TaskStatus[] = [
  "Todo",
  "In Progress",
  "Waiting Response",
  "Pending Approval",
  "Completed",
  "Cancelled",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  Todo: "待辦",
  "In Progress": "進行中",
  "Waiting Response": "等待回覆",
  "Pending Approval": "待審核",
  Completed: "已完成",
  Cancelled: "已取消",
};

export const TASK_STATUS_BADGE: Record<TaskStatus, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  Todo: "secondary",
  "In Progress": "default",
  "Waiting Response": "warning",
  "Pending Approval": "warning",
  Completed: "success",
  Cancelled: "outline",
};

export const TASK_PRIORITIES: TaskPriority[] = ["P1", "P2", "P3", "P4"];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  P1: "P1 緊急",
  P2: "P2 高",
  P3: "P3 中",
  P4: "P4 低",
};

export const TASK_PRIORITY_BADGE: Record<TaskPriority, "destructive" | "warning" | "secondary" | "outline"> = {
  P1: "destructive",
  P2: "warning",
  P3: "secondary",
  P4: "outline",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  Admin: "管理員",
  Manager: "部門主管",
  User: "一般使用者",
};

export const KANBAN_COLUMNS: TaskStatus[] = [
  "Todo",
  "In Progress",
  "Waiting Response",
  "Pending Approval",
  "Completed",
  "Cancelled",
];

export const SAVED_FILTER_PRESETS = [
  { name: "我的任務", filters: { mine: true } },
  { name: "本週到期", filters: { dueThisWeek: true } },
  { name: "高優先級", filters: { priority: ["P1", "P2"] } },
  { name: "超期事項", filters: { overdue: true } },
] as const;

// --- Phase 3: Attachment + OCR + AI Document Intelligence -----------------

export const ATTACHMENT_CATEGORIES: AttachmentCategory[] = [
  "screenshots",
  "documents",
  "emails",
  "teams",
  "line",
];

export const ATTACHMENT_CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  screenshots: "截圖",
  documents: "文件",
  emails: "郵件",
  teams: "Teams",
  line: "LINE",
};

export const SCREEN_TYPES: ScreenType[] = ["Email", "Teams", "LINE", "SAP", "Document", "Other"];

export const SCREEN_TYPE_LABELS: Record<ScreenType, string> = {
  Email: "郵件",
  Teams: "Teams 對話",
  LINE: "LINE 對話",
  SAP: "SAP 系統畫面",
  Document: "一般文件",
  Other: "其他",
};

export const PROCESSING_STATUSES: ProcessingStatus[] = [
  "pending",
  "processing",
  "completed",
  "failed",
  "skipped",
];

export const PROCESSING_STATUS_LABELS: Record<ProcessingStatus, string> = {
  pending: "等待處理",
  processing: "處理中",
  completed: "已完成",
  failed: "失敗",
  skipped: "略過",
};

export const PROCESSING_STATUS_BADGE: Record<
  ProcessingStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  pending: "secondary",
  processing: "warning",
  completed: "success",
  failed: "destructive",
  skipped: "outline",
};

export const OCR_ENTITY_TYPE_LABELS: Record<OcrEntityType, string> = {
  date: "日期",
  email: "電子郵件",
  phone: "電話",
  task_number: "任務編號",
  department: "部門",
  due_date: "截止日期",
  action_item: "待辦事項",
};

/** Accepted upload MIME types, mapped to the file extension shown in the UI. */
export const ACCEPTED_ATTACHMENT_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

export const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

/** Storage bucket that all task attachments live in (see supabase migrations). */
export const ATTACHMENT_BUCKET = "task-files";

/** task_id used as the storage folder for uploads not yet linked to a task. */
export const ATTACHMENT_INBOX_FOLDER = "inbox";

// --- Phase 4: Notification Center + Reminder/Escalation Engines -----------

export const NOTIFICATION_TYPES: NotificationType[] = [
  "task_assigned",
  "task_updated",
  "task_overdue",
  "task_due_soon",
  "followup_due",
  "department_delay",
  "ai_recommendation",
  "document_processed",
  "escalation",
  "daily_summary",
  "weekly_summary",
];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  task_assigned: "任務指派",
  task_updated: "任務更新",
  task_overdue: "任務超期",
  task_due_soon: "即將到期",
  followup_due: "待追蹤",
  department_delay: "部門延遲",
  ai_recommendation: "AI 建議",
  document_processed: "文件已處理",
  escalation: "升級通知",
  daily_summary: "每日摘要",
  weekly_summary: "每週摘要",
};

export const NOTIFICATION_TYPE_BADGE: Record<
  NotificationType,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  task_assigned: "default",
  task_updated: "secondary",
  task_overdue: "destructive",
  task_due_soon: "warning",
  followup_due: "warning",
  department_delay: "destructive",
  ai_recommendation: "default",
  document_processed: "success",
  escalation: "destructive",
  daily_summary: "outline",
  weekly_summary: "outline",
};

/** Escalation levels: how many days of overdue-ness trigger each notification tier. */
export const ESCALATION_LEVELS = [
  { level: 1, days: 7, label: "Level 1（提醒負責人）" },
  { level: 2, days: 14, label: "Level 2（提醒主管）" },
  { level: 3, days: 30, label: "Level 3（提醒管理者）" },
] as const;

/** Follow-up monitoring thresholds: days since last activity. */
export const FOLLOWUP_MONITOR_THRESHOLDS = { reminder: 7, warning: 14, escalationNotice: 30 } as const;

/** Reminder Engine due-date lookahead windows (days). */
export const DUE_SOON_WINDOWS = [0, 1, 3] as const;

// --- Phase 6.5: Aviation Planning Operations Center -----------------------

export const AIRCRAFT_TYPES: AircraftType[] = ["A321", "A339", "A351", "A359"];

export const STATIONS: Station[] = ["TPE", "TSA", "RMQ", "KHH"];

export const STATION_LABELS: Record<Station, string> = {
  TPE: "TPE 桃園",
  TSA: "TSA 松山",
  RMQ: "RMQ 台中",
  KHH: "KHH 高雄",
};

export const WORK_CATEGORIES: WorkCategory[] = [
  "Daily Check",
  "Short Term",
  "Long Hour",
  "Monthly Plan",
  "Additional Work Card",
  "Project",
  "Special Request",
  "Supervisor Assignment",
];

export const WORK_CATEGORY_LABELS: Record<WorkCategory, string> = {
  "Daily Check": "每日檢查",
  "Short Term": "短天期",
  "Long Hour": "長工時",
  "Monthly Plan": "月計畫",
  "Additional Work Card": "額外工卡",
  Project: "專案",
  "Special Request": "特殊需求",
  "Supervisor Assignment": "主管交辦",
};

export const PLANNING_STATUSES: PlanningStatus[] = [
  "Draft",
  "Planning",
  "Waiting",
  "Follow-Up",
  "Ready",
  "Scheduled",
  "Completed",
  "Cancelled",
];

export const PLANNING_STATUS_LABELS: Record<PlanningStatus, string> = {
  Draft: "草稿",
  Planning: "規劃中",
  Waiting: "等待回覆",
  "Follow-Up": "追蹤中",
  Ready: "準備就緒",
  Scheduled: "已排程",
  Completed: "已完成",
  Cancelled: "已取消",
};

export const PLANNING_STATUS_BADGE: Record<
  PlanningStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  Draft: "outline",
  Planning: "secondary",
  Waiting: "warning",
  "Follow-Up": "warning",
  Ready: "default",
  Scheduled: "default",
  Completed: "success",
  Cancelled: "outline",
};

export const IMPACT_LEVELS: ImpactLevel[] = ["Critical", "High", "Medium", "Low"];

export const IMPACT_LEVEL_LABELS: Record<ImpactLevel, string> = {
  Critical: "極高",
  High: "高",
  Medium: "中",
  Low: "低",
};

export const IMPACT_LEVEL_BADGE: Record<ImpactLevel, "destructive" | "warning" | "secondary" | "outline"> = {
  Critical: "destructive",
  High: "warning",
  Medium: "secondary",
  Low: "outline",
};

export const RECURRENCE_FREQUENCIES: RecurrenceFrequency[] = ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"];

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  Daily: "每日",
  Weekly: "每週",
  Monthly: "每月",
  Quarterly: "每季",
  Yearly: "每年",
};

export const CROSS_DEPT_UNITS: CrossDeptUnit[] = ["修管", "LE", "工程部", "採購", "維修部", "品保", "其他"];

/** 來源：任務需求是從哪裡來的（Email／會議／口頭告知／其他），與「提出需求
 * 單位」（source_department，哪個單位提出）是兩件事——這個記的是管道與細節
 * （例如哪天誰的信、什麼會議、誰口頭告知），方便日後回頭查證。 */
export const TASK_SOURCE_CHANNELS: TaskSourceChannel[] = ["Email", "Meeting", "Verbal", "Other"];

export const TASK_SOURCE_CHANNEL_LABELS: Record<TaskSourceChannel, string> = {
  Email: "Email",
  Meeting: "會議",
  Verbal: "口頭告知",
  Other: "其他",
};

export const WAITING_STATUSES: WaitingStatus[] = ["Waiting", "Replied", "Cancelled"];

export const WAITING_STATUS_LABELS: Record<WaitingStatus, string> = {
  Waiting: "等待中",
  Replied: "已回覆",
  Cancelled: "已取消",
};

/** Waiting Center color thresholds (days waited, status still "Waiting"). */
export const WAITING_DAYS_THRESHOLDS = { green: 3, yellow: 7, orange: 14 } as const;

export type WaitingColor = "green" | "yellow" | "orange" | "red";

export function waitingColorForDays(days: number): WaitingColor {
  if (days <= WAITING_DAYS_THRESHOLDS.green) return "green";
  if (days <= WAITING_DAYS_THRESHOLDS.yellow) return "yellow";
  if (days <= WAITING_DAYS_THRESHOLDS.orange) return "orange";
  return "red";
}

export const FOLLOW_UP_ENTITY_TYPES: FollowUpEntityType[] = ["task", "waiting_item", "supervisor_task"];

export const FOLLOW_UP_ENTITY_LABELS: Record<FollowUpEntityType, string> = {
  task: "任務",
  waiting_item: "等待事項",
  supervisor_task: "主管交辦",
};

export const SUPERVISOR_TASK_STATUSES: SupervisorTaskStatus[] = ["Open", "In Progress", "Completed", "Cancelled"];

export const SUPERVISOR_TASK_STATUS_LABELS: Record<SupervisorTaskStatus, string> = {
  Open: "待處理",
  "In Progress": "處理中",
  Completed: "已完成",
  Cancelled: "已取消",
};

/** Default items the Daily Checklist Engine creates every day at 00:00. */
export const PLANNING_DAILY_CHECKLIST_ITEMS = [
  { key: "prior_day_dispatch", label: "昨日發工完成確認" },
  { key: "returned_work", label: "退工確認" },
  { key: "new_work_order", label: "新增工單需求確認" },
  { key: "le_maintenance_request", label: "修管需求確認" },
  { key: "le_request", label: "LE需求確認" },
  { key: "engineering_request", label: "工程部需求確認" },
  { key: "procurement_request", label: "採購需求確認" },
  { key: "supervisor_assignment_tracking", label: "主管交辦追蹤" },
] as const;

/** Planning homepage monthly milestones, shown on the Planning Timeline. */
export const PLANNING_MONTHLY_MILESTONES = [
  { day: 1, label: "短天期整理 / 額外工單整理" },
  { day: 15, label: "修管月計畫整理" },
  { day: 20, label: "長工時／人力／工期安排完成期限" },
] as const;

// --- Phase 5.5: Calendar Planning Center -----------------------------------

export const CALENDAR_EVENT_TYPES: CalendarEventType[] = [
  "Daily",
  "Follow-up",
  "Meeting",
  "Project",
  "Supervisor",
  "Waiting",
  "Monthly Plan",
  "Long Hour",
  "Short Term",
  "Additional Work Card",
];

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  Daily: "每日",
  "Follow-up": "追蹤",
  Meeting: "會議",
  Project: "專案",
  Supervisor: "主管交辦",
  Waiting: "等待回覆",
  "Monthly Plan": "月計畫",
  "Long Hour": "長工時",
  "Short Term": "短天期",
  "Additional Work Card": "額外工卡",
};
