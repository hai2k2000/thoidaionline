do $$ begin
  if to_regprocedure('public.api_assert_journalism_access(uuid,uuid,text)') is null then raise exception 'journalism access RPC missing'; end if;
  if to_regprocedure('public.api_assign_journalism_task_v1(uuid,text,text,uuid,uuid,uuid,date,time without time zone,text,text,uuid[],uuid[],uuid,timestamp with time zone,text,text)') is null then raise exception 'journalism assign RPC missing'; end if;
  if not exists (select 1 from public.permissions where code in ('journalism.metadata.update','journalism.publication.manage')) then raise exception 'journalism permissions missing'; end if;
end $$;
select 1;
