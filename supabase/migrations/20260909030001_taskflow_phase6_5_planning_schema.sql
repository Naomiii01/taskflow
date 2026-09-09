-- ============================================================================
-- Phase 6.5: Aviation Planning Operations Center — schema
-- Enums, new tables, tasks/attachments column additions, indexes, RLS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type taskflow.aircraft_type_enum as enum ('A321', 'A339', 'A351', 'A359');

create type taskflow.station_enum as enum ('TPE', 'TSA', 'RMQ', 'KHH');

create type taskflow.work_category_enum as enum (
  'Daily Check', 'Short Term', 'Long Hour', 'Monthly Plan',
  'Additional Work Card', 'Project', 'Special Request', 'Supervisor Assignment'
);

create type taskflow.planning_status_enum as enum (
  'Draft', 'Planning', 'Waiting', 'Follow-Up', 'Ready', 'Scheduled', 'Completed', 'Cancelled'
);

create type taskflow.impact_level_enum as enum ('Critical', 'High', 'Medium', 'Low');

create type taskflow.recurrence_frequency_enum as enum ('Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly');

-- Shared "which cross-department unit" domain — reused by tasks.source_department,
-- tasks.waiting_owner, and waiting_items.waiting_unit (same real-world set of units).
create type taskflow.cross_dept_unit_enum as enum ('修管', 'LE', '工程部', '採購', '維修部', '品保', '其他');

-- ---------------------------------------------------------------------------
-- Fleet Master
-- ---------------------------------------------------------------------------

create table taskflow.fleet_master (
  id uuid primary key default gen_random_uuid(),
  aircraft_type taskflow.aircraft_type_enum not null,
  aircraft_registration text not null unique,
  station taskflow.station_enum not null default 'TPE',
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

create index fleet_master_type_idx on taskflow.fleet_master (aircraft_type);

-- ---------------------------------------------------------------------------
-- Project Center
-- ---------------------------------------------------------------------------

create table taskflow.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_set_updated_at
  before update on taskflow.projects
  for each row execute function taskflow.set_updated_at();

create table taskflow.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references taskflow.projects(id) on delete cascade,
  title text not null,
  target_date date,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index project_milestones_project_idx on taskflow.project_milestones (project_id);

-- ---------------------------------------------------------------------------
-- Recurring Task Engine (templates that generate real `tasks` rows)
-- ---------------------------------------------------------------------------

create table taskflow.recurring_task_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  frequency taskflow.recurrence_frequency_enum not null,
  day_of_week int check (day_of_week between 0 and 6), -- 0=Sunday, used when frequency='Weekly'
  day_of_month int check (day_of_month between 1 and 28), -- used when Monthly/Quarterly/Yearly
  month_of_year int check (month_of_year between 1 and 12), -- used when frequency='Yearly'
  -- Quarterly templates fire when day_of_month matches AND the current month is
  -- one of (quarter_start_month, +3, +6, +9) — lets one row cover a Jan/Apr/Jul/Oct
  -- (or any other) cadence instead of hardcoding calendar quarters.
  quarter_start_month int check (quarter_start_month between 1 and 3),
  -- If set, the generated task's due_date is this day-of-month in the same month
  -- (e.g. 長工時/人力/工期安排 are created on the 1st but due by the 20th).
  due_day_of_month int check (due_day_of_month between 1 and 28),
  default_title text not null,
  default_description text,
  default_department_id uuid references taskflow.departments(id) on delete set null,
  default_priority taskflow.task_priority not null default 'P3',
  default_work_category taskflow.work_category_enum,
  is_active boolean not null default true,
  last_generated_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger recurring_task_templates_set_updated_at
  before update on taskflow.recurring_task_templates
  for each row execute function taskflow.set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks: Planning-specific columns (all nullable — existing rows/flows unaffected)
-- ---------------------------------------------------------------------------

alter table taskflow.tasks
  add column aircraft_type taskflow.aircraft_type_enum,
  add column aircraft_registration text references taskflow.fleet_master(aircraft_registration) on delete set null,
  add column station taskflow.station_enum,
  add column work_category taskflow.work_category_enum,
  add column planning_month date, -- stored as the 1st of the target month
  add column source_department taskflow.cross_dept_unit_enum,
  add column waiting_owner taskflow.cross_dept_unit_enum,
  add column planning_status taskflow.planning_status_enum,
  add column impact_level taskflow.impact_level_enum,
  add column parent_task_id uuid references taskflow.tasks(id) on delete set null,
  add column project_id uuid references taskflow.projects(id) on delete set null,
  add column source_template_id uuid references taskflow.recurring_task_templates(id) on delete set null;

create index tasks_aircraft_type_idx on taskflow.tasks (aircraft_type);
create index tasks_station_idx on taskflow.tasks (station);
create index tasks_work_category_idx on taskflow.tasks (work_category);
create index tasks_planning_status_idx on taskflow.tasks (planning_status);
create index tasks_parent_task_idx on taskflow.tasks (parent_task_id);
create index tasks_project_idx on taskflow.tasks (project_id);

-- ---------------------------------------------------------------------------
-- Daily Checklist Engine
-- ---------------------------------------------------------------------------

create table taskflow.daily_checklists (
  id uuid primary key default gen_random_uuid(),
  checklist_date date not null unique,
  created_at timestamptz not null default now()
);

create table taskflow.daily_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references taskflow.daily_checklists(id) on delete cascade,
  item_key text not null, -- stable key for the default item (see PLANNING_DAILY_CHECKLIST_ITEMS)
  item_label text not null,
  is_completed boolean not null default false,
  completed_by uuid references taskflow.users(id) on delete set null,
  completed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique (checklist_id, item_key)
);

