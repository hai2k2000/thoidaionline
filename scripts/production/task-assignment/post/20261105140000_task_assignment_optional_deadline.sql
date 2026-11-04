with expected(signature) as (values
 ('public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date,text)'),
 ('public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)'),
 ('public.api_register_journalism_task_v1(uuid,text,text,uuid,date,time,text,uuid,timestamptz,text,text)'),
 ('public.api_change_assigned_task_deadline(uuid,uuid,date,text)'),
 ('public.api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text)')
)
select case when not exists (
 select 1 from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature)
 where p.oid is null or not p.prosecdef
 or p.proowner<>(select oid from pg_roles where rolname='postgres')
 or not exists(select 1 from unnest(p.proconfig) c where replace(c,' ','')='search_path=public,pg_temp')
 or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE')
 or has_function_privilege('anon',p.oid,'EXECUTE')
 or has_function_privilege('authenticated',p.oid,'EXECUTE')
 or not has_function_privilege('service_role',p.oid,'EXECUTE')
)
then 'pass' else 'fail' end;
