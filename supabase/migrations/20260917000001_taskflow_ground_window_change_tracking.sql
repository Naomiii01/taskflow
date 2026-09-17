-- 重新匯入班表時，已排計畫工作的地停時間不再被略過不理：時間會直接更新，
-- 找不到對應新班次時則保留舊資料並標示需要人工確認。這裡新增：
-- 1) needs_confirmation：地停被匯入判定「找不到對應新班次」時標示 true，
--    由使用者編輯／儲存該筆時自動清除（視為已確認）。
-- 2) ground_window_change_log：異動歷史紀錄（時間變更／找不到對應班次兩種），
--    存查用，不會回頭影響地停本身的計畫內容。

alter table taskflow.aircraft_ground_windows
  add column needs_confirmation boolean not null default false;

comment on column taskflow.aircraft_ground_windows.needs_confirmation is
  '重新匯入班表後，找不到對應的新地停時間（航線被拿掉或大改），舊地停保留原時間但標示需要人工確認；使用者編輯並儲存該筆後自動清除。';

create table taskflow.ground_window_change_log (
  id uuid primary key default gen_random_uuid(),
  ground_window_id uuid not null references taskflow.aircraft_ground_windows(id) on delete cascade,
  aircraft_registration text not null,
  station taskflow.station_enum not null,
  change_type text not null check (change_type in ('time_changed', 'orphaned')),
  old_arrival_at timestamptz not null,
  old_departure_at timestamptz not null,
  new_arrival_at timestamptz,
  new_departure_at timestamptz,
  plan_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table taskflow.ground_window_change_log is
  '已排計畫工作的地停時間，因重新匯入班表而被改動（time_changed）或找不到對應新班次（orphaned）時的異動紀錄，供查核用。';

create index ground_window_change_log_window_id_idx on taskflow.ground_window_change_log (ground_window_id);
create index ground_window_change_log_created_at_idx on taskflow.ground_window_change_log (created_at desc);

alter table taskflow.ground_window_change_log enable row level security;

create policy "authenticated can view ground_window_change_log"
  on taskflow.ground_window_change_log for select
  using (true);

create policy "authenticated can insert ground_window_change_log"
  on taskflow.ground_window_change_log for insert
  with check (true);

create policy "admins can delete ground_window_change_log"
  on taskflow.ground_window_change_log for delete
  using (taskflow.is_admin());
