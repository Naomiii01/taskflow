// Hand-written types for the `taskflow` schema (a dedicated Postgres schema
// added to this Supabase project, kept separate from other apps' `public`
// tables). Mirrors supabase/migrations/20260907000001_taskflow_schema.sql.
//
// If you add/change columns, update this file to match, or wire up
// `supabase gen types typescript --schema taskflow` once the Supabase CLI
// is linked to this project.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "Admin" | "Manager" | "User";
// Aircraft Planning Board 專用的權限，跟上面的 UserRole 分開 —— 見
// supabase/migrations/20260917020001_taskflow_planning_board_editor_viewer.sql
export type PlanningBoardRole = "editor" | "viewer";

export type TaskStatus =
  | "Todo"
  | "In Progress"
  | "Waiting Response"
  | "Pending Approval"
  | "Completed"
  | "Cancelled";

export type TaskPriority = "P1" | "P2" | "P3" | "P4";

export type NotificationType =
  | "task_assigned"
  | "task_updated"
  | "task_overdue"
  | "task_due_soon"
  | "followup_due"
  | "department_delay"
  | "ai_recommendation"
  | "document_processed"
  | "escalation"
  | "daily_summary"
  | "weekly_summary";

export type ProcessingStatus = "pending" | "processing" | "completed" | "failed" | "skipped";

export type AttachmentCategory = "screenshots" | "documents" | "emails" | "teams" | "line";

export type ScreenType = "Email" | "Teams" | "LINE" | "SAP" | "Document" | "Other";

export type OcrEntityType =
  | "date"
  | "email"
  | "phone"
  | "task_number"
  | "department"
  | "due_date"
  | "action_item";

export type ChatRole = "user" | "assistant";

export type KnowledgeSourceType = "task" | "followup" | "attachment" | "ocr_result" | "ai_summary";

// --- Phase 6.5: Aviation Planning Operations Center -----------------------

export type AircraftType = "A321" | "A339" | "A351" | "A359";

export type Station = "TPE" | "TSA" | "RMQ" | "KHH";

/** Phase 6.6 Aircraft Planning Board Lite: 'manual' = typed in one at a time,
 * 'import' = brought in from an uploaded schedule file. */
export type GroundWindowSource = "manual" | "import";

/** 機坪維修部（接送機LINE上作業）／基地維修部（長地停重工）—— 哪個部門正在
 * 執行這架飛機的工作。見 aircraft_department_windows。 */
export type MaintenanceDepartment = "機坪" | "基地";

/** Aircraft Planning Board Lite "Current Status" — the aircraft's operational
 * state during a given ground-time window. */
export type AircraftCurrentStatus = "Available" | "In Service" | "In Maintenance" | "AOG";

/** Aircraft Planning Board Lite "Planning Status" — status of the major work
 * (if any) planned during a ground-time window. Deliberately a separate enum
 * from the tasks table's own PlanningStatus (different concept, different
 * values) even though the names are similar. */
export type MajorWorkPlanningStatus = "Draft" | "Confirmed" | "In Progress" | "Completed" | "Cancelled";

/** Aircraft Planning Board Lite — which shift a planned major-work item falls
 * in. Only meaningful when major_work_planned is set; a plain overnight stay
 * with no work planned leaves this null. */
export type WorkShift = "早班" | "中班" | "大夜班";

export type WorkCategory =
  | "Daily Check"
  | "Short Term"
  | "Long Hour"
  | "Monthly Plan"
  | "Additional Work Card"
  | "Project"
  | "Special Request"
  | "Supervisor Assignment";

export type PlanningStatus =
  | "Draft"
  | "Planning"
  | "Waiting"
  | "Follow-Up"
  | "Ready"
  | "Scheduled"
  | "Completed"
  | "Cancelled";

export type ImpactLevel = "Critical" | "High" | "Medium" | "Low";

export type RecurrenceFrequency = "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Yearly";

/** Cross-department units Planning routinely waits on / hands work to. */
export type CrossDeptUnit = "修管" | "LE" | "工程部" | "採購" | "維修部" | "品保" | "其他";

