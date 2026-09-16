-- 航機長期駐留場站排程（例如駐廠RMQ的輪替表）。
--
-- 這跟 aircraft_ground_windows 是分開的兩種資訊，刻意不合併：
-- aircraft_ground_windows 是從每日班表算出來的「地面時間」（通常幾小時到一晚），
-- 這裡記錄的則是「這整段期間（通常兩週一輪）飛機整台駐留在某個場站」的長天期
-- 區間，來源是排班單位另外維護的駐廠輪替表，不是從航班推算出來的。畫面上兩者
-- 疊加顯示，不互相取代。
create table taskflow.aircraft_residency_windows (
  id uuid primary key default gen_random_uuid(),
  aircraft_registration text not null references taskflow.fleet_master(aircraft_registration),
  station taskflow.station_enum not null,
  start_date date not null,
  end_date date not null,
  source text not null default 'manual' check (source = any (array['manual', 'import'])),
  notes text,
  created_by uuid references taskflow.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aircraft_residency_windows_date_order check (end_date > start_date)
);

comment on table taskflow.aircraft_residency_windows is '航機長期駐留場站排程（例如駐廠RMQ的輪替表）——跟 aircraft_ground_windows 的每日地停格子是分開、疊加顯示的兩種資訊。';
comment on column taskflow.aircraft_residency_windows.start_date is '駐留起始日（含當天）。';
comment on column taskflow.aircraft_residency_windows.end_date is '駐留結束日——約定為下一輪開始的那一天（即區間為 [start_date, end_date) 半開區間），跟輪替表「訖」欄位的填法一致。';

create index aircraft_residency_windows_lookup_idx
  on taskflow.aircraft_residency_windows (aircraft_registration, start_date, end_date);

alter table taskflow.aircraft_residency_windows enable row level security;

create policy "authenticated can view aircraft_residency_windows"
  on taskflow.aircraft_residency_windows for select
  using (true);

create policy "authenticated can insert aircraft_residency_windows"
  on taskflow.aircraft_residency_windows for insert
  with check (true);

create policy "authenticated can update aircraft_residency_windows"
  on taskflow.aircraft_residency_windows for update
  using (true)
  with check (true);

create policy "admins can delete aircraft_residency_windows"
  on taskflow.aircraft_residency_windows for delete
  using (taskflow.is_admin());

notify pgrst, 'reload schema';
