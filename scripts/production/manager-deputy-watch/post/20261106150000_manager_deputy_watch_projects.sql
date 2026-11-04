select case when
 exists(select 1 from pg_proc where oid=to_regprocedure('public.department_watch_leaders(uuid)') and prosecdef and proconfig @> array['search_path=public, pg_temp'])
 and not has_function_privilege('anon','public.department_watch_leaders(uuid)','execute')
 and not has_function_privilege('authenticated','public.department_watch_leaders(uuid)','execute')
 and has_function_privilege('service_role','public.department_watch_leaders(uuid)','execute')
 and not has_function_privilege('anon','public.enforce_assignee_manager_watcher()','execute')
 and not has_function_privilege('authenticated','public.enforce_assignee_manager_watcher()','execute')
 and has_function_privilege('service_role','public.enforce_assignee_manager_watcher()','execute')
 and exists(select 1 from pg_trigger where tgrelid='public.task_assignees'::regclass and tgfoid='public.enforce_assignee_manager_watcher()'::regprocedure and not tgisinternal and tgenabled<>'D')
 and position('department_watch_leaders(v_department)' in pg_get_functiondef('public.enforce_assignee_manager_watcher()'::regprocedure))>0
 then 'pass' else 'fail' end;
