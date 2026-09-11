-- Aircraft Registration: single-select -> multi-select array (通常不會10架都執行,
-- 可能只挑3架或5架). Dropping the FK to fleet_master since Postgres foreign keys
-- can't target an array column; valid values are still enforced at the app layer
-- (the picker only ever offers registrations that exist in fleet_master).
alter table taskflow.tasks drop constraint tasks_aircraft_registration_fkey;

alter table taskflow.tasks add column aircraft_registration_multi text[] not null default '{}';
update taskflow.tasks set aircraft_registration_multi = case when aircraft_registration is not null then array[aircraft_registration] else '{}' end;
alter table taskflow.tasks drop column aircraft_registration;
alter table taskflow.tasks rename column aircraft_registration_multi to aircraft_registration;

create index tasks_aircraft_registration_gin_idx on taskflow.tasks using gin (aircraft_registration);

comment on column taskflow.tasks.aircraft_registration is '機號（可複選，儲存為陣列）。選項來自 Fleet Master，未使用外鍵約束（陣列欄位無法設定外鍵）。';
