do $$ begin
  if to_regprocedure('public.api_register_journalism_task_v1(uuid,text,text,uuid,date,time,text,uuid,timestamptz,text,text)') is null then raise exception 'self registration RPC missing'; end if;
end $$;
select 1;
