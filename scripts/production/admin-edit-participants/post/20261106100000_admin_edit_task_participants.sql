with target as (
 select * from pg_proc where oid=to_regprocedure('public.api_admin_set_task_participants(uuid,uuid,uuid,uuid[],uuid[],uuid,text)')
)
select case when
 (select count(*) from target)=1
 and exists(select 1 from target where prosecdef and proowner='postgres'::regrole and prorettype='public.tasks'::regtype and proconfig @> array['search_path=public, pg_temp'])
 and not has_function_privilege('anon','public.api_admin_set_task_participants(uuid,uuid,uuid,uuid[],uuid[],uuid,text)','EXECUTE')
 and not has_function_privilege('authenticated','public.api_admin_set_task_participants(uuid,uuid,uuid,uuid[],uuid[],uuid,text)','EXECUTE')
 and has_function_privilege('service_role','public.api_admin_set_task_participants(uuid,uuid,uuid,uuid[],uuid[],uuid,text)','EXECUTE')
 and not exists(select 1 from target p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.privilege_type='EXECUTE' and a.grantee not in ('postgres'::regrole,'service_role'::regrole))
 and not has_function_privilege('service_role','public.api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text)','EXECUTE')
 and to_regprocedure('public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text)') is not null
 then 'pass' else 'fail' end;
