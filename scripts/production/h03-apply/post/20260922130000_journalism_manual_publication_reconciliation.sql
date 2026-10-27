do $$ begin
  if to_regprocedure('public.api_reconcile_journalism_publication_report_v1(uuid,uuid,text,text,timestamptz,text,timestamptz,text)') is null then raise exception 'reconciliation RPC missing'; end if;
end $$;
select 1;
