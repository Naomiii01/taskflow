-- ============================================================================
-- AI 工作追蹤與跨部門協作系統 V1
-- Migration 2/3: functions, triggers, RLS policies
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: current user's role (SECURITY DEFINER so RLS policies that call it
-- don't recursively re-trigger RLS on taskflow.users).
-- ---------------------------------------------------------------------------

create or replace function taskflow.current_role()
returns taskflow.user_role
language sql
stable
security definer
set search_path = taskflow, public
as $$
  select role from taskflow.users where id = auth.uid();
$$;

create or replace function taskflow.is_admin()
returns boolean
language sql
stable
security definer
set search_path = taskflow, public
as $$
  select coalesce((select role from taskflow.users where id = auth.uid()) = 'Admin', false);
$$;

create or replace function taskflow.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = taskflow, public
as $$
  select coalesce((select role from taskflow.users where id = auth.uid()) in ('Admin', 'Manager'), false);
$$;

-- ---------------------------------------------------------------------------
-- Sync new Supabase Auth users into taskflow.users
-- ---------------------------------------------------------------------------

create or replace function taskflow.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = taskflow, public
as $$
begin
  insert into taskflow.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'User'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_taskflow on auth.users;
create trigger on_auth_user_created_taskflow
  after insert on auth.users
  for each row execute function taskflow.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function taskflow.set_updated_at()
returns trigger
language plpgsql
set search_path = taskflow, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on taskflow.tasks
  for each row execute function taskflow.set_updated_at();

-- ---------------------------------------------------------------------------
-- Prevent non-admins from escalating their own role via the "update own
-- profile" policy below.
-- ---------------------------------------------------------------------------

create or replace function taskflow.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = taskflow, public
as $$
begin
  if new.role is distinct from old.role and not taskflow.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger users_prevent_role_escalation
  before update on taskflow.users
  for each row execute function taskflow.prevent_role_escalation();

-- ---------------------------------------------------------------------------
-- Auto audit log + assignment notifications on task insert/update
-- ---------------------------------------------------------------------------

create or replace function taskflow.log_task_change()
returns trigger
language plpgsql
security definer
set search_path = taskflow, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into taskflow.task_logs (task_id, action_type, old_value, new_value, user_id)
    values (new.id, 'created', null, to_jsonb(new), auth.uid());

    if new.owner_id is not null then
      insert into taskflow.notifications (user_id, task_id, type, title, body)
      values (new.owner_id, new.id, 'assignment', '你被指派了新任務', new.title);
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into taskflow.task_logs (task_id, action_type, old_value, new_value, user_id)
      values (new.id, 'status_changed', to_jsonb(old.status), to_jsonb(new.status), auth.uid());
    end if;

    if new.priority is distinct from old.priority then
      insert into taskflow.task_logs (task_id, action_type, old_value, new_value, user_id)
      values (new.id, 'priority_changed', to_jsonb(old.priority), to_jsonb(new.priority), auth.uid());
    end if;

    if new.owner_id is distinct from old.owner_id then
      insert into taskflow.task_logs (task_id, action_type, old_value, new_value, user_id)
      values (new.id, 'owner_changed', to_jsonb(old.owner_id), to_jsonb(new.owner_id), auth.uid());

      if new.owner_id is not null then
        insert into taskflow.notifications (user_id, task_id, type, title, body)
        values (new.owner_id, new.id, 'assignment', '你被指派了任務', new.title);
      end if;
    end if;

    if new.department_id is distinct from old.department_id then
      insert into taskflow.task_logs (task_id, action_type, old_value, new_value, user_id)
      values (new.id, 'department_changed', to_jsonb(old.department_id), to_jsonb(new.department_id), auth.uid());
    end if;

    if new.due_date is distinct from old.due_date then
      insert into taskflow.task_logs (task_id, action_type, old_value, new_value, user_id)
      values (new.id, 'due_date_changed', to_jsonb(old.due_date), to_jsonb(new.due_date), auth.uid());
    end if;

    return new;
  end if;

  return new;
end;
$$;

create trigger tasks_log_changes
  after insert or update on taskflow.tasks
  for each row execute function taskflow.log_task_change();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table taskflow.users enable row level security;
