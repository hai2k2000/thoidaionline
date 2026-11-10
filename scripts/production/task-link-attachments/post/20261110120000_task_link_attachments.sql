-- Read-only post-migration assertion, consumed by the deployment rehearsal.
select case when to_regclass('public.task_links') is not null
 and exists(select 1 from pg_class where oid='public.task_links'::regclass and relrowsecurity)
 and not has_table_privilege('anon','public.task_links','SELECT')
 and not has_table_privilege('authenticated','public.task_links','INSERT')
 and has_table_privilege('service_role','public.task_links','INSERT')
 and not has_function_privilege('anon','public.api_add_task_link(uuid,uuid,text,text)','EXECUTE')
 and not has_function_privilege('authenticated','public.api_delete_task_link(uuid,uuid,uuid)','EXECUTE')
 and has_function_privilege('service_role','public.api_add_task_link(uuid,uuid,text,text)','EXECUTE')
 and has_function_privilege('service_role','public.api_delete_task_link(uuid,uuid,uuid)','EXECUTE')
 and exists(select 1 from pg_trigger where tgrelid='public.task_links'::regclass and tgname='file_project_task_link' and not tgisinternal)
 and position('delete from public.task_links' in pg_get_functiondef('public.api_delete_cancelled_project_tasks(uuid,uuid,uuid[])'::regprocedure))>0
 then 'pass' else 'fail' end;