with target as (
 select * from pg_proc where oid=to_regprocedure('public.api_delete_cancelled_project_tasks(uuid,uuid,uuid[])')
)
select case when
 (select count(*) from target)=1
 and exists(select 1 from target where prosecdef and proowner='postgres'::regrole and prorettype='jsonb'::regtype and proconfig @> array['search_path=public, pg_temp'])
 and not has_function_privilege('anon','public.api_delete_cancelled_project_tasks(uuid,uuid,uuid[])','EXECUTE')
 and not has_function_privilege('authenticated','public.api_delete_cancelled_project_tasks(uuid,uuid,uuid[])','EXECUTE')
 and has_function_privilege('service_role','public.api_delete_cancelled_project_tasks(uuid,uuid,uuid[])','EXECUTE')
 and not exists(select 1 from target p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.privilege_type='EXECUTE' and a.grantee not in ('postgres'::regrole,'service_role'::regrole))
 and to_regprocedure('public.project_task_delete_detach_allowed(public.department_plan_items,public.department_plan_items)') is not null
 then 'pass' else 'fail' end;
