with f as (
  select p.oid,p.proname,p.prosecdef,p.proowner,p.proconfig,p.proacl,p.proargnames
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.oid in (
    to_regprocedure('public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text,timestamptz,boolean)'),
    to_regprocedure('public.api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text,timestamptz,boolean)'),
    to_regprocedure('public.api_admin_set_task_participants(uuid,uuid,uuid,uuid[],uuid[],uuid,text,timestamptz)')
  )
)
select case when count(*)=3
  and bool_and(prosecdef and proowner='postgres'::regrole and proconfig @> array['search_path=public, pg_temp'])
  and not has_function_privilege('anon','public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text,timestamptz,boolean)','EXECUTE')
  and not has_function_privilege('authenticated','public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text,timestamptz,boolean)','EXECUTE')
  and has_function_privilege('service_role','public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text,timestamptz,boolean)','EXECUTE')
  and not has_function_privilege('service_role','public.api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text,timestamptz,boolean)','EXECUTE')
  and not exists(select 1 from f, lateral aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a where a.privilege_type='EXECUTE' and a.grantee not in ('postgres'::regrole,'service_role'::regrole))
  then 'pass' else 'fail' end
from f;
