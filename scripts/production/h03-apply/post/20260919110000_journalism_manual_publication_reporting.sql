do $$ begin
  if to_regclass('public.journalism_publication_reports') is null then raise exception 'publication reports table missing'; end if;
  if to_regprocedure('public.api_upsert_journalism_publication_report_v1(uuid,uuid,text,text,timestamptz,text,timestamptz)') is null then raise exception 'publication report RPC missing'; end if;
end $$;
select 1;
