begin;

create or replace function public.enforce_assignee_manager_watcher()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_task_type text;
  v_task_category text;
  v_department uuid;
  v_manager uuid;
begin
  select task_type,task_category into v_task_type,v_task_category
  from public.tasks where id=new.task_id;

  if v_task_category='duty' or v_task_type is distinct from 'assigned'
     or new.assignment_role not in ('owner','assignee') then
    return new;
  end if;

  select u.department_id into v_department
  from public.staff_users u where u.id=new.user_id and u.active=true;
  if v_department is null then
    raise exception 'Assigned participant requires an active department.' using errcode='22023';
  end if;

  select d.manager_id into v_manager
  from public.departments d
  join public.staff_users manager on manager.id=d.manager_id and manager.active=true
  where d.id=v_department and d.active=true;
  if v_manager is null then
    raise exception 'Assignee department requires an active primary manager.' using errcode='22023';
  end if;

  if v_manager<>new.user_id then
    insert into public.task_assignees(task_id,user_id,assignment_role,status)
    values(new.task_id,v_manager,'watcher','todo') on conflict(task_id,user_id) do nothing;
  end if;
  return new;
end
$function$;

alter function public.enforce_assignee_manager_watcher() owner to postgres;
commit;
