\set ON_ERROR_STOP on
begin;

do $test$
declare v_table text; v_proc regprocedure;
begin
  foreach v_table in array array[
    'tasks','task_assignees','task_comments','task_progress_logs','task_progress_reports',
    'task_attachments','task_deadline_history','task_status_events','task_recurrence_rules',
    'task_recurrence_occurrences','task_evaluation_checkpoints','staff_users','departments',
    'roles','role_permissions','job_titles','evaluation_rubric_versions','evaluation_rubric_factors',
    'performance_cycles','performance_reviews','performance_review_scores','performance_criteria','audit_logs'
  ] loop
    if has_table_privilege('anon',format('public.%I',v_table),'select')
       or has_table_privilege('anon',format('public.%I',v_table),'insert')
       or has_table_privilege('authenticated',format('public.%I',v_table),'update')
       or has_table_privilege('authenticated',format('public.%I',v_table),'delete') then
      raise exception 'browser table privilege remains on %',v_table;
    end if;
    if not has_table_privilege('service_role',format('public.%I',v_table),'select') then
      raise exception 'service role missing select on %',v_table;
    end if;
    if exists(select 1 from pg_policies where schemaname='public' and tablename=v_table and ('anon'=any(roles) or 'authenticated'=any(roles) or 'public'=any(roles))) then
      raise exception 'browser policy remains on %',v_table;
    end if;
  end loop;

  for v_proc in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'api_%' loop
    if has_function_privilege('anon',v_proc,'execute') or has_function_privilege('authenticated',v_proc,'execute') then raise exception 'browser RPC execute remains on %',v_proc; end if;
    if not has_function_privilege('service_role',v_proc,'execute') then raise exception 'service role missing RPC execute on %',v_proc; end if;
  end loop;
end
$test$;

do $test$
declare v_actor uuid; v_task uuid; v_employee uuid;
begin
  select id into v_actor from public.staff_users where active order by created_at,id limit 1;
  select id,coalesce(assignee_id,owner_id,created_by) into v_task,v_employee from public.tasks order by created_at,id limit 1;
  begin
    perform public.api_save_task_evaluation_checkpoint(v_actor,v_task,v_employee,8,1,'done',true,null,current_date,true);
    raise exception 'legacy 1-10 write accepted';
  exception when feature_not_supported then null; end;
  begin
    perform public.api_report_task_progress(v_actor,v_task,50,'legacy percent');
    raise exception 'legacy percent write accepted';
  exception when feature_not_supported then null; end;
end
$test$;
rollback;
