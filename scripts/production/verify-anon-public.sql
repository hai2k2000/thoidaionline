select 'TABLE_LEAK' as check, count(*) as value
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p','v','m','f','S')
  and (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))
union all select 'FUNCTION_LEAK',count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))
union all select 'POLICY_LEAK',count(*) from pg_policies where schemaname='public' and ('anon'=any(roles) or 'authenticated'=any(roles) or 'public'=any(roles))
union all select 'DEFAULT_ACL_LEAK',count(*) from pg_default_acl a join pg_namespace n on n.oid=a.defaclnamespace, aclexplode(a.defaclacl) x where n.nspname='public' and pg_get_userbyid(a.defaclrole)='postgres' and x.grantee in ('anon'::regrole,'authenticated'::regrole)
union all select 'SERVICE_ROLE_MISSING_SELECT',count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m') and not has_table_privilege('service_role',c.oid,'SELECT')
union all select 'SERVICE_ROLE_MISSING_DML_ON_EXPOSED',count(*) from unnest(array['work_schedules','task_completion_scores','task_quick_report_idempotency','db_record_code_counters','employee_profiles','official_documents','document_assignments','password_reset_tokens','password_reset_attempts']) t(name) where not has_table_privilege('service_role',format('public.%I',t.name)::regclass,'SELECT,INSERT,UPDATE,DELETE')
union all select 'SERVICE_ROLE_RPC_EXECUTE_COUNT',count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'api\_%' and has_function_privilege('service_role',p.oid,'EXECUTE')
union all select 'RLS_OFF_COUNT',count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
order by 1;
