begin;

create or replace function public.api_assert_journalism_department_scope(
  p_actor_id uuid,
  p_department_id uuid default null
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_role_code text;
  v_actor_department_code text;
  v_target_department_code text;
begin
  select r.code, d.code
    into v_role_code, v_actor_department_code
  from public.staff_users u
  join public.roles r on r.id = u.role_id and r.active = true
  left join public.departments d on d.id = u.department_id and d.active = true
  where u.id = p_actor_id and u.active = true;

  if v_role_code is null then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;
  if v_role_code not in ('admin', 'tong_bien_tap', 'pho_tong_bien_tap')
     and v_actor_department_code is distinct from 'editorial' then
    raise exception 'Journalism is limited to Content department.' using errcode = '42501';
  end if;

  if p_department_id is not null then
    select d.code into v_target_department_code
    from public.departments d
    where d.id = p_department_id and d.active = true;
    if v_target_department_code is distinct from 'editorial' then
      raise exception 'Journalism target must be Content department.' using errcode = '42501';
    end if;
  end if;
end
$function$;

create or replace function public.api_assert_journalism_access(
  p_actor_id uuid, p_task_id uuid, p_permission text
) returns void
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_actor_id uuid;
  v_actor_role_id uuid;
  v_actor_department_id uuid;
  v_role text;
  v_task public.tasks;
  v_department uuid;
  v_allowed boolean := false;
begin
  select u.id,u.role_id,u.department_id into v_actor_id,v_actor_role_id,v_actor_department_id from public.staff_users u
    join public.roles r on r.id=u.role_id
    where u.id=p_actor_id and u.active=true and r.active=true;
  select r.code into v_role from public.roles r where r.id=v_actor_role_id and r.active=true;
  if v_actor_id is null then raise exception 'Invalid actor.' using errcode='42501'; end if;
  select * into v_task from public.tasks where id=p_task_id;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  perform public.api_assert_journalism_department_scope(p_actor_id, v_task.department_id);
  if not exists(select 1 from public.journalism_task_details where task_id=p_task_id) then
    raise exception 'Task not found.' using errcode='P0002';
  end if;
  if not exists(select 1 from public.role_permission_grants g join public.permissions p on p.id=g.permission_id
    where g.role_id=v_actor_role_id and p.code=p_permission) then
    raise exception 'Journalism permission required.' using errcode='42501';
  end if;
  v_allowed := v_role in ('admin','tong_bien_tap','pho_tong_bien_tap')
    or v_task.created_by=p_actor_id or v_task.owner_id=p_actor_id
    or v_task.assignee_id=p_actor_id or v_task.reviewer_id=p_actor_id
    or exists(select 1 from public.task_assignees ta where ta.task_id=p_task_id and ta.user_id=p_actor_id)
    or (coalesce((select rp.can_view_department_tasks from public.role_permissions rp where rp.role_id=v_actor_role_id),false)
      and v_actor_department_id=v_task.department_id);
  if not v_allowed then raise exception 'Task action forbidden.' using errcode='42501'; end if;
  select d.id into v_department from public.departments d where d.id=v_task.department_id;
  if not exists(select 1 from public.role_permission_grants g join public.permissions p on p.id=g.permission_id
    where g.role_id=v_actor_role_id and p.code=p_permission and (g.scope='all'
      or (g.scope='department' and v_actor_department_id=v_department)
      or (g.scope='self' and (v_task.created_by=p_actor_id or v_task.owner_id=p_actor_id))
      or (g.scope='assigned' and (v_task.owner_id=p_actor_id or v_task.assignee_id=p_actor_id or v_task.reviewer_id=p_actor_id
        or exists(select 1 from public.task_assignees ta where ta.task_id=p_task_id and ta.user_id=p_actor_id))))) then
    raise exception 'Journalism permission scope forbidden.' using errcode='42501';
  end if;
end
$function$;

create or replace function public.api_assert_journalism_structure_scope(
  p_actor_id uuid,
  p_permission text,
  p_department_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor_department_id uuid;
  v_role_id uuid;
begin
  perform public.api_assert_journalism_department_scope(p_actor_id, p_department_id);
  select u.department_id, u.role_id
    into v_actor_department_id, v_role_id
  from public.staff_users u
  join public.roles r on r.id = u.role_id and r.active = true
  where u.id = p_actor_id and u.active = true;
  if v_role_id is null then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.role_permission_grants g
    join public.permissions p on p.id = g.permission_id
    where g.role_id = v_role_id and p.code = p_permission
      and (g.scope = 'all' or (g.scope = 'department' and p_department_id is not null and p_department_id = v_actor_department_id))
  ) then
    raise exception 'Journalism structure permission required.' using errcode = '42501';
  end if;
end
$function$;

do $block$
begin
  if to_regprocedure('public.api_assign_journalism_task_v1_unscoped(uuid,text,text,uuid,uuid,uuid,date,time without time zone,text,text,uuid[],uuid[],uuid,timestamp with time zone,text,text)') is null then
    alter function public.api_assign_journalism_task_v1(uuid,text,text,uuid,uuid,uuid,date,time without time zone,text,text,uuid[],uuid[],uuid,timestamp with time zone,text,text)
      rename to api_assign_journalism_task_v1_unscoped;
  end if;
end
$block$;

create or replace function public.api_assign_journalism_task_v1(
  p_actor_id uuid,p_title text,p_description text,p_department_id uuid,
  p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,p_due_time time,
  p_evaluation_criteria text,p_priority text,p_collaborator_ids uuid[],p_watcher_ids uuid[],
  p_work_kind_id uuid,p_planned_publication_at timestamptz,p_location text,p_editorial_notes text
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  perform public.api_assert_journalism_department_scope(p_actor_id, p_department_id);
  return public.api_assign_journalism_task_v1_unscoped(
    p_actor_id,p_title,p_description,p_department_id,p_assignee_id,p_reviewer_id,p_due_date,p_due_time,
    p_evaluation_criteria,p_priority,p_collaborator_ids,p_watcher_ids,p_work_kind_id,p_planned_publication_at,p_location,p_editorial_notes
  );
end
$function$;

revoke all on function public.api_assert_journalism_department_scope(uuid,uuid) from public, anon, authenticated;
grant execute on function public.api_assert_journalism_department_scope(uuid,uuid) to service_role;
revoke all on function public.api_assign_journalism_task_v1_unscoped(uuid,text,text,uuid,uuid,uuid,date,time without time zone,text,text,uuid[],uuid[],uuid,timestamp with time zone,text,text) from public, anon, authenticated, service_role;
revoke all on function public.api_assign_journalism_task_v1(uuid,text,text,uuid,uuid,uuid,date,time without time zone,text,text,uuid[],uuid[],uuid,timestamp with time zone,text,text) from public, anon, authenticated;
grant execute on function public.api_assign_journalism_task_v1(uuid,text,text,uuid,uuid,uuid,date,time without time zone,text,text,uuid[],uuid[],uuid,timestamp with time zone,text,text) to service_role;

commit;
