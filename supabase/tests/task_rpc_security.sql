begin;

do $$
declare
  v_claim regprocedure := 'public.claim_task_plan(uuid,uuid)'::regprocedure;
  v_eval regprocedure := 'public.save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)'::regprocedure;
begin
  if has_function_privilege('anon', v_claim, 'EXECUTE') then
    raise exception 'anon must not execute claim_task_plan';
  end if;
  if has_function_privilege('authenticated', v_claim, 'EXECUTE') then
    raise exception 'authenticated must not execute claim_task_plan directly';
  end if;
  if has_function_privilege('anon', v_eval, 'EXECUTE') then
    raise exception 'anon must not execute save_task_evaluation_checkpoint';
  end if;
  if has_function_privilege('authenticated', v_eval, 'EXECUTE') then
    raise exception 'authenticated must not execute save_task_evaluation_checkpoint directly';
  end if;
  if not has_function_privilege('service_role', v_claim, 'EXECUTE') then
    raise exception 'service_role must execute claim_task_plan';
  end if;
  if not has_function_privilege('service_role', v_eval, 'EXECUTE') then
    raise exception 'service_role must execute save_task_evaluation_checkpoint';
  end if;
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
