begin;

-- Phase 2 forms replaced the system `status` field options with processing labels,
-- so server validation of the initial "draft" status rejected every new record.
update public.db_form_fields f
set options = '[{"value":"draft","label":"Nháp"},{"value":"pending_review","label":"Chờ duyệt"},{"value":"approved","label":"Đã duyệt"},{"value":"archived","label":"Lưu trữ"}]'::jsonb
from public.db_form_definitions d
where d.id = f.form_definition_id
  and f.field_key = 'status'
  and not (f.options @> '[{"value":"draft"}]'::jsonb);

do $assert$
declare bad integer;
begin
  select count(*) into bad
  from public.db_form_fields f
  where f.field_key = 'status'
    and not (f.options @> '[{"value":"draft"},{"value":"pending_review"},{"value":"approved"},{"value":"archived"}]'::jsonb);
  if bad <> 0 then raise exception 'status field options still missing workflow values on % forms', bad; end if;
end
$assert$;

notify pgrst, 'reload schema';

commit;
