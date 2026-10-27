do $$ begin
  if to_regprocedure('public.api_create_editorial_topic_v1(uuid,text,text,uuid)') is null then raise exception 'topic create RPC missing'; end if;
  if to_regprocedure('public.api_create_editorial_series_v1(uuid,text,text,uuid,uuid)') is null then raise exception 'series create RPC missing'; end if;
  if not exists (select 1 from public.permissions where code='journalism.structure.manage') then raise exception 'structure permission missing'; end if;
end $$;
select 1;
