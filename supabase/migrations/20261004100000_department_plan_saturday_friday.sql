begin;

-- Keep deployed Monday-Sunday rows readable while making Saturday-Friday the
-- only boundary accepted for newly-created weekly Department Plans.
alter table public.department_plans drop constraint if exists department_plans_period_shape_check;
alter table public.department_plans add constraint department_plans_period_shape_check
  check (
    (period_type = 'weekly'
      and extract(isodow from period_start) in (1, 6)
      and period_end = period_start + 6)
    or
    (period_type = 'monthly'
      and period_start = date_trunc('month', period_start)::date
      and period_end = (period_start + interval '1 month - 1 day')::date)
  );

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
  if p_period_type = 'weekly' and p_period_end <> p_period_start + 6 then
    raise exception 'invalid weekly department plan period' using errcode = '22023';
  end if;
  if p_period_type = 'weekly' and extract(isodow from p_period_start) <> 6 then
    -- Historical Monday-Sunday plans remain readable by exact identity, but
    -- cannot be created by the new write path.
    select * into v_plan
      from public.department_plans
     where department_id = p_department_id
       and period_type = p_period_type
       and period_start = p_period_start
       and period_end = p_period_end;
    if not found then
      raise exception 'invalid weekly department plan period' using errcode = '22023';
    end if;
    return v_plan;
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

notify pgrst, 'reload schema';
commit;
