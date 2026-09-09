-- Phase 6.5 repositions this system as an Aviation Planning Operations
-- Center, but the original seed departments (業務部/客服部/行銷部/教練培訓部/
-- 財務部) predate that and have no "Planning" department for the Recurring
-- Task Engine's Monthly Planning Templates to default into (tasks.department_id
-- is NOT NULL). Add one and wire the 7 seeded templates to it.
insert into taskflow.departments (department_name)
values ('Planning 計畫組')
on conflict (department_name) do nothing;

update taskflow.recurring_task_templates t
set default_department_id = d.id
from taskflow.departments d
where d.department_name = 'Planning 計畫組'
  and t.default_department_id is null;
