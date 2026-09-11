// Shapes returned by our API routes / Supabase joins that aren't plain table
// rows. Keeping these separate from database.types.ts (which mirrors the DB
// 1:1) makes it obvious which types are "raw table" vs "joined for the UI".

import type { ChatRole, ScreenType, Tables } from "./database.types";

export type TaskOwner = Pick<Tables<"users">, "id" | "name" | "email" | "avatar_url"> | null;
export type TaskDepartment = Pick<Tables<"departments">, "id" | "department_name"> | null;
export type TaskProjectRef = Pick<Tables<"projects">, "id" | "code" | "name"> | null;

export type TaskWithRelations = Tables<"tasks"> & {
  owner: TaskOwner;
  department: TaskDepartment;
  created_by_user?: TaskOwner;
  project?: TaskProjectRef;
};

export type FollowupWithAuthor = Tables<"followups"> & {
  author: TaskOwner;
};

export type TaskLogWithUser = Tables<"task_logs"> & {
  user: TaskOwner;
};

export type TasksListResponse = {
  data: TaskWithRelations[];
  total: number;
  page: number;
  pageSize: number;
};

export type SmartFollowupLevel = "green" | "yellow" | "red";

export type SmartFollowupState = {
  level: SmartFollowupLevel;
  daysSince: number | null;
  needsFollowup: boolean;
};

// --- Phase 3: Attachment + OCR + AI Document Intelligence -----------------

export type AttachmentWithRelations = Tables<"attachments"> & {
  uploader: TaskOwner;
  task: Pick<Tables<"tasks">, "id" | "task_number" | "title"> | null;
  matched_task: Pick<Tables<"tasks">, "id" | "task_number" | "title"> | null;
  ocr_result: Tables<"ocr_results"> | null;
  ocr_entities: Tables<"ocr_entities">[];
  ai_summary: Tables<"ai_summaries"> | null;
  email_metadata: Tables<"email_metadata"> | null;
  teams_messages: Tables<"teams_messages">[];
  line_messages: Tables<"line_messages">[];
  sap_extraction: Tables<"sap_extractions"> | null;
};

export type AttachmentsListResponse = {
  data: AttachmentWithRelations[];
  total: number;
  page: number;
  pageSize: number;
};

/** Structured output the AI service asks Claude to return for one attachment. */
export type AiAnalysisResult = {
  screen_type: ScreenType;
  summary: string;
  key_points: string[];
  action_items: string[];
  risk_items: string[];
  suggested_followup_date: string | null;
  departments: string[];
  matched_task_number: string | null;
  email?: { sender?: string; recipient?: string; subject?: string; sent_at?: string; content?: string };
  teams?: { speaker?: string; message_time?: string; content?: string }[];
  line?: { group_name?: string; speaker?: string; message?: string; message_time?: string }[];
  sap?: {
    work_order_number?: string;
    part_number?: string;
    aircraft_registration?: string;
    work_card_info?: string;
    status_info?: string;
  };
};

export type DocumentSearchResult = {
  attachment: AttachmentWithRelations;
  matchedIn: ("file_name" | "ocr_text" | "ai_summary" | "email" | "teams" | "line")[];
};

export type DocumentIntelligenceStats = {
  totalAttachments: number;
  ocrCompleted: number;
  pendingAnalysis: number;
  aiCompleted: number;
};

// --- Phase 4: Notification Center + Reminder/Escalation Engines -----------

export type NotificationWithTask = Tables<"notifications"> & {
  task: Pick<Tables<"tasks">, "id" | "task_number" | "title"> | null;
};

