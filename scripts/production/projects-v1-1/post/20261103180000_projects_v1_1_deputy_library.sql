select case when
 to_regclass('public.project_library_folders') is not null and to_regclass('public.project_library_items') is not null
 and (select count(*) from pg_class where oid in ('public.project_library_folders'::regclass,'public.project_library_items'::regclass) and relrowsecurity)=2
 and not exists(select 1 from pg_policies where schemaname='public' and tablename in ('project_library_folders','project_library_items'))
 and not has_table_privilege('anon','public.project_library_items','SELECT,INSERT,UPDATE,DELETE')
 and not has_table_privilege('authenticated','public.project_library_folders','SELECT,INSERT,UPDATE,DELETE')
 and exists(select 1 from pg_constraint where conrelid='public.project_members'::regclass and conname='project_members_role_check' and pg_get_constraintdef(oid) like '%deputy%')
 and to_regprocedure('public.api_project_can_assign(uuid,uuid)') is not null
 and to_regprocedure('public.api_list_project_library(uuid,uuid,uuid)') is not null
 and to_regprocedure('public.api_mutate_project_library_folder(uuid,uuid,uuid,text,text,uuid)') is not null
 and to_regprocedure('public.api_mutate_project_library_item(uuid,uuid,uuid,text,text,uuid)') is not null
 and exists(select 1 from pg_trigger where tgname='file_project_task_attachment' and not tgisinternal)
 and not exists(select 1 from public.projects p where not exists(select 1 from public.project_library_folders f where f.project_id=p.id and f.system_key='task_files' and f.deleted_at is null))
 and not exists(select 1 from public.task_attachments a join public.tasks t on t.id=a.task_id where t.project_id is not null and not exists(select 1 from public.project_library_items i where i.source_attachment_id=a.id))
 and not exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('api_project_can_assign','api_assert_project_library','api_list_project_library','api_create_project_library_folder','api_mutate_project_library_folder','api_add_project_library_item','api_mutate_project_library_item','api_get_project_library_file','file_project_task_attachment','ensure_project_task_folder','guard_project_lead_role','guard_project_staff_role') and (not p.prosecdef or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or not has_function_privilege('service_role',p.oid,'EXECUTE')))
 then 'pass' else 'fail' end;
