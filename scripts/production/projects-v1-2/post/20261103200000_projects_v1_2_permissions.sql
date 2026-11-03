select case when
 public.rbac_v2_scope_supported('project.create','all') and not public.rbac_v2_scope_supported('project.create','department') and
 to_regclass('public.project_library_folders') is not null and to_regclass('public.project_library_items') is not null
 and (select count(*) from pg_class where oid in ('public.project_library_folders'::regclass,'public.project_library_items'::regclass) and relrowsecurity)=2
 and not exists(select 1 from pg_policies where schemaname='public' and tablename in ('project_library_folders','project_library_items'))
 and not has_table_privilege('anon','public.project_library_items','SELECT,INSERT,UPDATE,DELETE')
 and not has_table_privilege('authenticated','public.project_library_folders','SELECT,INSERT,UPDATE,DELETE')
 and exists(select 1 from pg_constraint where conrelid='public.project_members'::regclass and conname='project_members_role_check' and pg_get_constraintdef(oid) like '%deputy%')
 and exists(select 1 from pg_trigger where tgrelid='public.tasks'::regclass and tgname='validate_task_report_recipient' and tgfoid='public.validate_task_report_recipient()'::regprocedure and tgenabled<>'D' and not tgisinternal)
 and pg_get_functiondef('public.validate_task_report_recipient()'::regprocedure) like '%api_project_is_lead(new.reviewer_id,new.project_id)%'
 and pg_get_functiondef('public.api_approve_task_claim(uuid,uuid,text,text)'::regprocedure) like '%api_project_is_lead(p_actor_id,v.project_id)%'
 and pg_get_functiondef('public.api_review_assigned_task_completion(uuid,uuid,text,text)'::regprocedure) like '%api_project_is_lead(p_actor_id,v_before.project_id)%'
 and pg_get_functiondef('public.require_task_score_before_done()'::regprocedure) like '%new.project_id is null%'
 and pg_get_functiondef('public.api_score_task_completion(uuid,uuid,jsonb,numeric,numeric,numeric,text)'::regprocedure) like '%Project tasks cannot be scored%'
 and pg_get_functiondef('public.api_get_personnel_evaluation_detail(uuid,uuid,date,date)'::regprocedure) like '%task.project_id is null%'
 and (select count(*) from pg_trigger where tgname in ('guard_project_task_score_row','guard_project_task_evaluation_row') and not tgisinternal and tgenabled='O')=3
 and to_regprocedure('public.api_project_can_assign(uuid,uuid)') is not null
 and to_regprocedure('public.api_list_project_library(uuid,uuid,uuid)') is not null
 and to_regprocedure('public.api_mutate_project_library_folder(uuid,uuid,uuid,text,text,uuid)') is not null
 and to_regprocedure('public.api_mutate_project_library_item(uuid,uuid,uuid,text,text,uuid)') is not null
 and exists(select 1 from pg_trigger where tgname='file_project_task_attachment' and not tgisinternal)
 and not exists(select 1 from public.projects p where not exists(select 1 from public.project_library_folders f where f.project_id=p.id and f.system_key='task_files' and f.deleted_at is null))
 and not exists(select 1 from public.task_attachments a join public.tasks t on t.id=a.task_id where t.project_id is not null and not exists(select 1 from public.project_library_items i where i.source_attachment_id=a.id))
 and not exists(
  select 1 from (values
   ('public.rbac_v2_scope_supported(text,text)'),
   ('public.api_transfer_project_lead(uuid,uuid,uuid,text)'),
   ('public.api_set_user_permission_override(uuid,uuid,text,text,text)'),
   ('public.api_list_user_approval_permissions(uuid,uuid)'),
   ('public.require_task_score_before_done()'),
   ('public.guard_project_task_score_row()'),
   ('public.guard_project_task_evaluation_row()'),
   ('public.api_score_task_completion(uuid,uuid,jsonb,numeric,numeric,numeric,text)'),
   ('public.api_get_personnel_evaluation_detail(uuid,uuid,date,date)'),
   ('public.validate_task_report_recipient()'),
   ('public.api_approve_task_claim(uuid,uuid,text,text)'),
   ('public.api_review_assigned_task_completion(uuid,uuid,text,text)'),
   ('public.enforce_assignee_manager_watcher()'),
   ('public.review_task_completion(uuid,uuid,text,text)'),
   ('public.api_project_actor_can_create(uuid)'),
   ('public.api_project_is_lead(uuid,uuid)'),
   ('public.api_assert_task_action(uuid,uuid,text)'),
   ('public.api_create_project(uuid,text,text,text,uuid,uuid[])'),
   ('public.api_update_project(uuid,uuid,text,text,text,uuid)'),
   ('public.api_set_project_member(uuid,uuid,uuid,text,boolean)'),
   ('public.api_close_project(uuid,uuid)'),
   ('public.api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text)'),
   ('public.api_project_can_assign(uuid,uuid)'),
   ('public.guard_project_lead_role()'),
   ('public.guard_project_staff_role()'),
   ('public.api_assert_project_library(uuid,uuid,boolean)'),
   ('public.ensure_project_task_folder(uuid,uuid)'),
   ('public.create_project_task_folder()'),
   ('public.api_list_project_library(uuid,uuid,uuid)'),
   ('public.api_create_project_library_folder(uuid,uuid,text,uuid)'),
   ('public.api_mutate_project_library_folder(uuid,uuid,uuid,text,text,uuid)'),
   ('public.api_add_project_library_item(uuid,uuid,uuid,text,text,text,text,text,text,text,bigint)'),
   ('public.api_mutate_project_library_item(uuid,uuid,uuid,text,text,uuid)'),
   ('public.api_get_project_library_file(uuid,uuid,uuid)'),
   ('public.file_project_task_attachment()')
  ) expected(signature)
  left join pg_proc p on p.oid=to_regprocedure(expected.signature)
  where p.oid is null or (expected.signature not in ('public.rbac_v2_scope_supported(text,text)','public.validate_task_report_recipient()') and not p.prosecdef)
   or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE')
   or has_function_privilege('anon',p.oid,'EXECUTE')
   or has_function_privilege('authenticated',p.oid,'EXECUTE')
   or not has_function_privilege('service_role',p.oid,'EXECUTE')
 )
 then 'pass' else 'fail' end;