export type NotificationsListResponse = {
  data: NotificationWithTask[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
};

export type DepartmentDelay = {
  departmentId: string;
  departmentName: string;
  managerId: string | null;
  avgResponseDays: number | null;
  avgResolutionDays: number | null;
  overdueRate: number;
  openTasks: number;
};

export type DailySummary = {
  date: string;
  dueToday: number;
  dueTomorrow: number;
  overdue: number;
  needsFollowup: number;
  aiSuggestions: { taskId: string; taskNumber: string; title: string; suggestion: string; suggestedDate: string | null }[];
};

export type WeeklySummary = {
  weekStart: string;
  weekEnd: string;
  created: number;
  completed: number;
  overdue: number;
  departmentRanking: { departmentName: string; completed: number; overdueRate: number }[];
};

export type EngineRunResult = {
  ran: boolean;
  notificationsCreated: number;
  details?: Record<string, number>;
};

// --- Phase 6: AI Assistant + Knowledge Engine + Natural Language Query ----

/** One read-only query tool the assistant invoked, recorded for transparency
 * (shown in the UI as "查詢了：..."), not the tool's raw result. */
export type ChatToolCall = {
  name: string;
  args: Record<string, unknown>;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  toolCalls: ChatToolCall[] | null;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatResponse = {
  conversationId: string;
  message: ChatMessage;
};

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type TaskRiskScore = {
  taskId: string;
  taskNumber: string;
  title: string;
  departmentName: string | null;
  score: number;
  level: RiskLevel;
  reasons: string[];
};

export type ProjectStatusReport = {
  projectKeyword: string;
  totalTasks: number;
  completed: number;
  inProgress: number;
  overdue: number;
  completionRate: number;
  departmentBreakdown: { departmentName: string; count: number }[];
  riskItems: TaskRiskScore[];
  narrative: string;
};

export type DepartmentReport = {
  departmentName: string;
  totalTasks: number;
  completed: number;
  overdue: number;
  avgResponseDays: number | null;
  avgResolutionDays: number | null;
  narrative: string;
};

export type MonthlyReport = {
  month: string;
  created: number;
  completed: number;
  overdue: number;
  departmentRanking: { departmentName: string; completed: number; overdueRate: number }[];
  narrative: string;
};

export type AssistantReport =
  | ({ type: "daily" } & DailySummary & { narrative: string })
  | ({ type: "weekly" } & WeeklySummary & { narrative: string })
  | ({ type: "monthly" } & MonthlyReport)
  | ({ type: "project" } & ProjectStatusReport)
  | ({ type: "department" } & DepartmentReport);

// --- Phase 6.5: Aviation Planning Operations Center -----------------------

export type FleetAircraft = Tables<"fleet_master">;

export type ProjectMilestone = Tables<"project_milestones">;

export type ProjectSummary = Tables<"projects"> & {
  taskCount: number;
  completed: number;
  completionRate: number;
  waiting: number;
  overdue: number;
  riskIndex: number;
  milestones: ProjectMilestone[];
};

export type DailyChecklistItem = Tables<"daily_checklist_items"> & {
  completed_by_user: TaskOwner;
};

export type DailyChecklistWithItems = Tables<"daily_checklists"> & {
  items: DailyChecklistItem[];
};

export type WaitingColorLevel = "green" | "yellow" | "orange" | "red";

export type WaitingItemWithTask = Tables<"waiting_items"> & {
  related_task: Pick<Tables<"tasks">, "id" | "task_number" | "title"> | null;
  waitingDays: number;
  color: WaitingColorLevel;
};

export type FollowUpRecordWithAuthor = Tables<"follow_up_records"> & {
  author: TaskOwner;
};

export type SupervisorTaskWithUsers = Tables<"supervisor_tasks"> & {
  assigner: TaskOwner;
  assignee: TaskOwner;
  followUps: FollowUpRecordWithAuthor[];
};

export type RecurringTaskTemplate = Tables<"recurring_task_templates">;

/** Today Center / Weekly Center / Monthly Center / AI Briefing Center payload
 * for the /planning homepage — combines the day's checklist, waiting/overdue
 * items, supervisor tasks and monthly milestones into one AI-narrated brief. */
export type PlanningBriefing = {
  date: string;
  checklist: DailyChecklistWithItems | null;
  checklistCompletionRate: number;
  returnedWorkCount: number;
  newWorkOrderCount: number;
  waitingCount: number;
  supervisorOpenCount: number;
  overdueCount: number;
  thisWeekHighlights: string[];
  thisMonthMilestones: { day: number; label: string; isPast: boolean; isToday: boolean }[];
  riskNote: string;
  narrative: string;
};

export type PlanningKpis = {
  trackingCompletionRate: number;
  waitingCount: number;
  overdueCount: number;
  supervisorCompletionRate: number;
  monthlyPlanCompletionRate: number;
  projectCompletion: { code: string; name: string; completionRate: number }[];
};

export type PlanningAnalyticsBreakdown = { label: string; count: number }[];

export type PlanningAnalytics = {
  byAircraftType: PlanningAnalyticsBreakdown;
  byStation: PlanningAnalyticsBreakdown;
  byWorkCategory: PlanningAnalyticsBreakdown;
};

// --- Phase 5.5: Calendar Planning Center -----------------------------------

/** What every calendar source (calendar_events, tasks, followups,
 * supervisor_tasks, waiting_items, project_milestones) gets normalized into
 * before rendering, so every calendar view only ever deals with one shape. */
export type CalendarItemSource =
  | "calendar_event"
  | "task"
  | "followup"
  | "supervisor_task"
  | "waiting_item"
  | "milestone";

export type CalendarItem = {
  /** Composite id ("<source>:<row id>") — unique across sources for React keys. */
  id: string;
  source: CalendarItemSource;
  /** The underlying row's own id (task id, followup id, calendar_events id, …). */
  sourceId: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string | null;
  endTime: string | null;
  eventType: import("./database.types").CalendarEventType | null;
  priority: import("./database.types").TaskPriority | null;
  // Arrays — a source task can cover more than one station/aircraft type.
  station: import("./database.types").Station[];
  aircraftType: import("./database.types").AircraftType[];
  projectCode: string | null;
  /** Only calendar_events and tasks currently support drag-to-reschedule /
   * inline edit from the calendar (see calendar-service.ts for why). */
  editable: boolean;
  href: string | null;
};
