-- 異動紀錄要看得出來是誰做的（目前只有兩位可編輯者）——重新匯入班表時，
-- 把執行匯入的使用者記進每一筆異動紀錄。使用者刪除帳號時舊紀錄不必連坐
-- 消失，所以用 set null 而不是 cascade。
alter table taskflow.ground_window_change_log
  add column changed_by uuid references taskflow.users(id) on delete set null;

comment on column taskflow.ground_window_change_log.changed_by is
  '執行這次班表匯入、導致這筆地停被異動的使用者。';
