\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_admin uuid;
  v_worker uuid;
  v_manager uuid;
  v_extra_watcher uuid;
  v_department uuid;
  v_missing_department uuid;
  v_missing_worker uuid;
  v_task uuid;
  v_rule uuid;
begin
  select u.id into v_admin from public.staff_users u join public.roles r on r.id=u.role_id where u.active=true and r.code='admin' order by u.created_at,u.id limit 1;
  select d.id,d.manager_id,u.id into v_department,v_manager,v_worker
  from public.departments d join public.staff_users u on u.department_id=d.id and u.active=true and u.id<>d.manager_id
  where d.active=true and d.manager_id is not null order by d.code,u.created_at,u.id limit 1;
  select u.id into v_extra_watcher from public.staff_users u where u.active=true and u.id not in(v_admin,v_worker,v_manager) order by u.created_at,u.id limit 1;
  select d.id,u.id into v_missing_department,v_missing_worker from public.departments d join public.staff_users u on u.department_id=d.id and u.active=true where d.active=true and d.manager_id is null order by d.code,u.created_at,u.id limit 1;
  if v_admin is null or v_worker is null or v_manager is null or v_extra_watcher is null or v_missing_worker is null then raise exception 'phase6 actors unavailable'; end if;

  select id into v_task from public.api_assign_task(
    v_admin,'Phase 6 monthly test','Nội dung recurrence',v_department,v_worker,v_manager,
    date '2027-01-31','Tiêu chí dạng văn bản',array[]::uuid[],array[v_extra_watcher],
    'monthly',date '2027-03-31'
  );
  select recurrence_rule_id into v_rule from public.tasks where id=v_task;
  if v_rule is null
     or not exists(select 1 from public.task_assignees where task_id=v_task and user_id=v_manager and assignment_role='watcher')
     or (select count(*) from public.task_assignees where task_id=v_task and user_id=v_manager)<>1
     or not exists(select 1 from public.task_assignees where task_id=v_task and user_id=v_extra_watcher and assignment_role='watcher')
     or not exists(select 1 from public.tasks where id=v_task and task_type='assigned' and evaluation_criteria='Tiêu chí dạng văn bản')
     or not exists(select 1 from public.task_recurrence_occurrences where rule_id=v_rule and scheduled_for=date '2027-01-31' and task_id=v_task) then
    raise exception 'assignment/watcher/recurrence invariant';
  end if;

  if public.api_run_task_recurrence(date '2027-02-28')<>1 then raise exception 'monthly occurrence not created'; end if;
  if public.api_run_task_recurrence(date '2027-02-28')<>0 then raise exception 'recurrence retry created duplicate'; end if;
  if (select count(*) from public.task_recurrence_occurrences where rule_id=v_rule and scheduled_for=date '2027-02-28')<>1
     or not exists(select 1 from public.task_recurrence_rules where id=v_rule and next_scheduled_for=date '2027-03-31') then
    raise exception 'month-end recurrence invariant';
  end if;

  begin
    perform public.api_assign_task(v_admin,'Missing manager','Must fail',v_missing_department,v_missing_worker,v_manager,date '2027-02-01',null,array[]::uuid[],array[]::uuid[],null,null);
    raise exception 'assignment without manager unexpectedly accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.api_assign_task(v_worker,'Unauthorized','Must fail',v_department,v_worker,v_manager,date '2027-02-01',null,array[]::uuid[],array[]::uuid[],null,null);
    raise exception 'unauthorized assignment accepted';
  exception when insufficient_privilege then null; end;
  if not exists(select 1 from public.audit_logs where entity_id=v_task and action='create')
     or not exists(select 1 from public.audit_logs where entity_id=v_rule and action='create') then raise exception 'phase6 audit invariant'; end if;
end
$test$;

do $test$
begin
  if has_function_privilege('anon','public.api_assign_task(uuid,text,text,uuid,uuid,uuid,date,text,uuid[],uuid[],text,date)','execute')
     or has_function_privilege('authenticated','public.api_run_task_recurrence(date)','execute') then raise exception 'phase6 RPC exposed'; end if;
  if not has_function_privilege('service_role','public.api_assign_task(uuid,text,text,uuid,uuid,uuid,date,text,uuid[],uuid[],text,date)','execute')
     or not has_function_privilege('service_role','public.api_run_task_recurrence(date)','execute') then raise exception 'service role missing phase6 RPC'; end if;
end
$test$;
rollback;
