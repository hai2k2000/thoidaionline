do $$ begin
  if to_regclass('public.journalism_publication_verifications') is null then raise exception 'verification table missing'; end if;
  if to_regprocedure('public.api_record_journalism_publication_verification_v1(uuid,uuid,text,text,timestamptz)') is null then raise exception 'verification RPC missing'; end if;
  if not exists (select 1 from public.permissions where code='journalism.publication.verify') then raise exception 'verification permission missing'; end if;
end $$;
select 1;
