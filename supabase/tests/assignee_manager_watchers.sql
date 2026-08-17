\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_admin uuid;
  v_department uuid;
  v_worker uuid;
  v_manager uuid;
  v_other_department uuid;
  v_collaborator uuid;
  v_other_manager uuid;
  v_missing_worker uuid;
  v_extra_watcher uuid;
  v_task uuid;
begin
  select u.id into v_admin
  from public.staff_users u join public.roles r on r.id=u.role_id
  where u.active=true and r.code='admin'
  order by u.created_at,u.id limit 1;

  select d.id,u.id,d.manager_id
  into v_department,v_worker,v_manager
  from public.departments d
  join public.staff_users u
    on u.department_id=d.id and u.active=true and u.id<>d.manager_id
  where d.active=true and d.manager_id is not null
  order by d.code,u.created_at,u.id limit 1;

  select d.id,u.id,d.manager_id
  into v_other_department,v_collaborator,v_other_manager
  from public.departments d
  join public.staff_users u
    on u.department_id=d.id and u.active=true and u.id<>d.manager_id
  where d.active=true and d.manager_id is not null and d.id<>v_department
  order by d.code,u.created_at,u.id limit 1;

  select u.id into v_missing_worker
  from public.staff_users u
  join public.departments d on d.id=u.department_id
  where u.active=true and d.active=true and d.manager_id is null
  order by d.code,u.created_at,u.id limit 1;

  select u.id into v_extra_watcher
  from public.staff_users u
  where u.active=true
    and u.id not in(v_admin,v_worker,v_manager,v_collaborator,v_other_manager)
  order by u.created_at,u.id limit 1;

  if v_admin is null or v_worker is null or v_manager is null
     or v_collaborator is null or v_other_manager is null
     or v_missing_worker is null or v_extra_watcher is null then
    raise exception 'assignee-manager watcher fixtures unavailable';
  end if;

  select id into v_task from public.api_assign_task(
    v_admin,'Cross department watcher test','Security invariant',
    v_department,v_worker,v_manager,date '2027-04-30',
    'Accuracy 60; timeliness 40',
    array[v_collaborator],
    array[v_other_manager,v_extra_watcher,v_extra_watcher],
    null,null
  );
  set constraints all immediate;

  if not exists(
       select 1 from public.task_assignees
       where task_id=v_task and user_id=v_manager and assignment_role='watcher'
     )
     or not exists(
       select 1 from public.task_assignees
       where task_id=v_task and user_id=v_other_manager and assignment_role='watcher'
     )
     or not exists(
       select 1 from public.task_assignees
       where task_id=v_task and user_id=v_extra_watcher and assignment_role='watcher'
     )
     or (select count(*) from public.task_assignees
         where task_id=v_task and user_id in(v_manager,v_other_manager,v_extra_watcher))<>3
     or not exists(
       select 1 from public.tasks
       where id=v_task and evaluation_criteria='Accuracy 60; timeliness 40'
     ) then
    raise exception 'manager/additional watcher or rubric invariant failed';
  end if;

  begin
    perform public.api_assign_task(
      v_admin,'Missing collaborator manager','Must fail',
      v_department,v_worker,v_manager,date '2027-05-01',null,
      array[v_missing_worker],array[]::uuid[],null,null
    );
    set constraints all immediate;
    raise exception 'collaborator without manager unexpectedly accepted';
  exception when invalid_parameter_value then null;
  end;
end
$test$;

do $test$
begin
  if has_function_privilege(
       'anon','public.enforce_assignee_manager_watcher()','execute'
     )
     or has_function_privilege(
       'authenticated','public.enforce_assignee_manager_watcher()','execute'
     )
     or has_function_privilege(
       'service_role','public.enforce_assignee_manager_watcher()','execute'
     ) then
    raise exception 'internal watcher trigger function exposed';
  end if;
end
$test$;

rollback;
