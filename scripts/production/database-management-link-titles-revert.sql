begin;
do $guard$ begin if exists (select 1 from public.db_record_external_links where provider='web') then raise exception 'Cannot revert link titles while web links exist'; end if; end $guard$;
alter table public.db_record_external_links drop constraint if exists db_record_external_links_provider_check;
alter table public.db_record_external_links add constraint db_record_external_links_provider_check check (provider = 'google_drive');
alter table public.db_record_external_links drop constraint if exists db_record_external_links_label_check;
alter table public.db_record_external_links drop column if exists label;
alter table public.db_record_external_links drop column if exists position;
notify pgrst, 'reload schema';
commit;
