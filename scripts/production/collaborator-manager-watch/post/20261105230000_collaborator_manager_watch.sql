select case when exists (
  select 1 from pg_proc
  where oid = to_regprocedure('public.enforce_assignee_manager_watcher()')
    and prosecdef and proowner = 'postgres'::regrole
    and proconfig @> array['search_path=public, pg_temp']
) and not has_function_privilege('anon','public.enforce_assignee_manager_watcher()','execute')
and not has_function_privilege('authenticated','public.enforce_assignee_manager_watcher()','execute')
and has_function_privilege('service_role','public.enforce_assignee_manager_watcher()','execute')
and exists(select 1 from pg_trigger where tgname='trg_assignee_manager_watcher'
  and tgrelid='public.task_assignees'::regclass and tgfoid='public.enforce_assignee_manager_watcher()'::regprocedure
  and tgdeferrable and tginitdeferred and tgenabled='O')
and position('if new.assignment_role=''assignee'' then return new' in pg_get_functiondef('public.enforce_assignee_manager_watcher()'::regprocedure))>0
then 'pass' else 'fail' end;
