do $$ begin
  if to_regprocedure('public.api_assert_journalism_department_scope(uuid,uuid)') is null then raise exception 'department alignment RPC missing'; end if;
end $$;
select 1;
