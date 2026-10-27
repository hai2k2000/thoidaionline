do $$ begin
  if not (select relrowsecurity from pg_class where oid = 'public.task_assignment_batch_idempotency'::regclass) then raise exception 'batch idempotency RLS off'; end if;
  if has_table_privilege('anon', 'public.task_assignment_batch_idempotency', 'select,insert,update,delete') then raise exception 'anon still has access to batch idempotency'; end if;
  if has_table_privilege('authenticated', 'public.task_assignment_batch_idempotency', 'select,insert,update,delete') then raise exception 'authenticated still has access to batch idempotency'; end if;
  if not has_table_privilege('service_role', 'public.task_assignment_batch_idempotency', 'select') then raise exception 'service_role lost access to batch idempotency'; end if;
end $$;
select 1;
