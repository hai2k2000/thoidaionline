begin;

-- Hồ sơ đào tạo (20261125100000) was published without the hidden system field
-- record_code, so the server's "unknown_field" check rejected every new record.
insert into public.db_form_fields (form_definition_id, field_key, label, data_type, required, searchable, hidden, options, validation, sort_order)
select d.id, 'record_code', 'Mã hồ sơ', 'text', false, false, true, '[]'::jsonb, '{"maxLength": 120}'::jsonb, 1010
from public.db_form_definitions d
join public.db_record_types t on t.id = d.record_type_id
where d.status = 'published'
  and not exists (select 1 from public.db_form_fields f where f.form_definition_id = d.id and f.field_key = 'record_code')
on conflict (form_definition_id, field_key) do nothing;

do $assert$
declare missing integer;
begin
  select count(*) into missing
  from public.db_form_definitions d
  where d.status = 'published'
    and not exists (select 1 from public.db_form_fields f where f.form_definition_id = d.id and f.field_key = 'record_code');
  if missing <> 0 then raise exception 'record_code still missing on % published forms', missing; end if;
end
$assert$;

notify pgrst, 'reload schema';

commit;
