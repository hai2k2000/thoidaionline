do $$ begin
  if to_regprocedure('public.api_attach_editorial_topic_task_v1(uuid,uuid,uuid)') is null then raise exception 'topic attach RPC missing'; end if;
  if to_regprocedure('public.api_reorder_editorial_series_v1(uuid,uuid,uuid[])') is null then raise exception 'series reorder RPC missing'; end if;
end $$;
select 1;
