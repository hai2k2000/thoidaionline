\set ON_ERROR_STOP on
begin;
do $test$
declare v_admin uuid; v_department uuid; v_candidate uuid; v_other uuid; v_old uuid;
begin
  select u.id into v_admin from public.staff_users u join public.roles r on r.id=u.role_id where u.active and r.code='admin' order by u.created_at,u.id limit 1;
  select d.id,u.id,d.manager_id into v_department,v_candidate,v_old from public.departments d join public.staff_users u on u.department_id=d.id and u.active where d.active and d.manager_id is null order by d.code,u.created_at,u.id limit 1;
  select u.id into v_other from public.staff_users u where u.active and u.department_id<>v_department order by u.created_at,u.id limit 1;
  if v_admin is null or v_department is null or v_candidate is null or v_other is null then raise exception 'manager prerequisite fixtures unavailable'; end if;
  perform public.api_set_department_manager(v_admin,v_department,v_candidate);
  if not exists(select 1 from public.departments where id=v_department and manager_id=v_candidate) then raise exception 'manager not assigned'; end if;
  if not exists(select 1 from public.audit_logs where entity_id=v_department and action='set_manager') then raise exception 'manager audit missing'; end if;
  begin perform public.api_set_department_manager(v_candidate,v_department,v_candidate); raise exception 'non-admin accepted'; exception when insufficient_privilege then null; end;
  begin perform public.api_set_department_manager(v_admin,v_department,v_other); raise exception 'cross-department manager accepted'; exception when invalid_parameter_value then null; end;
end
$test$;
do $test$
begin
  if has_function_privilege('anon','public.api_set_department_manager(uuid,uuid,uuid)','execute') or has_function_privilege('authenticated','public.api_set_department_manager(uuid,uuid,uuid)','execute') then raise exception 'manager RPC exposed'; end if;
  if not has_function_privilege('service_role','public.api_set_department_manager(uuid,uuid,uuid)','execute') then raise exception 'service role missing manager RPC'; end if;
end
$test$;
rollback;
