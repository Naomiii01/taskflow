// Hand-written types for the `taskflow` schema (a dedicated Postgres schema
// added to this Supabase project, kept separate from other apps' `public`
// tables). Mirrors supabase/migrations/20260907000001_taskflow_schema.sql.
//
// If you add/change columns, update this file to match, or wire up
// `supabase gen types typescript --schema taskflow` once the Supabase CLI
// is linked to this project.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "Admin" | "Manager" | "User";

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

export type FollowUpEntityType = "task" | "waiting_item" | "supervisor_task";

export type SupervisorTaskStatus = "Open" | "In Progress" | "Completed" | "Cancelled";

export interface Database {
  taskflow: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          role?: UserRole;
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
          department_id: string | null;
          created_by: string | null;
          tags: string[];
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          // Phase 6.5: Aviation Planning Operations Center
          aircraft_type: AircraftType | null;
          aircraft_registration: string | null;
          station: Station | null;
          work_category: WorkCategory | null;
          planning_month: string | null;
          source_department: CrossDeptUnit | null;
          waiting_owner: CrossDeptUnit | null;
          planning_status: PlanningStatus | null;
          impact_level: ImpactLevel | null;
          parent_task_id: string | null;
          project_id: string | null;
          source_template_id: string | null;
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
          department_id?: string | null;
          created_by?: string | null;
          tags?: string[];
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          aircraft_type?: AircraftType | null;
          aircraft_registration?: string | null;
          station?: Station | null;
          work_category?: WorkCategory | null;
          planning_month?: string | null;
          source_department?: CrossDeptUnit | null;
          waiting_owner?: CrossDeptUnit | null;
          planning_status?: PlanningStatus | null;
          impact_level?: ImpactLevel | null;
          parent_task_id?: string | null;
          project_id?: string | null;
          source_template_id?: string | null;
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
