\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_tbt record;
  v_read_only record;
  v_bad_managers integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_assign_task' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_assign_task'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_view_department_tasks' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_view_department_tasks'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_evaluate_step1' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_evaluate_step1'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_evaluate_step2' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_evaluate_step2'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_manage_rubrics' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_manage_rubrics'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='departments'
      and column_name='manager_id' and data_type='uuid'
  ) then raise exception 'missing departments.manager_id'; end if;

  if exists (
    select 1 from public.roles r
    left join public.role_permissions rp on rp.role_id=r.id
    where rp.role_id is null
  ) then raise exception 'role without permission row'; end if;

  select rp.* into v_tbt
  from public.roles r join public.role_permissions rp on rp.role_id=r.id
  where r.code='tong_bien_tap';
  if not v_tbt.can_comment
     or v_tbt.can_assign_task or v_tbt.can_view_department_tasks
     or v_tbt.can_evaluate_step1 or not v_tbt.can_evaluate_step2
     or v_tbt.can_manage_rubrics then
    raise exception 'TBT must be global-view/comment plus step2-only';
  end if;

  select rp.* into v_read_only
  from public.roles r join public.role_permissions rp on rp.role_id=r.id
  where r.code='tbt_read_only';
  if v_read_only.can_comment
     or v_read_only.can_assign_task or v_read_only.can_view_department_tasks
     or v_read_only.can_evaluate_step1 or v_read_only.can_evaluate_step2
     or v_read_only.can_manage_rubrics then
    raise exception 'tbt_read_only must remain compatibility read-only';
  end if;

  select count(*) into v_bad_managers
  from public.departments d
  join public.staff_users u on u.id=d.manager_id
  where u.department_id<>d.id or not u.active;
  if v_bad_managers<>0 then raise exception 'invalid primary manager'; end if;

  if not has_table_privilege('anon','public.tasks','SELECT') then
    raise exception 'Phase 1 must preserve anon compatibility';
  end if;
end
$test$;


do $test$
declare
  v_functions text[] := array[
    'public.api_create_task(uuid,text,text,uuid,uuid,uuid,text,date,uuid[])',
    'public.api_update_task(uuid,uuid,text,date,boolean)',
    'public.api_claim_task_plan(uuid,uuid)',
    'public.api_report_task_progress(uuid,uuid,integer,text,text)',
    'public.api_review_task_completion(uuid,uuid,text,text)',
    'public.api_save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)',
    'public.api_add_task_comment(uuid,uuid,text)',
    'public.api_create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid)'
  ];
  v_return_types regtype[] := array[
    'public.tasks'::regtype,
    'public.tasks'::regtype,
    'public.tasks'::regtype,
    'public.tasks'::regtype,
    'public.tasks'::regtype,
    'public.task_evaluation_checkpoints'::regtype,
    'public.task_comments'::regtype,
    'public.tasks'::regtype
  ];
  v_return_sets boolean[] := array[false,false,false,false,false,false,false,true];
  v_signature text;
  v_index integer;
  v_oid regprocedure;
  v_return_type oid;
  v_return_set boolean;
begin
  for v_index in 1..cardinality(v_functions) loop
    v_signature := v_functions[v_index];
    v_oid := to_regprocedure(v_signature);
    if v_oid is null then
      raise exception 'missing wrapper %', v_signature;
    end if;
    select p.prorettype,p.proretset
    into v_return_type,v_return_set
    from pg_proc p where p.oid=v_oid;
    if v_return_type<>v_return_types[v_index]::oid
       or v_return_set<>v_return_sets[v_index] then
      raise exception 'wrapper return mismatch %', v_signature;
    end if;
    if has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('authenticated',v_oid,'EXECUTE')
       or exists (
         select 1
         from pg_proc p
         cross join lateral aclexplode(
           coalesce(p.proacl,acldefault('f',p.proowner))
         ) acl
          where p.oid=v_oid
           and acl.grantee=0
           and acl.privilege_type='EXECUTE'
       ) then
      raise exception 'non-service role can execute %', v_signature;
    end if;
    if not has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'service_role cannot execute %', v_signature;
    end if;
  end loop;
end
$test$;

do $test$
declare
  v_task public.tasks;
begin
  perform public.api_add_task_comment(
    '30000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    'synthetic global TBT comment'
  );

  begin
    perform public.api_add_task_comment(
      '30000000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000001',
      'must be denied'
    );
    raise exception 'tbt_read_only unexpectedly commented';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.api_save_task_evaluation_checkpoint(
      '30000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000007',
      8,3,'done',true,'must be denied',current_date,true
    );
    raise exception 'TBT unexpectedly used legacy evaluation';
  exception when insufficient_privilege then null;
  end;

  v_task := public.api_report_task_progress(
    '30000000-0000-4000-8000-000000000007',
    '40000000-0000-4000-8000-000000000001',
    50,'synthetic report',null
  );
  if v_task.progress_percent<>50 then
    raise exception 'assigned reporter update failed';
  end if;

  perform public.api_add_task_comment(
    '30000000-0000-4000-8000-000000000007',
    '40000000-0000-4000-8000-000000000001',
    'synthetic comment'
  );
end
$test$;

rollback;
