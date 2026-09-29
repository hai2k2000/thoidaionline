begin;

create table if not exists public.department_plans (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id),
  period_type text not null,
  period_start date not null,
  period_end date not null,
  created_by uuid not null references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint department_plans_period_type_check
    check (period_type in ('weekly', 'monthly')),
  constraint department_plans_period_shape_check
    check (
      (period_type = 'weekly'
        and extract(isodow from period_start) = 1
        and period_end = period_start + 6)
      or
      (period_type = 'monthly'
        and period_start = date_trunc('month', period_start)::date
        and period_end = (period_start + interval '1 month - 1 day')::date)
    ),
  constraint department_plans_period_unique
    unique (department_id, period_type, period_start),
  constraint department_plans_id_department_unique
    unique (id, department_id)
);

create table if not exists public.department_plan_items (
  id uuid primary key default gen_random_uuid(),
  department_plan_id uuid not null,
  department_id uuid not null,
  title text not null,
  description text,
  requirements text,
  due_at timestamptz,
  assignee_id uuid references public.staff_users(id) on delete set null,
  assignment_state text not null default 'unassigned',
  work_status text not null default 'planned',
  linked_task_id uuid unique references public.tasks(id) on delete set null,
  created_by uuid not null references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint department_plan_items_assignment_state_check
    check (assignment_state in ('unassigned', 'department_wide', 'assigned')),
  constraint department_plan_items_work_status_check
    check (work_status in ('planned', 'in_progress', 'completed', 'cancelled')),
  constraint department_plan_items_assignment_shape_check
    check (
      (assignment_state = 'assigned' and assignee_id is not null)
      or (assignment_state in ('unassigned', 'department_wide') and assignee_id is null)
    ),
  constraint department_plan_items_plan_department_fk
    foreign key (department_plan_id, department_id)
    references public.department_plans(id, department_id)
    on delete cascade
);

create index if not exists department_plan_items_plan_due_idx
  on public.department_plan_items(department_plan_id, due_at);

create index if not exists department_plan_items_department_state_idx
  on public.department_plan_items(department_id, assignment_state);

create index if not exists department_plan_items_assignee_idx
  on public.department_plan_items(assignee_id);

alter table public.department_plans enable row level security;
alter table public.department_plan_items enable row level security;
revoke all on public.department_plans from public, anon, authenticated;
revoke all on public.department_plan_items from public, anon, authenticated;
grant select, insert, update, delete on public.department_plans to service_role;
grant select, insert, update, delete on public.department_plan_items to service_role;

create or replace function public.api_get_or_create_department_plan(
  p_department_id uuid,
  p_period_type text,
  p_period_start date,
  p_period_end date,
  p_created_by uuid
) returns public.department_plans
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_plan public.department_plans;
begin
  if p_period_type not in ('weekly', 'monthly') then
    raise exception 'invalid department plan period type' using errcode = '22023';
  end if;
  if p_period_type = 'weekly' and (
    extract(isodow from p_period_start) <> 1
    or p_period_end <> p_period_start + 6
  ) then
    raise exception 'invalid weekly department plan period' using errcode = '22023';
  end if;
  if p_period_type = 'monthly' and (
    p_period_start <> date_trunc('month', p_period_start)::date
    or p_period_end <> (p_period_start + interval '1 month - 1 day')::date
  ) then
    raise exception 'invalid monthly department plan period' using errcode = '22023';
  end if;
  insert into public.department_plans(
    department_id, period_type, period_start, period_end, created_by
  ) values (
    p_department_id, p_period_type, p_period_start, p_period_end, p_created_by
  )
  on conflict (department_id, period_type, period_start)
  do update set updated_at = public.department_plans.updated_at
  returning * into v_plan;
  return v_plan;
end;
$function$;

revoke all on function public.api_get_or_create_department_plan(uuid, text, date, date, uuid) from public, anon, authenticated;
grant execute on function public.api_get_or_create_department_plan(uuid, text, date, date, uuid) to service_role;

commit;