alter table taskflow.departments enable row level security;
alter table taskflow.tasks enable row level security;
alter table taskflow.task_logs enable row level security;
alter table taskflow.followups enable row level security;
alter table taskflow.attachments enable row level security;
alter table taskflow.ai_summaries enable row level security;
alter table taskflow.notifications enable row level security;

-- users -----------------------------------------------------------------

create policy "users can view all profiles" on taskflow.users
  for select to authenticated using (true);

create policy "users can update own profile" on taskflow.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "admins manage all profiles" on taskflow.users
  for all to authenticated
  using (taskflow.is_admin())
  with check (taskflow.is_admin());

-- departments -------------------------------------------------------------

create policy "authenticated can view departments" on taskflow.departments
  for select to authenticated using (true);

create policy "managers and admins manage departments" on taskflow.departments
  for all to authenticated
  using (taskflow.is_manager_or_admin())
  with check (taskflow.is_manager_or_admin());

-- tasks ---------------------------------------------------------------------

create policy "authenticated can view tasks" on taskflow.tasks
  for select to authenticated using (true);

create policy "authenticated can create tasks" on taskflow.tasks
  for insert to authenticated with check (true);

create policy "owners, managers and admins can update tasks" on taskflow.tasks
  for update to authenticated
  using (owner_id = auth.uid() or created_by = auth.uid() or taskflow.is_manager_or_admin())
  with check (owner_id = auth.uid() or created_by = auth.uid() or taskflow.is_manager_or_admin());

create policy "admins can delete tasks" on taskflow.tasks
  for delete to authenticated using (taskflow.is_admin());

-- task_logs (system-written, read-only to users) -----------------------------

create policy "authenticated can view task logs" on taskflow.task_logs
  for select to authenticated using (true);

-- followups -------------------------------------------------------------

create policy "authenticated can view followups" on taskflow.followups
  for select to authenticated using (true);

create policy "authenticated can manage followups" on taskflow.followups
  for insert to authenticated with check (true);

create policy "authors and managers can update followups" on taskflow.followups
  for update to authenticated
  using (created_by = auth.uid() or taskflow.is_manager_or_admin())
  with check (created_by = auth.uid() or taskflow.is_manager_or_admin());

create policy "authors and admins can delete followups" on taskflow.followups
  for delete to authenticated
  using (created_by = auth.uid() or taskflow.is_admin());

-- attachments -------------------------------------------------------------

create policy "authenticated can view attachments" on taskflow.attachments
  for select to authenticated using (true);

create policy "authenticated can upload attachments" on taskflow.attachments
  for insert to authenticated with check (true);

create policy "uploaders and admins can delete attachments" on taskflow.attachments
  for delete to authenticated
  using (upload_user = auth.uid() or taskflow.is_admin());

-- ai_summaries -------------------------------------------------------------

create policy "authenticated can view ai summaries" on taskflow.ai_summaries
  for select to authenticated using (true);

create policy "authenticated can create ai summaries" on taskflow.ai_summaries
  for insert to authenticated with check (true);

-- notifications -------------------------------------------------------------

create policy "users can view own notifications" on taskflow.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "users can update own notifications" on taskflow.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Client-side inserts are limited to a user's own notifications; cross-user
-- notifications (assignments, due-date alerts) are written by SECURITY
-- DEFINER triggers/functions which bypass RLS as the table owner.
create policy "users can insert own notifications" on taskflow.notifications
  for insert to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- Expose the `taskflow` schema to the Data API (PostgREST), alongside `public`
-- ============================================================================

grant usage on schema taskflow to authenticated, anon, service_role;
grant all on all tables in schema taskflow to authenticated, service_role;
grant select on all tables in schema taskflow to anon;
grant all on all sequences in schema taskflow to authenticated, service_role;
grant execute on all functions in schema taskflow to authenticated, service_role, anon;

alter default privileges in schema taskflow grant all on tables to authenticated, service_role;
alter default privileges in schema taskflow grant select on tables to anon;
alter default privileges in schema taskflow grant all on sequences to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_schemas = ''public, taskflow''';
  end if;
end $$;

notify pgrst, 'reload config';
