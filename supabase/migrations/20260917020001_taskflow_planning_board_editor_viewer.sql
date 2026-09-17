-- Aircraft Planning Board 專用的編輯者/閱覽者區分——跟系統其他功能的 role
-- (Admin/Manager/User) 分開，只影響地面時間新增/編輯、匯入班表、容量警示門檻
-- 這幾個地方，不影響工單、看板、行事曆等其他功能。預設 editor，既有帳號不會
-- 因為這次改動無故失去現有的編輯權限。Admin 永遠可以編輯，不受這個欄位限制。

alter table taskflow.users
  add column planning_board_role text not null default 'editor'
  check (planning_board_role in ('editor', 'viewer'));

comment on column taskflow.users.planning_board_role is
  'Aircraft Planning Board 專用權限：editor 可以新增/編輯地面時間、匯入班表、調整容量警示門檻；viewer 只能檢視看板。跟系統其他功能用的 role 分開。Admin 永遠視為 editor。';

create or replace function taskflow.can_edit_planning_board()
returns boolean
language sql
stable
security definer
set search_path = taskflow, public
as $$
  select coalesce(
    (select role = 'Admin' or planning_board_role = 'editor' from taskflow.users where id = auth.uid()),
    false
  );
$$;

-- aircraft_ground_windows：新增／編輯要求 editor（刪除維持原本 admin-only 不變）
drop policy "authenticated can insert aircraft_ground_windows" on taskflow.aircraft_ground_windows;
create policy "planning editors can insert aircraft_ground_windows"
  on taskflow.aircraft_ground_windows for insert
  with check (taskflow.can_edit_planning_board());

drop policy "authenticated can update aircraft_ground_windows" on taskflow.aircraft_ground_windows;
create policy "planning editors can update aircraft_ground_windows"
  on taskflow.aircraft_ground_windows for update
  using (taskflow.can_edit_planning_board())
  with check (taskflow.can_edit_planning_board());

-- planning_board_settings（容量警示門檻）：一樣要求 editor 才能調整
drop policy "authenticated can update planning_board_settings" on taskflow.planning_board_settings;
create policy "planning editors can update planning_board_settings"
  on taskflow.planning_board_settings for update
  using (taskflow.can_edit_planning_board())
  with check (taskflow.can_edit_planning_board());
