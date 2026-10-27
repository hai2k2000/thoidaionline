do $$ begin
  foreach x in array array['editorial_topics','editorial_series','editorial_topic_tasks','editorial_series_items'] loop
    if to_regclass('public.'||x) is null then raise exception 'missing table %', x; end if;
  end loop;
  if to_regclass('public.editorial_topics_active_global_name_unique') is null then raise exception 'missing topic index'; end if;
  if to_regprocedure('public.assert_journalism_structure_task()') is null then raise exception 'missing structure guard'; end if;
end $$;
select 1;
