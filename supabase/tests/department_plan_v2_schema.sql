\set ON_ERROR_STOP on

create extension if not exists pgcrypto;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end
$roles$;

create table public.departments (
  id uuid primary key,
  code text unique not null,
  name text not null
);

create table public.staff_users (
  id uuid primary key,
  full_name text not null,
  department_id uuid not null references public.departments(id)
);

create table public.tasks (
  id uuid primary key,
  title text not null
);

create table public.work_schedules (
  id uuid primary key,
  title text not null
);

insert into public.departments(id, code, name) values
  ('00000000-0000-0000-0000-000000000001', 'dep-a', 'Department A'),
  ('00000000-0000-0000-0000-000000000002', 'dep-b', 'Department B');

insert into public.staff_users(id, full_name, department_id) values
  ('00000000-0000-0000-0000-000000000011', 'Manager A', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000012', 'Employee A', '00000000-0000-0000-0000-000000000001');

insert into public.tasks(id, title) values
  ('00000000-0000-0000-0000-000000000021', 'Existing task'),
  ('00000000-0000-0000-0000-000000000022', 'Link target');

insert into public.work_schedules(id, title) values
  ('00000000-0000-0000-0000-000000000031', 'Existing personal plan sentinel');

\ir ../migrations/20260926140000_department_plans_v2.sql
\ir ../migrations/20260926140000_department_plans_v2.sql

do $test$
declare
  v_week_1 uuid;
  v_week_2 uuid;
  v_month uuid;
  v_month_2 uuid;
  v_dep_b uuid;
begin
  select id into v_week_1 from public.api_get_or_create_department_plan(
    '00000000-0000-0000-0000-000000000001', 'weekly', date '2026-06-01', date '2026-06-07',
    '00000000-0000-0000-0000-000000000011'
  );
  select id into v_week_2 from public.api_get_or_create_department_plan(
    '00000000-0000-0000-0000-000000000001', 'weekly', date '2026-06-01', date '2026-06-07',
    '00000000-0000-0000-0000-000000000011'
  );
  if v_week_1 <> v_week_2 or (select count(*) from public.department_plans where department_id = '00000000-0000-0000-0000-000000000001' and period_type = 'weekly' and period_start = date '2026-06-01') <> 1 then
    raise exception 'weekly uniqueness or race-safe upsert failed';
  end if;

  select id into v_month from public.api_get_or_create_department_plan(
    '00000000-0000-0000-0000-000000000001', 'monthly', date '2026-06-01', date '2026-06-30',
    '00000000-0000-0000-0000-000000000011'
  );
  if v_month = v_week_1 then raise exception 'weekly and monthly plans must coexist'; end if;
  select id into v_month_2 from public.api_get_or_create_department_plan(
    '00000000-0000-0000-0000-000000000001', 'monthly', date '2026-06-01', date '2026-06-30',
    '00000000-0000-0000-0000-000000000011'
  );
  if v_month <> v_month_2 or (select count(*) from public.department_plans where department_id = '00000000-0000-0000-0000-000000000001' and period_type = 'monthly' and period_start = date '2026-06-01') <> 1 then
    raise exception 'monthly uniqueness failed';
  end if;

  select id into v_dep_b from public.api_get_or_create_department_plan(
    '00000000-0000-0000-0000-000000000002', 'weekly', date '2026-06-01', date '2026-06-07',
    '00000000-0000-0000-0000-000000000011'
  );
  if v_dep_b = v_week_1 then raise exception 'departments must be independent'; end if;

  insert into public.department_plan_items(
    department_plan_id, department_id, title, assignment_state, created_by
  ) values
    (v_week_1, '00000000-0000-0000-0000-000000000001', 'Unassigned', 'unassigned', '00000000-0000-0000-0000-000000000011'),
    (v_week_1, '00000000-0000-0000-0000-000000000001', 'Department wide', 'department_wide', '00000000-0000-0000-0000-000000000011');
end
$test$;

insert into public.department_plan_items(
  department_plan_id, department_id, title, assignee_id, assignment_state, work_status, linked_task_id, created_by
) values (
  (select id from public.department_plans where department_id = '00000000-0000-0000-0000-000000000001' and period_type = 'weekly'),
  '00000000-0000-0000-0000-000000000001', 'Assigned valid',
  '00000000-0000-0000-0000-000000000012', 'assigned', 'in_progress',
  '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000011'
);

do $negative$
begin
  begin
    insert into public.department_plans(department_id, period_type, period_start, period_end, created_by)
    values ('00000000-0000-0000-0000-000000000001', 'weekly', date '2026-06-02', date '2026-06-08', '00000000-0000-0000-0000-000000000011');
    raise exception 'weekly Monday guard failed';
  exception when check_violation then null; end;

  begin
    insert into public.department_plans(department_id, period_type, period_start, period_end, created_by)
    values ('00000000-0000-0000-0000-000000000001', 'weekly', date '2026-06-08', date '2026-06-15', '00000000-0000-0000-0000-000000000011');
    raise exception 'weekly end guard failed';
  exception when check_violation then null; end;

  begin
    insert into public.department_plans(department_id, period_type, period_start, period_end, created_by)
    values ('00000000-0000-0000-0000-000000000001', 'monthly', date '2026-06-02', date '2026-06-30', '00000000-0000-0000-0000-000000000011');
    raise exception 'monthly first-day guard failed';
  exception when check_violation then null; end;

  begin
    insert into public.department_plans(department_id, period_type, period_start, period_end, created_by)
    values ('00000000-0000-0000-0000-000000000001', 'monthly', date '2026-07-01', date '2026-07-30', '00000000-0000-0000-0000-000000000011');
    raise exception 'monthly last-day guard failed';
  exception when check_violation then null; end;

  begin
    insert into public.department_plan_items(department_plan_id, department_id, title, assignment_state, created_by)
    values ((select id from public.department_plans where department_id = '00000000-0000-0000-0000-000000000001' and period_type = 'weekly'), '00000000-0000-0000-0000-000000000001', 'Invalid enum', 'unknown', '00000000-0000-0000-0000-000000000011');
    raise exception 'invalid assignment enum guard failed';
  exception when check_violation then null; end;

  begin
    insert into public.department_plan_items(department_plan_id, department_id, title, assignment_state, created_by)
    values ((select id from public.department_plans where department_id = '00000000-0000-0000-0000-000000000001' and period_type = 'weekly'), '00000000-0000-0000-0000-000000000001', 'Invalid status', 'unassigned', '00000000-0000-0000-0000-000000000011');
    update public.department_plan_items set work_status = 'unknown' where title = 'Invalid status';
    raise exception 'invalid work status guard failed';
  exception when check_violation then null; end;

  begin
    insert into public.department_plan_items(department_plan_id, department_id, title, assignment_state, created_by)
    values ((select id from public.department_plans where department_id = '00000000-0000-0000-0000-000000000001' and period_type = 'weekly'), '00000000-0000-0000-0000-000000000002', 'Forged department', 'unassigned', '00000000-0000-0000-0000-000000000011');
    raise exception 'forged cross-department item guard failed';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.department_plan_items(department_plan_id, department_id, title, assignee_id, assignment_state, linked_task_id, created_by)
    values ((select id from public.department_plans where department_id = '00000000-0000-0000-0000-000000000001' and period_type = 'weekly'), '00000000-0000-0000-0000-000000000001', 'Duplicate task link', '00000000-0000-0000-0000-000000000012', 'assigned', '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000011');
    raise exception 'linked task uniqueness guard failed';
  exception when unique_violation then null; end;
end
$negative$;

do $preservation$
begin
  if (select count(*) from public.tasks where id = '00000000-0000-0000-0000-000000000021') <> 1 then
    raise exception 'task data changed';
  end if;
  if (select count(*) from public.work_schedules where id = '00000000-0000-0000-0000-000000000031') <> 1 then
    raise exception 'personal plan data changed';
  end if;
  if (select count(*) from public.department_plan_items where assignment_state = 'unassigned' and assignee_id is null) = 0 then
    raise exception 'nullable assignee or unassigned state failed';
  end if;
  if (select count(*) from public.department_plan_items where assignment_state = 'department_wide' and assignee_id is null) = 0 then
    raise exception 'department-wide state failed';
  end if;
  if (select count(*) from public.department_plan_items where assignment_state = 'assigned' and assignee_id is not null) = 0 then
    raise exception 'assigned state failed';
  end if;
end
$preservation$;

select 'department-plan-v2-schema: PASS' as result;
