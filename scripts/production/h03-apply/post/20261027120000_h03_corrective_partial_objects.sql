do $$ begin
  if to_regprocedure('public.audit_direct_assignment_start()') is null then raise exception 'audit function missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='audit_direct_assignment_start' and tgrelid='public.tasks'::regclass) then raise exception 'audit trigger missing'; end if;
  raise notice 'PASS';
end $$;
select 1;
