-- ============================================================================
-- Phase 6.5: Aviation Planning Operations Center — seed data
-- Fleet Master registrations, default Projects, Monthly Planning Templates.
-- ============================================================================

insert into taskflow.fleet_master (aircraft_type, aircraft_registration, station)
select 'A321'::taskflow.aircraft_type_enum, 'B-' || n, 'TPE'::taskflow.station_enum from generate_series(58201, 58215) n
union all
select 'A339'::taskflow.aircraft_type_enum, 'B-' || n, 'TPE'::taskflow.station_enum from generate_series(58301, 58310) n
union all
select 'A351'::taskflow.aircraft_type_enum, 'B-' || n, 'TPE'::taskflow.station_enum from generate_series(58551, 58554) n
union all
select 'A359'::taskflow.aircraft_type_enum, 'B-' || n, 'TPE'::taskflow.station_enum from generate_series(58501, 58510) n;

insert into taskflow.projects (code, name, description, status) values
  ('RMQ', 'RMQ 計畫', 'RMQ 站計畫管理', 'Active'),
  ('KHH', 'KHH 計畫', 'KHH 站計畫管理', 'Active'),
  ('OTHER', '其他專案', '未歸類於 RMQ / KHH 的其他專案', 'Active');

-- Monthly Planning Templates: auto-created by the Recurring Task Engine
-- (see recurring-task-engine.ts) on the configured day_of_month. The three
-- "由 20 日前完成" items are created on the 1st with due_day_of_month=20.
insert into taskflow.recurring_task_templates
  (name, frequency, day_of_month, due_day_of_month, default_title, default_priority, default_work_category)
values
  ('A321短天期整理', 'Monthly', 1, null, 'A321 短天期整理', 'P2', 'Short Term'),
  ('A339短天期整理', 'Monthly', 1, null, 'A339 短天期整理', 'P2', 'Short Term'),
  ('額外工單整理', 'Monthly', 1, null, '額外工單整理', 'P3', 'Additional Work Card'),
  ('修管月計畫整理', 'Monthly', 15, null, '修管月計畫整理', 'P2', 'Monthly Plan'),
  ('長工時安排', 'Monthly', 1, 20, '長工時安排', 'P2', 'Long Hour'),
  ('人力安排', 'Monthly', 1, 20, '人力安排', 'P2', 'Monthly Plan'),
  ('工期安排', 'Monthly', 1, 20, '工期安排', 'P2', 'Monthly Plan');
