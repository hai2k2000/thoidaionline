begin;

delete from public.db_form_fields
where field_key = 'source_person';

update public.db_records
set metadata = metadata - 'source_person'
where metadata ? 'source_person';

commit;
