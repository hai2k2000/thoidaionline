begin;

-- Phòng Truyền thông / Hợp đồng nghiệp vụ: hiện lại trường "Người thực hiện" (đã ẩn ở 20261116100000)
-- với danh sách giống "Người phụ trách": nhân sự đang hoạt động + 3 tên chưa có tài khoản.
-- peopleOptions: catalog điền danh sách nhân sự; options để trống nên server không giới hạn giá trị cũ.
update public.db_form_fields f
set hidden = false,
    options = '[]'::jsonb,
    validation = coalesce(f.validation, '{}'::jsonb) || '{"peopleOptions":true,"help":"Tích chọn một hoặc nhiều người.","extraPeople":["Trần Thị Nhị","Nguyễn Thanh Ngọc","Đỗ Bá Hiếu"]}'::jsonb
from public.db_form_definitions d
join public.db_record_types t on t.id = d.record_type_id and t.code = 'hop_dong_nghiep_vu'
where f.form_definition_id = d.id and d.status = 'published' and f.field_key = 'nguoi_thuc_hien';

do $assert$
begin
  if not exists (
    select 1 from public.db_form_fields f
    join public.db_form_definitions d on d.id = f.form_definition_id and d.status = 'published'
    join public.db_record_types t on t.id = d.record_type_id and t.code = 'hop_dong_nghiep_vu'
    where f.field_key = 'nguoi_thuc_hien' and not f.hidden and f.data_type = 'multi_select'
      and (f.validation->>'peopleOptions')::boolean and jsonb_array_length(f.validation->'extraPeople') = 3
  ) then raise exception 'nguoi_thuc_hien still hidden'; end if;
end
$assert$;

notify pgrst, 'reload schema';

commit;
