-- ============================================================================
-- Monthly Checklist: 完成勾選 for the Planning Timeline's monthly milestones
-- (1日短天期整理/額外工單整理、15日修管月計畫整理、20日長工時/人力/工期安排
-- 完成期限 — see PLANNING_MONTHLY_MILESTONES), mirroring the Daily Checklist
-- Engine so each month's 3 items can be checked off once done, instead of
-- the "已過期限" badge just sitting there for the rest of the month.
-- ============================================================================

create table taskflow.monthly_checklists (
  id uuid primary key default gen_random_uuid(),
  planning_month date not null unique, -- stored as the 1st of the month
  created_at timestamptz not null default now()
);

create table taskflow.monthly_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references taskflow.monthly_checklists(id) on delete cascade,
  item_key text not null, -- day-of-month as text, e.g. "1"/"15"/"20" (see PLANNING_MONTHLY_MILESTONES)
  item_label text not null,
  is_completed boolean not null default false,
  completed_by uuid references taskflow.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (checklist_id, item_key)
);

create index monthly_checklist_items_checklist_idx on taskflow.monthly_checklist_items (checklist_id);

-- RLS — same pattern as daily_checklists/daily_checklist_items: any
-- authenticated user can view/create/update (small trusted internal team).
alter table taskflow.monthly_checklists enable row level security;
alter table taskflow.monthly_checklist_items enable row level security;

create policy "authenticated can view monthly_checklists" on taskflow.monthly_checklists
  for select to authenticated using (true);
create policy "authenticated can insert monthly_checklists" on taskflow.monthly_checklists
  for insert to authenticated with check (true);

create policy "authenticated can view monthly_checklist_items" on taskflow.monthly_checklist_items
  for select to authenticated using (true);
create policy "authenticated can insert monthly_checklist_items" on taskflow.monthly_checklist_items
  for insert to authenticated with check (true);
create policy "authenticated can update monthly_checklist_items" on taskflow.monthly_checklist_items
  for update to authenticated using (true) with check (true);
