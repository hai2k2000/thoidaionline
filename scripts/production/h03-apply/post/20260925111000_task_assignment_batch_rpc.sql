do $$ begin
  if to_regprocedure('public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)') is null then raise exception 'batch RPC missing'; end if;
  if not has_function_privilege('service_role','public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)','execute') then raise exception 'batch RPC grant missing'; end if;
end $$;
select 1;