create index daily_checklist_items_checklist_idx on taskflow.daily_checklist_items (checklist_id);

-- Attachments can optionally be attached to a checklist item (reuses the
-- existing Phase 3 upload/storage pipeline instead of building a new one).
alter table taskflow.attachments
  add column checklist_item_id uuid references taskflow.daily_checklist_items(id) on delete set null;

create index attachments_checklist_item_idx on taskflow.attachments (checklist_item_id);

-- ---------------------------------------------------------------------------
-- Waiting Center
-- ---------------------------------------------------------------------------

create table taskflow.waiting_items (
  id uuid primary key default gen_random_uuid(),
  waiting_unit taskflow.cross_dept_unit_enum not null,
  description text not null,
  related_task_id uuid references taskflow.tasks(id) on delete set null, -- 來源任務
  created_date date not null default current_date,
  expected_reply_date date,
  status text not null default 'Waiting' check (status in ('Waiting', 'Replied', 'Cancelled')),
  created_by uuid references taskflow.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger waiting_items_set_updated_at
  before update on taskflow.waiting_items
  for each row execute function taskflow.set_updated_at();

create index waiting_items_status_idx on taskflow.waiting_items (status);
create index waiting_items_task_idx on taskflow.waiting_items (related_task_id);

-- ---------------------------------------------------------------------------
-- Follow-up Center (generic: attaches to a task, waiting item, or supervisor task)
-- ---------------------------------------------------------------------------

create table taskflow.follow_up_records (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('task', 'waiting_item', 'supervisor_task')),
  entity_id uuid not null,
  attempt_number int not null default 1,
  follow_up_date date not null default current_date,
  next_follow_up_date date,
  method text, -- 電話 / Email / LINE / 當面 ...
  target_person text,
  notes text,
  created_by uuid references taskflow.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index follow_up_records_entity_idx on taskflow.follow_up_records (entity_type, entity_id);
create index follow_up_records_next_date_idx on taskflow.follow_up_records (next_follow_up_date);

-- ---------------------------------------------------------------------------
-- Supervisor Assignment Center
-- ---------------------------------------------------------------------------

create table taskflow.supervisor_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_by uuid references taskflow.users(id) on delete set null, -- 交辦主管
  assigned_to uuid references taskflow.users(id) on delete set null, -- 負責人（通常是登入的 Planning 使用者）
  assigned_date date not null default current_date,
  due_date date,
  priority taskflow.task_priority not null default 'P2',
  status text not null default 'Open' check (status in ('Open', 'In Progress', 'Completed', 'Cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger supervisor_tasks_set_updated_at
  before update on taskflow.supervisor_tasks
  for each row execute function taskflow.set_updated_at();

create index supervisor_tasks_status_idx on taskflow.supervisor_tasks (status);
create index supervisor_tasks_assigned_to_idx on taskflow.supervisor_tasks (assigned_to);

-- ---------------------------------------------------------------------------
-- RLS — this whole module is an internal Planning operations tool used
-- collaboratively by a small trusted team, so it follows the same pattern
-- already established for `tasks`/`attachments`: any authenticated user can
-- view/create/update; delete (where it matters) is Admin-only. Reference data
-- (fleet_master, projects, recurring_task_templates) is viewable by everyone
-- but only Manager/Admin can manage it, consistent with `departments`.
-- ---------------------------------------------------------------------------

alter table taskflow.fleet_master enable row level security;
alter table taskflow.projects enable row level security;
alter table taskflow.project_milestones enable row level security;
alter table taskflow.recurring_task_templates enable row level security;
alter table taskflow.daily_checklists enable row level security;
alter table taskflow.daily_checklist_items enable row level security;
alter table taskflow.waiting_items enable row level security;
alter table taskflow.follow_up_records enable row level security;
alter table taskflow.supervisor_tasks enable row level security;

create policy "authenticated can view fleet_master" on taskflow.fleet_master
  for select to authenticated using (true);
create policy "managers and admins manage fleet_master" on taskflow.fleet_master
  for all to authenticated
  using ((select taskflow.is_manager_or_admin()))
  with check ((select taskflow.is_manager_or_admin()));

create policy "authenticated can view projects" on taskflow.projects
  for select to authenticated using (true);
create policy "managers and admins manage projects" on taskflow.projects
  for all to authenticated
  using ((select taskflow.is_manager_or_admin()))
  with check ((select taskflow.is_manager_or_admin()));

create policy "authenticated can view project_milestones" on taskflow.project_milestones
  for select to authenticated using (true);
create policy "managers and admins manage project_milestones" on taskflow.project_milestones
  for all to authenticated
  using ((select taskflow.is_manager_or_admin()))
  with check ((select taskflow.is_manager_or_admin()));

create policy "authenticated can view recurring_task_templates" on taskflow.recurring_task_templates
  for select to authenticated using (true);
create policy "managers and admins manage recurring_task_templates" on taskflow.recurring_task_templates
  for all to authenticated
  using ((select taskflow.is_manager_or_admin()))
  with check ((select taskflow.is_manager_or_admin()));

create policy "authenticated can view daily_checklists" on taskflow.daily_checklists
  for select to authenticated using (true);
create policy "authenticated can insert daily_checklists" on taskflow.daily_checklists
  for insert to authenticated with check (true);

create policy "authenticated can view daily_checklist_items" on taskflow.daily_checklist_items
  for select to authenticated using (true);
create policy "authenticated can insert daily_checklist_items" on taskflow.daily_checklist_items
  for insert to authenticated with check (true);
create policy "authenticated can update daily_checklist_items" on taskflow.daily_checklist_items
  for update to authenticated using (true) with check (true);

create policy "authenticated can view waiting_items" on taskflow.waiting_items
  for select to authenticated using (true);
create policy "authenticated can insert waiting_items" on taskflow.waiting_items
  for insert to authenticated with check (true);
create policy "authenticated can update waiting_items" on taskflow.waiting_items
  for update to authenticated using (true) with check (true);
create policy "admins can delete waiting_items" on taskflow.waiting_items
  for delete to authenticated using ((select taskflow.is_admin()));

create policy "authenticated can view follow_up_records" on taskflow.follow_up_records
  for select to authenticated using (true);
create policy "authenticated can insert follow_up_records" on taskflow.follow_up_records
  for insert to authenticated with check (true);
create policy "admins can delete follow_up_records" on taskflow.follow_up_records
  for delete to authenticated using ((select taskflow.is_admin()));

create policy "authenticated can view supervisor_tasks" on taskflow.supervisor_tasks
  for select to authenticated using (true);
create policy "authenticated can insert supervisor_tasks" on taskflow.supervisor_tasks
  for insert to authenticated with check (true);
create policy "authenticated can update supervisor_tasks" on taskflow.supervisor_tasks
  for update to authenticated using (true) with check (true);
create policy "admins can delete supervisor_tasks" on taskflow.supervisor_tasks
  for delete to authenticated using ((select taskflow.is_admin()));
