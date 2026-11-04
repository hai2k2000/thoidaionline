with expected(signature) as (values
 ('public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date,text,uuid)'),
 ('public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb,uuid)'),
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
and to_regprocedure('public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date,text)') is null
and to_regprocedure('public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)') is null
and exists (
 select 1 from pg_attribute a join pg_constraint c on c.conrelid=a.attrelid
 join pg_attribute ref on ref.attrelid=c.confrelid and ref.attname='id'
 where a.attrelid='public.tasks'::regclass and a.attname='entered_by'
 and not a.attisdropped and a.atttypid='uuid'::regtype
 and c.contype='f' and c.convalidated and c.conkey=array[a.attnum]
 and c.confrelid='public.staff_users'::regclass and c.confkey=array[ref.attnum]
)
then 'pass' else 'fail' end;
