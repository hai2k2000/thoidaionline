begin;

-- Phòng Truyền thông: thêm trường "Người thực hiện" (chọn nhiều) vào form đang published của loại "Hợp đồng nghiệp vụ".
insert into public.db_form_fields (form_definition_id, field_key, label, data_type, required, searchable, hidden, options, validation, sort_order)
select d.id, 'nguoi_thuc_hien', 'Người thực hiện', 'multi_select', false, true, false,
  '[{"value":"Trần Thị Nhị","label":"Trần Thị Nhị"},{"value":"Nguyễn Thanh Ngọc","label":"Nguyễn Thanh Ngọc"},{"value":"Nguyễn Quỳnh Trang","label":"Nguyễn Quỳnh Trang"}]'::jsonb,
  '{"help":"Giữ Ctrl (hoặc Cmd) để chọn nhiều người."}'::jsonb,
  705
from public.db_form_definitions d
join public.db_record_types t on t.id = d.record_type_id
where t.code = 'hop_dong_nghiep_vu' and d.status = 'published'
on conflict (form_definition_id, field_key) do update
set label = excluded.label, data_type = excluded.data_type, hidden = false, options = excluded.options, validation = excluded.validation, sort_order = excluded.sort_order;

do $assert$
begin
  if not exists (
    select 1 from public.db_form_fields f
    join public.db_form_definitions d on d.id = f.form_definition_id and d.status = 'published'
    join public.db_record_types t on t.id = d.record_type_id and t.code = 'hop_dong_nghiep_vu'
    where f.field_key = 'nguoi_thuc_hien' and f.data_type = 'multi_select' and not f.hidden
      and jsonb_array_length(f.options) = 3
  ) then raise exception 'nguoi_thuc_hien field missing on hop_dong_nghiep_vu'; end if;
end
$assert$;

notify pgrst, 'reload schema';

commit;
