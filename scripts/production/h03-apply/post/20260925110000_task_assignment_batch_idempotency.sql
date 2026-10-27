do $$ begin
  if to_regclass('public.task_assignment_batch_idempotency') is null then raise exception 'batch idempotency table missing'; end if;
  if to_regprocedure('public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)') is null then raise exception 'batch placeholder RPC missing'; end if;
  if to_regclass('public.task_assignment_batch_idempotency_created_at_idx') is null then raise exception 'batch index missing'; end if;
end $$;
select 1;
