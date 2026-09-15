-- Aircraft Planning Board Lite expansion: adds the "Planning Information"
-- fields to each ground window (what major work, if any, is planned during
-- that ground stay), a "Current Status" per window, a singleton settings row
-- for the Capacity Warning thresholds, and a link from tasks to the ground
-- window they've been scheduled into (so "待安排工單數量" can mean something
-- real: a Todo task not yet tied to any ground-time slot).
--
-- This file is a local record of a migration already applied directly to
-- the live Supabase project via MCP tools — it doesn't need to be re-run.

create type taskflow.aircraft_current_status_enum as enum ('Available', 'In Service', 'In Maintenance', 'AOG');

create type taskflow.major_work_planning_status_enum as enum ('Draft', 'Confirmed', 'In Progress', 'Completed', 'Cancelled');

alter table taskflow.aircraft_ground_windows
  add column current_status taskflow.aircraft_current_status_enum,
  add column major_work_planned text,
  add column estimated_mh numeric(6, 1),
  add column required_skill text,
  add column required_equipment text,
  add column required_authorization text,
  add column planning_status taskflow.major_work_planning_status_enum;

create table taskflow.planning_board_settings (
  id text primary key default 'singleton',
  yellow_threshold integer not null default 3,
  red_threshold integer not null default 5,
  updated_by uuid references taskflow.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint planning_board_settings_singleton check (id = 'singleton'),
  constraint planning_board_settings_threshold_check check (red_threshold >= yellow_threshold and yellow_threshold >= 0)
);

insert into taskflow.planning_board_settings (id) values ('singleton');

create trigger planning_board_settings_set_updated_at
before update on taskflow.planning_board_settings
for each row execute function taskflow.set_updated_at();

alter table taskflow.planning_board_settings enable row level security;

create policy "authenticated can view planning_board_settings" on taskflow.planning_board_settings
  for select using (true);
create policy "authenticated can update planning_board_settings" on taskflow.planning_board_settings
  for update using (true) with check (true);

alter table taskflow.tasks
  add column linked_ground_window_id uuid references taskflow.aircraft_ground_windows(id) on delete set null;

create index tasks_linked_ground_window_idx on taskflow.tasks (linked_ground_window_id);

notify pgrst, 'reload schema';
