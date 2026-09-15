-- Aircraft Planning Board Lite (Phase 6.6 pivot): stores manually-entered or
-- imported ground-time windows per aircraft — when it's on the ground at a
-- station, from arrival to next departure. This is the raw data the board's
-- three Lite dimensions (Aircraft Availability / Ground Time / Overnight
-- Opportunity) are all computed from at read time; nothing here is derived.
--
-- This file is a local record of a migration that was already applied
-- directly to the live Supabase project via MCP tools (see project notes) —
-- it doesn't need to be re-run, it just keeps the migration history in the
-- repo so `supabase/migrations` matches what's actually in the database.
create table taskflow.aircraft_ground_windows (
  id uuid primary key default gen_random_uuid(),
  aircraft_registration text not null references taskflow.fleet_master(aircraft_registration) on delete cascade,
  station taskflow.station_enum not null,
  arrival_at timestamptz not null,
  departure_at timestamptz not null,
  notes text,
  -- 'manual' = typed in one at a time via the dialog; 'import' = brought in
  -- from an uploaded schedule file (see aircraft-planning-service.ts).
  source text not null default 'manual',
  created_by uuid references taskflow.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aircraft_ground_windows_time_check check (departure_at > arrival_at),
  constraint aircraft_ground_windows_source_check check (source in ('manual', 'import'))
);

create index aircraft_ground_windows_reg_idx on taskflow.aircraft_ground_windows (aircraft_registration);
create index aircraft_ground_windows_arrival_idx on taskflow.aircraft_ground_windows (arrival_at);
create index aircraft_ground_windows_departure_idx on taskflow.aircraft_ground_windows (departure_at);

create trigger aircraft_ground_windows_set_updated_at
before update on taskflow.aircraft_ground_windows
for each row execute function taskflow.set_updated_at();

alter table taskflow.aircraft_ground_windows enable row level security;

create policy "authenticated can view aircraft_ground_windows" on taskflow.aircraft_ground_windows
  for select using (true);
create policy "authenticated can insert aircraft_ground_windows" on taskflow.aircraft_ground_windows
  for insert with check (true);
create policy "authenticated can update aircraft_ground_windows" on taskflow.aircraft_ground_windows
  for update using (true) with check (true);
create policy "admins can delete aircraft_ground_windows" on taskflow.aircraft_ground_windows
  for delete using (taskflow.is_admin());

notify pgrst, 'reload schema';
