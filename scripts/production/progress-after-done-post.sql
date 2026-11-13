-- safe-apply executes this SQL with psql -At; success is exactly pass.
select case when exists (
  select 1 from pg_proc p where p.oid='public.api_submit_task_progress_report(uuid,uuid,date,text,text,text)'::regprocedure
    and p.prosecdef and pg_get_userbyid(p.proowner)='postgres'
    and p.proconfig @> array['search_path=public, pg_temp']
    and strpos(p.prosrc, $$v_before.status='cancelled'$$)>0
    and strpos(p.prosrc, $$case when v_before.status in ('pending_review','done') then v_before.status$$)>0
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('authenticated',p.oid,'EXECUTE')
    and has_function_privilege('service_role',p.oid,'EXECUTE')
    and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')
) and not exists (
  select 1 from pg_policies where schemaname='public' and tablename='task_progress_reports'
    and roles && array['anon','authenticated','public']::name[]
) then 'pass' else 'fail' end;
