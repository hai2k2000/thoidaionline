begin;

-- Phòng Truyền thông / Hợp đồng nghiệp vụ:
-- 1) ẩn trường "Người thực hiện" (giữ nguyên dữ liệu đã nhập);
-- 2) danh sách "Người phụ trách" = nhân sự đang hoạt động + 3 tên chưa có tài khoản (validation.extraPeople).
update public.db_form_fields f
set hidden = true
from public.db_form_definitions d
join public.db_record_types t on t.id = d.record_type_id and t.code = 'hop_dong_nghiep_vu'
where f.form_definition_id = d.id and d.status = 'published' and f.field_key = 'nguoi_thuc_hien';

update public.db_form_fields f
set validation = coalesce(f.validation, '{}'::jsonb) || '{"extraPeople":["Trần Thị Nhị","Nguyễn Thanh Ngọc","Đỗ Bá Hiếu"]}'::jsonb
from public.db_form_definitions d
join public.db_record_types t on t.id = d.record_type_id and t.code = 'hop_dong_nghiep_vu'
where f.form_definition_id = d.id and d.status = 'published' and f.field_key = 'responsible_person';

do $assert$
begin
  if not exists (
    select 1 from public.db_form_fields f
    join public.db_form_definitions d on d.id = f.form_definition_id and d.status = 'published'
    join public.db_record_types t on t.id = d.record_type_id and t.code = 'hop_dong_nghiep_vu'
    where f.field_key = 'nguoi_thuc_hien' and f.hidden
  ) then raise exception 'nguoi_thuc_hien not hidden'; end if;
  if not exists (
    select 1 from public.db_form_fields f
    join public.db_form_definitions d on d.id = f.form_definition_id and d.status = 'published'
    join public.db_record_types t on t.id = d.record_type_id and t.code = 'hop_dong_nghiep_vu'
    where f.field_key = 'responsible_person' and not f.hidden and jsonb_array_length(f.validation->'extraPeople') = 3
  ) then raise exception 'responsible_person extraPeople missing'; end if;
end
$assert$;

notify pgrst, 'reload schema';

commit;
