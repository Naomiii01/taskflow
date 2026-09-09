-- ============================================================================
-- AI 工作追蹤與跨部門協作系統 V1
-- Migration 1/3: schema, tables, enums
--
-- Everything lives in a dedicated `taskflow` schema so it never collides
-- with other apps (e.g. Stock Profit Assistant) that already use the
-- `public` schema in this Supabase project.
-- ============================================================================

create schema if not exists taskflow;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type taskflow.user_role as enum ('Admin', 'Manager', 'User');

create type taskflow.task_status as enum (
  'Todo',
  'In Progress',
  'Waiting Response',
  'Pending Approval',
  'Completed',
  'Cancelled'
);

create type taskflow.task_priority as enum ('P1', 'P2', 'P3', 'P4');

-- ---------------------------------------------------------------------------
-- users: extends auth.users with app-level profile + role
-- ---------------------------------------------------------------------------

create table taskflow.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text,
  role taskflow.user_role not null default 'User',
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table taskflow.users is '應用程式使用者資料，與 auth.users 一對一對應。';

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------

create table taskflow.departments (
  id uuid primary key default gen_random_uuid(),
  department_name text not null unique,
  manager uuid references taskflow.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create sequence taskflow.task_number_seq;

create table taskflow.tasks (
  id uuid primary key default gen_random_uuid(),
  task_number text not null unique default (
    'T-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('taskflow.task_number_seq')::text, 5, '0')
  ),
  title text not null,
  description text,
  priority taskflow.task_priority not null default 'P3',
  status taskflow.task_status not null default 'Todo',
  due_date date,
  followup_date date,
  owner_id uuid references taskflow.users (id) on delete set null,
  department_id uuid references taskflow.departments (id) on delete set null,
  created_by uuid references taskflow.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter sequence taskflow.task_number_seq owned by taskflow.tasks.task_number;

create index tasks_status_idx on taskflow.tasks (status);
create index tasks_priority_idx on taskflow.tasks (priority);
create index tasks_department_idx on taskflow.tasks (department_id);
create index tasks_owner_idx on taskflow.tasks (owner_id);
create index tasks_due_date_idx on taskflow.tasks (due_date);
create index tasks_followup_date_idx on taskflow.tasks (followup_date);

-- Full-text search across title + description (used by the search center).
alter table taskflow.tasks add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored;

create index tasks_search_idx on taskflow.tasks using gin (search_vector);

-- ---------------------------------------------------------------------------
-- task_logs: full audit trail of every change made to a task
-- ---------------------------------------------------------------------------

create table taskflow.task_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references taskflow.tasks (id) on delete cascade,
  action_type text not null,
  old_value jsonb,
  new_value jsonb,
  user_id uuid references taskflow.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index task_logs_task_idx on taskflow.task_logs (task_id, created_at desc);

-- ---------------------------------------------------------------------------
-- followups: cross-department follow-up records for a task
-- ---------------------------------------------------------------------------

create table taskflow.followups (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references taskflow.tasks (id) on delete cascade,
  followup_date date not null default current_date,
  department_name text,
  content text,
  result text,
  next_action text,
  created_by uuid references taskflow.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index followups_task_idx on taskflow.followups (task_id, followup_date desc);

-- ---------------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------------

create table taskflow.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references taskflow.tasks (id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text,
  file_size bigint,
  upload_user uuid references taskflow.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index attachments_task_idx on taskflow.attachments (task_id);

-- ---------------------------------------------------------------------------
-- ai_summaries
-- ---------------------------------------------------------------------------

create table taskflow.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references taskflow.tasks (id) on delete cascade,
  source_attachment_id uuid references taskflow.attachments (id) on delete set null,
  summary text,
  key_points jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now()
);

create index ai_summaries_task_idx on taskflow.ai_summaries (task_id);

-- ---------------------------------------------------------------------------
-- notifications (supports the Notification Center)
-- ---------------------------------------------------------------------------

create table taskflow.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references taskflow.users (id) on delete cascade,
  task_id uuid references taskflow.tasks (id) on delete cascade,
  type text not null check (type in ('due', 'overdue', 'update', 'assignment', 'stale')),
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on taskflow.notifications (user_id, read_at, created_at desc);
