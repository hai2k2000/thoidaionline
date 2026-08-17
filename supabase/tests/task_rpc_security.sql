begin;

do $$
declare
  v_functions regprocedure[] := array[
    'public.claim_task_plan(uuid,uuid)'::regprocedure,
    'public.save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)'::regprocedure,
    'public.api_create_task(uuid,text,text,uuid,uuid,uuid,text,date,uuid[])'::regprocedure,
    'public.api_update_task(uuid,uuid,text,date,boolean)'::regprocedure,
    'public.api_claim_task_plan(uuid,uuid)'::regprocedure,
    'public.api_report_task_progress(uuid,uuid,integer,text,text)'::regprocedure,
    'public.api_review_task_completion(uuid,uuid,text,text)'::regprocedure,
    'public.api_save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)'::regprocedure,
    'public.api_add_task_comment(uuid,uuid,text)'::regprocedure,
    'public.api_create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid)'::regprocedure
  ];
  v_function regprocedure;
begin
  foreach v_function in array v_functions loop
    if has_function_privilege('anon',v_function,'EXECUTE')
       or has_function_privilege('authenticated',v_function,'EXECUTE')
       or exists (
         select 1
         from pg_proc p
         cross join lateral aclexplode(
           coalesce(p.proacl,acldefault('f',p.proowner))
         ) acl
         where p.oid=v_function
           and acl.grantee=0
           and acl.privilege_type='EXECUTE'
       ) then
      raise exception 'non-service role can execute %',v_function;
    end if;
    if not has_function_privilege('service_role',v_function,'EXECUTE') then
      raise exception 'service_role cannot execute %',v_function;
    end if;
  end loop;
end;
$$;

set local role anon;
do $$ begin
  perform public.claim_task_plan(gen_random_uuid(), gen_random_uuid());
  raise exception 'anon unexpectedly called claim_task_plan';
exception when insufficient_privilege then null;
end $$;
reset role;

set local role authenticated;
do $$ begin
  perform public.claim_task_plan(gen_random_uuid(), gen_random_uuid());
  raise exception 'authenticated unexpectedly called claim_task_plan';
exception when insufficient_privilege then null;
end $$;
reset role;

rollback;

-- Ownership guard contract (fixture-free): the deployed RPC must keep the
-- service-role-only execution boundary and contain the creator predicate.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)'::regprocedure) into v_def;
  if v_def is null or v_def not ilike '%t.created_by = p_actor_id%' then
    raise exception 'evaluation RPC is missing task creator ownership guard';
  end if;
  if has_function_privilege('anon', 'public.save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)'::regprocedure, 'EXECUTE') then
    raise exception 'anon must not execute evaluation RPC';
  end if;
end;
$$;
