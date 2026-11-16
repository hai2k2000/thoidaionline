begin;

-- Phòng Truyền thông / Hợp đồng nghiệp vụ: hiện lại trường "Người thực hiện" (đã ẩn ở 20261116100000).
update public.db_form_fields f
set hidden = false
from public.db_form_definitions d
join public.db_record_types t on t.id = d.record_type_id and t.code = 'hop_dong_nghiep_vu'
where f.form_definition_id = d.id and d.status = 'published' and f.field_key = 'nguoi_thuc_hien';

do $assert$
begin
  if not exists (
    select 1 from public.db_form_fields f
    join public.db_form_definitions d on d.id = f.form_definition_id and d.status = 'published'
    join public.db_record_types t on t.id = d.record_type_id and t.code = 'hop_dong_nghiep_vu'
    where f.field_key = 'nguoi_thuc_hien' and not f.hidden
  ) then raise exception 'nguoi_thuc_hien still hidden'; end if;
end
$assert$;

notify pgrst, 'reload schema';

commit;
