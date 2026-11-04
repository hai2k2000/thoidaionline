select case when exists (
 select 1 from pg_proc p
 where p.oid=to_regprocedure('public.api_reopen_project(uuid,uuid)')
 and p.prosecdef and p.prorettype='public.projects'::regtype
 and 'search_path=public, pg_temp'=any(p.proconfig)
 and p.proowner=(select oid from pg_roles where rolname='postgres')
 and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE')
 and not has_function_privilege('anon',p.oid,'EXECUTE')
 and not has_function_privilege('authenticated',p.oid,'EXECUTE')
 and has_function_privilege('service_role',p.oid,'EXECUTE')
) then 'pass' else 'fail' end;
