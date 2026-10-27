do $$ begin
  if to_regprocedure('public.api_assert_journalism_department_scope(uuid,uuid)') is null then raise exception 'department scope RPC missing'; end if;
  if to_regprocedure('public.api_assign_journalism_task_v1(uuid,text,text,uuid,uuid,uuid,date,time without time zone,text,text,uuid[],uuid[],uuid,timestamp with time zone,text,text)') is null then raise exception 'scoped assign RPC missing'; end if;
  if to_regprocedure('public.api_assign_journalism_task_v1_unscoped(uuid,text,text,uuid,uuid,uuid,date,time without time zone,text,text,uuid[],uuid[],uuid,timestamp with time zone,text,text)') is null then raise exception 'unscoped rename missing'; end if;
end $$;
select 1;