export type WaitingStatus = "Waiting" | "Replied" | "Cancelled";

/** How a task request came in — Email/Meeting/Verbal/Other. */
export type TaskSourceChannel = "Email" | "Meeting" | "Verbal" | "Other";

export type FollowUpEntityType = "task" | "waiting_item" | "supervisor_task";

export type SupervisorTaskStatus = "Open" | "In Progress" | "Completed" | "Cancelled";

// --- Phase 5.5: Calendar Planning Center -----------------------------------

/** Type of a manually-created ("Quick Add") calendar_events row. Tasks/
 * Follow-ups/Supervisor Tasks/Waiting Items/Project Milestones are NOT
 * stored here — they're read directly from their own tables and merged in
 * at query time (see lib/services/calendar-service.ts). */
export type CalendarEventType =
  | "Daily"
  | "Follow-up"
  | "Meeting"
  | "Project"
  | "Supervisor"
  | "Waiting"
  | "Monthly Plan"
  | "Long Hour"
  | "Short Term"
  | "Additional Work Card";

export interface Database {
  taskflow: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          role: UserRole;
          // Aircraft Planning Board 專用權限，跟上面的 role 分開 —— 見
          // supabase/migrations/20260917020001_taskflow_planning_board_editor_viewer.sql
          planning_board_role: PlanningBoardRole;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          role?: UserRole;
          planning_board_role?: PlanningBoardRole;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          department_name: string;
          manager: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          department_name: string;
          manager?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["departments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "departments_manager_fkey";
            columns: ["manager"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          task_number: string;
          title: string;
          description: string | null;
          priority: TaskPriority;
          status: TaskStatus;
          due_date: string | null;
          followup_date: string | null;
          owner_id: string | null;
          owner_name: string | null;
          department_id: string | null;
          created_by: string | null;
          tags: string[];
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          // Phase 6.5: Aviation Planning Operations Center
          // aircraft_type/station/aircraft_registration store *every* selected
          // value (Postgres array columns) — a task can span more than one
          // aircraft type, station, or specific tail (e.g. "全機型" work, an
          // A321 job covering both RMQ and KHH, or only 3 of 15 A321s), so
          // these are never a single scalar. Always [] rather than null when
          // nothing is selected (matches the columns' `not null default '{}'`).
          aircraft_type: AircraftType[];
          aircraft_registration: string[];
          station: Station[];
          work_category: WorkCategory | null;
          planning_month: string | null;
          source_department: CrossDeptUnit | null;
          waiting_owner: CrossDeptUnit | null;
          planning_status: PlanningStatus | null;
          impact_level: ImpactLevel | null;
          parent_task_id: string | null;
          project_id: string | null;
          source_template_id: string | null;
          // 來源 (how the task request came in) — a lightweight companion to
          // 提出需求單位 (source_department, which unit asked): source_channel
          // is the channel (Email/Meeting/Verbal/Other) and source_note is a
          // free-text detail, e.g. "9/10 王小姐" or "週一晨會".
          source_channel: TaskSourceChannel | null;
          source_note: string | null;
          // Aircraft Planning Board Lite: which ground-time window (if any)
          // this task has been scheduled into. Null = still unscheduled —
          // this is what "待安排工單數量" on the board counts.
          linked_ground_window_id: string | null;
        };
        Insert: {
          id?: string;
          task_number?: string;
          title: string;
          description?: string | null;
          priority?: TaskPriority;
          status?: TaskStatus;
          due_date?: string | null;
          followup_date?: string | null;
          owner_id?: string | null;
          owner_name?: string | null;
          department_id?: string | null;
          created_by?: string | null;
          tags?: string[];
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          aircraft_type?: AircraftType[];
          aircraft_registration?: string[];
          station?: Station[];
          work_category?: WorkCategory | null;
          planning_month?: string | null;
          source_department?: CrossDeptUnit | null;
          waiting_owner?: CrossDeptUnit | null;
          planning_status?: PlanningStatus | null;
          impact_level?: ImpactLevel | null;
          parent_task_id?: string | null;
          project_id?: string | null;
          source_template_id?: string | null;
          source_channel?: TaskSourceChannel | null;
          source_note?: string | null;
          linked_ground_window_id?: string | null;
        };
        Update: Partial<Database["taskflow"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tasks_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey";
            columns: ["parent_task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      task_logs: {
        Row: {
          id: string;
          task_id: string;
          action_type: string;
          old_value: Json | null;
          new_value: Json | null;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          action_type: string;
          old_value?: Json | null;
          new_value?: Json | null;
          user_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["task_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "task_logs_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      followups: {
        Row: {
          id: string;
          task_id: string;
          followup_date: string;
          department_name: string | null;
          content: string | null;
          result: string | null;
          next_action: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          followup_date?: string;
          department_name?: string | null;
          content?: string | null;
          result?: string | null;
          next_action?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["followups"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "followups_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_events: {
        Row: {
          id: string;
          title: string;
          event_date: string;
          start_time: string | null;
          end_time: string | null;
          event_type: CalendarEventType;
          priority: TaskPriority | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          event_date: string;
          start_time?: string | null;
          end_time?: string | null;
          event_type?: CalendarEventType;
          priority?: TaskPriority | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["calendar_events"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      attachments: {
        Row: {
          id: string;
          task_id: string | null;
          file_name: string;
          storage_path: string;
          file_type: string | null;
          file_size: number | null;
          uploaded_by: string | null;
          category: AttachmentCategory;
          screen_type: ScreenType | null;
          ocr_status: ProcessingStatus;
          ai_status: ProcessingStatus;
          matched_task_id: string | null;
          version: number;
          replaces_attachment_id: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
          checklist_item_id: string | null;
        };
        Insert: {
          id?: string;
          task_id?: string | null;
          file_name: string;
          storage_path: string;
          file_type?: string | null;
          file_size?: number | null;
          uploaded_by?: string | null;
          category?: AttachmentCategory;
          screen_type?: ScreenType | null;
          ocr_status?: ProcessingStatus;
          ai_status?: ProcessingStatus;
          matched_task_id?: string | null;
          version?: number;
          replaces_attachment_id?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
          checklist_item_id?: string | null;
        };
        Update: Partial<Database["taskflow"]["Tables"]["attachments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "attachments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_matched_task_id_fkey";
            columns: ["matched_task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_checklist_item_id_fkey";
            columns: ["checklist_item_id"];
            isOneToOne: false;
            referencedRelation: "daily_checklist_items";
            referencedColumns: ["id"];
          },
        ];
      };
      ocr_results: {
        Row: {
          id: string;
          attachment_id: string;
          raw_text: string | null;
          confidence_score: number | null;
          language: string | null;
          processed_at: string;
        };
        Insert: {
          id?: string;
          attachment_id: string;
          raw_text?: string | null;
          confidence_score?: number | null;
          language?: string | null;
          processed_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["ocr_results"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ocr_results_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: true;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
        ];
      };
      ocr_entities: {
        Row: {
          id: string;
          attachment_id: string;
          entity_type: OcrEntityType;
          entity_value: string;
          confidence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attachment_id: string;
          entity_type: OcrEntityType;
          entity_value: string;
          confidence?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["ocr_entities"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ocr_entities_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: false;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
        ];
      };
      email_metadata: {
        Row: {
          id: string;
          attachment_id: string;
          sender: string | null;
          recipient: string | null;
          subject: string | null;
          sent_at: string | null;
          content: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attachment_id: string;
          sender?: string | null;
          recipient?: string | null;
          subject?: string | null;
          sent_at?: string | null;
          content?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["email_metadata"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "email_metadata_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: true;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
        ];
      };
      teams_messages: {
        Row: {
          id: string;
          attachment_id: string;
          speaker: string | null;
          message_time: string | null;
          content: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attachment_id: string;
          speaker?: string | null;
          message_time?: string | null;
          content?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["teams_messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "teams_messages_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: false;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
        ];
      };
      line_messages: {
        Row: {
          id: string;
          attachment_id: string;
          group_name: string | null;
          speaker: string | null;
          message: string | null;
          message_time: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attachment_id: string;
          group_name?: string | null;
          speaker?: string | null;
          message?: string | null;
          message_time?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["line_messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "line_messages_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: false;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
        ];
      };
      sap_extractions: {
        Row: {
          id: string;
          attachment_id: string;
          work_order_number: string | null;
          part_number: string | null;
          aircraft_registration: string | null;
          work_card_info: string | null;
          status_info: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attachment_id: string;
          work_order_number?: string | null;
          part_number?: string | null;
          aircraft_registration?: string | null;
          work_card_info?: string | null;
          status_info?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["sap_extractions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sap_extractions_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: false;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_summaries: {
        Row: {
          id: string;
          task_id: string | null;
          attachment_id: string | null;
          summary: string | null;
          key_points: Json;
          risk_items: Json;
          action_items: Json;
          suggested_followup_date: string | null;
          departments: Json;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id?: string | null;
          attachment_id?: string | null;
          summary?: string | null;
          key_points?: Json;
          risk_items?: Json;
          action_items?: Json;
          suggested_followup_date?: string | null;
          departments?: Json;
          model?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["ai_summaries"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ai_summaries_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_summaries_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: true;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_filters: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          filters: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          filters?: Json;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["saved_filters"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "saved_filters_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          related_task_id: string | null;
          type: NotificationType;
          title: string;
          message: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          related_task_id?: string | null;
          type: NotificationType;
          title: string;
          message?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey";
            columns: ["related_task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_settings: {
        Row: {
          user_id: string;
          email_enabled: boolean;
          in_app_enabled: boolean;
          push_enabled: boolean;
          daily_summary_enabled: boolean;
          weekly_summary_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_enabled?: boolean;
          in_app_enabled?: boolean;
          push_enabled?: boolean;
          daily_summary_enabled?: boolean;
          weekly_summary_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["notification_settings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["ai_conversations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ai_conversations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: ChatRole;
          content: string;
          tool_calls: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: ChatRole;
          content: string;
          tool_calls?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["ai_messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_chunks: {
        Row: {
          id: string;
          source_type: KnowledgeSourceType;
          source_id: string;
          content: string;
          // pgvector column — no fixed dimension yet (see migration comment).
          // Unused until an embedding provider is configured; PostgREST would
          // surface it as its text representation, e.g. "[0.01,-0.02,...]".
          embedding: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_type: KnowledgeSourceType;
          source_id: string;
          content: string;
          embedding?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["knowledge_chunks"]["Insert"]>;
        Relationships: [];
      };
      // --- Phase 6.5: Aviation Planning Operations Center -------------------
      fleet_master: {
        Row: {
          id: string;
          aircraft_type: AircraftType;
          aircraft_registration: string;
          station: Station;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          aircraft_type: AircraftType;
          aircraft_registration: string;
          station?: Station;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["fleet_master"]["Insert"]>;
        Relationships: [];
      };
      // --- Phase 6.6: Aircraft Planning Board Lite ---------------------------
      aircraft_ground_windows: {
        Row: {
          id: string;
          aircraft_registration: string;
          station: Station;
          arrival_at: string;
          departure_at: string;
          notes: string | null;
          source: GroundWindowSource;
          // Planning Information — what major work (if any) is planned during
          // this ground stay. All nullable: most stays have none of this set.
          current_status: AircraftCurrentStatus | null;
          major_work_planned: string | null;
          estimated_mh: number | null;
          required_skill: string | null;
          required_equipment: string | null;
          required_authorization: string | null;
          planning_status: MajorWorkPlanningStatus | null;
          shift: WorkShift | null;
          // 重新匯入班表時找不到對應新班次（航線被拿掉/大改）——見
          // supabase/migrations/20260917000001_taskflow_ground_window_change_tracking.sql
          needs_confirmation: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          aircraft_registration: string;
          station: Station;
          arrival_at: string;
          departure_at: string;
          notes?: string | null;
          source?: GroundWindowSource;
          current_status?: AircraftCurrentStatus | null;
          major_work_planned?: string | null;
          estimated_mh?: number | null;
          required_skill?: string | null;
          required_equipment?: string | null;
          required_authorization?: string | null;
          planning_status?: MajorWorkPlanningStatus | null;
          shift?: WorkShift | null;
          needs_confirmation?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["aircraft_ground_windows"]["Insert"]>;
        Relationships: [];
      };
      // 已排計畫工作的地停被重新匯入異動（時間變更／找不到對應新班次）時的
      // 歷史紀錄，供查核用 —— 見
      // supabase/migrations/20260917000001_taskflow_ground_window_change_tracking.sql
      ground_window_change_log: {
        Row: {
          id: string;
          ground_window_id: string;
          aircraft_registration: string;
          station: Station;
          change_type: "time_changed" | "orphaned";
          old_arrival_at: string;
          old_departure_at: string;
          new_arrival_at: string | null;
          new_departure_at: string | null;
          plan_snapshot: Json;
          // 執行這次匯入、導致這筆地停被異動的使用者——見
          // supabase/migrations/20260917010001_taskflow_ground_window_change_log_changed_by.sql
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ground_window_id: string;
          aircraft_registration: string;
          station: Station;
          change_type: "time_changed" | "orphaned";
          old_arrival_at: string;
          old_departure_at: string;
          new_arrival_at?: string | null;
          new_departure_at?: string | null;
          plan_snapshot?: Json;
          changed_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["ground_window_change_log"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ground_window_change_log_ground_window_id_fkey";
            columns: ["ground_window_id"];
            isOneToOne: false;
            referencedRelation: "aircraft_ground_windows";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ground_window_change_log_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      // 航機長期駐留場站排程（駐廠輪替表），跟 aircraft_ground_windows 分開儲存、
      // 疊加顯示 —— 見 supabase/migrations/20260916034000_taskflow_aircraft_residency_windows.sql
      aircraft_residency_windows: {
        Row: {
          id: string;
          aircraft_registration: string;
          station: Station;
          start_date: string;
          end_date: string;
          source: GroundWindowSource;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          aircraft_registration: string;
          station: Station;
          start_date: string;
          end_date: string;
          source?: GroundWindowSource;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["aircraft_residency_windows"]["Insert"]>;
        Relationships: [];
      };
      // 機坪維修部／基地維修部——哪架飛機現在在哪個部門手上，通常從年度維修計畫表
      // 匯入。跟 aircraft_ground_windows／aircraft_residency_windows 分開儲存、
      // 疊加顯示 —— 見 supabase/migrations/20260918010000_taskflow_aircraft_department_windows.sql
      aircraft_department_windows: {
        Row: {
          id: string;
          aircraft_registration: string;
          department: MaintenanceDepartment;
          start_date: string;
          end_date: string;
          description: string | null;
          source: GroundWindowSource;
          source_document: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          aircraft_registration: string;
          department: MaintenanceDepartment;
          start_date: string;
          end_date: string;
          description?: string | null;
          source?: GroundWindowSource;
          source_document?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["aircraft_department_windows"]["Insert"]>;
        Relationships: [];
      };
      planning_board_settings: {
        Row: {
          id: string;
          yellow_threshold: number;
          red_threshold: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          yellow_threshold?: number;
          red_threshold?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["planning_board_settings"]["Insert"]>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      project_milestones: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          target_date: string | null;
          is_completed: boolean;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          target_date?: string | null;
          is_completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["project_milestones"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_task_templates: {
        Row: {
          id: string;
          name: string;
          frequency: RecurrenceFrequency;
          day_of_week: number | null;
          day_of_month: number | null;
          month_of_year: number | null;
          quarter_start_month: number | null;
          due_day_of_month: number | null;
          default_title: string;
          default_description: string | null;
          default_department_id: string | null;
          default_priority: TaskPriority;
          default_work_category: WorkCategory | null;
          is_active: boolean;
          last_generated_on: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          frequency: RecurrenceFrequency;
          day_of_week?: number | null;
          day_of_month?: number | null;
          month_of_year?: number | null;
          quarter_start_month?: number | null;
          due_day_of_month?: number | null;
          default_title: string;
          default_description?: string | null;
          default_department_id?: string | null;
          default_priority?: TaskPriority;
          default_work_category?: WorkCategory | null;
          is_active?: boolean;
          last_generated_on?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["recurring_task_templates"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "recurring_task_templates_default_department_id_fkey";
            columns: ["default_department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_checklists: {
        Row: {
          id: string;
          checklist_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          checklist_date: string;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["daily_checklists"]["Insert"]>;
        Relationships: [];
      };
      daily_checklist_items: {
        Row: {
          id: string;
          checklist_id: string;
          item_key: string;
          item_label: string;
          is_completed: boolean;
          completed_by: string | null;
          completed_at: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          checklist_id: string;
          item_key: string;
          item_label: string;
          is_completed?: boolean;
          completed_by?: string | null;
          completed_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["daily_checklist_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "daily_checklist_items_checklist_id_fkey";
            columns: ["checklist_id"];
            isOneToOne: false;
            referencedRelation: "daily_checklists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_checklist_items_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_checklists: {
        Row: {
          id: string;
          planning_month: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          planning_month: string;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["monthly_checklists"]["Insert"]>;
        Relationships: [];
      };
      monthly_checklist_items: {
        Row: {
          id: string;
          checklist_id: string;
          item_key: string;
          item_label: string;
          is_completed: boolean;
          completed_by: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          checklist_id: string;
          item_key: string;
          item_label: string;
          is_completed?: boolean;
          completed_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["monthly_checklist_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "monthly_checklist_items_checklist_id_fkey";
            columns: ["checklist_id"];
            isOneToOne: false;
            referencedRelation: "monthly_checklists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "monthly_checklist_items_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      waiting_items: {
        Row: {
          id: string;
          waiting_unit: CrossDeptUnit;
          description: string;
          related_task_id: string | null;
          created_date: string;
          expected_reply_date: string | null;
          status: WaitingStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          waiting_unit: CrossDeptUnit;
          description: string;
          related_task_id?: string | null;
          created_date?: string;
          expected_reply_date?: string | null;
          status?: WaitingStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["waiting_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "waiting_items_related_task_id_fkey";
            columns: ["related_task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      follow_up_records: {
        Row: {
          id: string;
          entity_type: FollowUpEntityType;
          entity_id: string;
          attempt_number: number;
          follow_up_date: string;
          next_follow_up_date: string | null;
          method: string | null;
          target_person: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_type: FollowUpEntityType;
          entity_id: string;
          attempt_number?: number;
          follow_up_date?: string;
          next_follow_up_date?: string | null;
          method?: string | null;
          target_person?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["follow_up_records"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "follow_up_records_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      supervisor_tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          assigned_by: string | null;
          assigned_to: string | null;
          assigned_date: string;
          due_date: string | null;
          priority: TaskPriority;
          status: SupervisorTaskStatus;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          assigned_by?: string | null;
          assigned_to?: string | null;
          assigned_date?: string;
          due_date?: string | null;
          priority?: TaskPriority;
          status?: SupervisorTaskStatus;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["taskflow"]["Tables"]["supervisor_tasks"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "supervisor_tasks_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supervisor_tasks_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_role: {
        Args: Record<string, never>;
        Returns: UserRole;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_manager_or_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      resolve_login_email: {
        Args: { p_username: string };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      aircraft_type_enum: AircraftType;
      station_enum: Station;
      work_category_enum: WorkCategory;
      planning_status_enum: PlanningStatus;
      impact_level_enum: ImpactLevel;
      recurrence_frequency_enum: RecurrenceFrequency;
      cross_dept_unit_enum: CrossDeptUnit;
      calendar_event_type: CalendarEventType;
      task_source_channel_enum: TaskSourceChannel;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["taskflow"]["Tables"]> =
  Database["taskflow"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["taskflow"]["Tables"]> =
  Database["taskflow"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["taskflow"]["Tables"]> =
  Database["taskflow"]["Tables"][T]["Update"];
