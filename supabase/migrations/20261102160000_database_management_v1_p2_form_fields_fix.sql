begin;

create temporary table p2_form_fix_types (
  record_type_id uuid primary key,
  type_code text not null,
  old_form_id uuid not null,
  new_form_id uuid not null
) on commit drop;

create temporary table p2_form_fix_options (
  type_code text not null,
  field_key text not null,
  options jsonb not null,
  primary key (type_code, field_key)
) on commit drop;

insert into p2_form_fix_options(type_code, field_key, options)
values
  ('dang_bao_cao_cong_van', 'loai_van_ban', '[{"value":"Nghị quyết","label":"Nghị quyết"},{"value":"Chỉ thị","label":"Chỉ thị"},{"value":"Kết luận","label":"Kết luận"},{"value":"Quy định","label":"Quy định"},{"value":"Hướng dẫn","label":"Hướng dẫn"},{"value":"Kế hoạch","label":"Kế hoạch"},{"value":"Công văn","label":"Công văn"}]'::jsonb),
  ('dang_bao_cao_cong_van', 'tinh_trang_thuc_hien', '[{"value":"Chưa thực hiện","label":"Chưa thực hiện"},{"value":"Đang thực hiện","label":"Đang thực hiện"},{"value":"Hoàn thành","label":"Hoàn thành"}]'::jsonb),
  ('dang_danh_gia_xep_loai', 'muc_xep_loai', '[{"value":"Hoàn thành xuất sắc nhiệm vụ","label":"Hoàn thành xuất sắc nhiệm vụ"},{"value":"Hoàn thành tốt nhiệm vụ","label":"Hoàn thành tốt nhiệm vụ"},{"value":"Hoàn thành nhiệm vụ","label":"Hoàn thành nhiệm vụ"},{"value":"Không hoàn thành nhiệm vụ","label":"Không hoàn thành nhiệm vụ"}]'::jsonb),
  ('cong_doan_van_ban_den', 'loai_van_ban', '[{"value":"Quyết định","label":"Quyết định"},{"value":"Nghị quyết","label":"Nghị quyết"},{"value":"Công văn","label":"Công văn"},{"value":"Thông báo","label":"Thông báo"},{"value":"Kế hoạch","label":"Kế hoạch"},{"value":"Báo cáo","label":"Báo cáo"},{"value":"Hướng dẫn","label":"Hướng dẫn"},{"value":"Khác","label":"Khác"}]'::jsonb),
  ('cong_doan_van_ban_di', 'loai_van_ban', '[{"value":"Quyết định","label":"Quyết định"},{"value":"Nghị quyết","label":"Nghị quyết"},{"value":"Công văn","label":"Công văn"},{"value":"Thông báo","label":"Thông báo"},{"value":"Kế hoạch","label":"Kế hoạch"},{"value":"Báo cáo","label":"Báo cáo"},{"value":"Hướng dẫn","label":"Hướng dẫn"},{"value":"Khác","label":"Khác"}]'::jsonb),
  ('phap_ly_to_chuc_hoat_dong', 'loai_van_ban', '[{"value":"Quyết định","label":"Quyết định"},{"value":"Nghị quyết","label":"Nghị quyết"},{"value":"Công văn","label":"Công văn"},{"value":"Thông báo","label":"Thông báo"},{"value":"Kế hoạch","label":"Kế hoạch"},{"value":"Báo cáo","label":"Báo cáo"},{"value":"Hướng dẫn","label":"Hướng dẫn"},{"value":"Khác","label":"Khác"}]'::jsonb),
  ('quy_che_quy_dinh_quy_trinh', 'loai_van_ban', '[{"value":"Quyết định","label":"Quyết định"},{"value":"Nghị quyết","label":"Nghị quyết"},{"value":"Công văn","label":"Công văn"},{"value":"Thông báo","label":"Thông báo"},{"value":"Kế hoạch","label":"Kế hoạch"},{"value":"Báo cáo","label":"Báo cáo"},{"value":"Hướng dẫn","label":"Hướng dẫn"},{"value":"Khác","label":"Khác"}]'::jsonb),
  ('cong_doan_doan_vien', 'tinh_trang', '[{"value":"Đang sinh hoạt","label":"Đang sinh hoạt"},{"value":"Chuyển đi","label":"Chuyển đi"},{"value":"Thôi sinh hoạt","label":"Thôi sinh hoạt"}]'::jsonb),
  ('phap_ly_to_chuc_hoat_dong', 'tinh_trang_hieu_luc', '[{"value":"Còn hiệu lực","label":"Còn hiệu lực"},{"value":"Hết hiệu lực","label":"Hết hiệu lực"},{"value":"Bị thay thế","label":"Bị thay thế"}]'::jsonb),
  ('quy_che_quy_dinh_quy_trinh', 'tinh_trang_hieu_luc', '[{"value":"Còn hiệu lực","label":"Còn hiệu lực"},{"value":"Hết hiệu lực","label":"Hết hiệu lực"},{"value":"Bị thay thế","label":"Bị thay thế"}]'::jsonb),
  ('van_ban_quan_ly_dieu_hanh', 'loai', '[{"value":"Quyết định","label":"Quyết định"},{"value":"Kế hoạch","label":"Kế hoạch"},{"value":"Thông báo","label":"Thông báo"},{"value":"Hướng dẫn","label":"Hướng dẫn"},{"value":"Khác","label":"Khác"}]'::jsonb),
  ('cong_doan_tai_chinh', 'ky', '[{"value":"Tháng","label":"Tháng"},{"value":"Quý","label":"Quý"},{"value":"6 tháng","label":"6 tháng"},{"value":"Năm","label":"Năm"}]'::jsonb);

insert into p2_form_fix_types(record_type_id, type_code, old_form_id, new_form_id)
select t.id, t.code, old_form.id, gen_random_uuid()
from public.db_record_types t
join public.db_categories c on c.id = t.category_id
join lateral (
  select f.id
  from public.db_form_definitions f
  where f.record_type_id = t.id and f.status = 'published'
  order by f.version desc
  limit 1
) old_form on true
where t.active
  and c.code in ('cong_tac_dang', 'cong_doan', 'lien_hiep', 'phap_ly_dieu_hanh');

do $assert$
begin
  if (select count(distinct new_form_id) = count(*) from p2_form_fix_types) is not true then
    raise exception 'new form ids are not distinct';
  end if;
end
$assert$;

update public.db_form_definitions f
set status = 'retired'
from p2_form_fix_types x
where f.id = x.old_form_id;

insert into public.db_form_definitions(
  id,
  record_type_id,
  version,
  status,
  search_config,
  display_config
)
select
  x.new_form_id,
  x.record_type_id,
  (
    select max(candidate.version) + 1
    from public.db_form_definitions candidate
    where candidate.record_type_id = x.record_type_id
  ),
  'published',
  source.search_config,
  source.display_config
from p2_form_fix_types x
join public.db_form_definitions source on source.id = x.old_form_id;

insert into public.db_form_fields(
  form_definition_id,
  field_key,
  label,
  data_type,
  required,
  searchable,
  options,
  validation,
  hidden,
  sort_order
)
select
  x.new_form_id,
  field.field_key,
  field.label,
  case
    when field.field_key = 'keywords' then 'text'
    when field.field_key = 'con_phai_thu' then 'number'
    when x.type_code = 'cong_doan_tai_chinh' and field.field_key = 'ky' then 'select'
    else field.data_type
  end,
  field.required,
  field.searchable,
  case
    when field.field_key = 'keywords' then '[]'::jsonb
    when field.field_key = 'con_phai_thu' then '[]'::jsonb
    when x.type_code = 'cong_doan_tai_chinh' and field.field_key = 'ky' then options.options
    when field.data_type not in ('select', 'multi_select') then '[]'::jsonb
    when options.options is not null then options.options
    else field.options
  end,
  case
    when field.validation ? 'help'
      and field.validation->>'help' = 'Đính kèm tài liệu chi tiết ở mục Tệp.'
      then field.validation - 'help'
    else field.validation
  end
  || case
    when x.type_code = 'dang_dai_hoi' and field.field_key = 'ten_dai_hoi'
      then jsonb_build_object('help', 'Văn kiện, báo cáo, biên bản đại hội đính kèm ở mục Tệp.')
    when x.type_code = 'cong_doan_thu_doan_phi' and field.field_key = 'thang_nam'
      then jsonb_build_object('help', 'Đính kèm file danh sách thu ở mục Tệp.')
    when x.type_code = 'cong_doan_tai_chinh' and field.field_key = 'nam_tai_chinh'
      then jsonb_build_object('help', 'Đính kèm sổ/chứng từ ở mục Tệp.')
    else '{}'::jsonb
  end,
  field.hidden,
  field.sort_order
from p2_form_fix_types x
join public.db_form_fields field on field.form_definition_id = x.old_form_id
left join p2_form_fix_options options
  on options.type_code = x.type_code
 and options.field_key = field.field_key;

do $assert$
declare
  invalid_count integer;
begin
  if exists (
    select 1
    from p2_form_fix_types x
    join public.db_form_definitions old_form on old_form.id = x.old_form_id
    join public.db_form_definitions new_form on new_form.id = x.new_form_id
    where new_form.version <= old_form.version
  ) then raise exception 'new form version invalid'; end if;

  select count(*)
  into invalid_count
  from (
    select t.id
    from public.db_record_types t
    join public.db_categories c on c.id = t.category_id
    left join public.db_form_definitions f
      on f.record_type_id = t.id
     and f.status = 'published'
    where t.active
      and c.code in ('cong_tac_dang', 'cong_doan', 'lien_hiep', 'phap_ly_dieu_hanh')
    group by t.id
    having count(f.id) <> 1
  ) invalid_forms;
  if invalid_count <> 0 then
    raise exception 'published form count invalid';
  end if;

  if exists (
    select 1
    from public.db_form_fields field
    join public.db_form_definitions form on form.id = field.form_definition_id
    join public.db_record_types t on t.id = form.record_type_id
    join public.db_categories c on c.id = t.category_id
    where form.status = 'published'
      and t.active
      and c.code in ('cong_tac_dang', 'cong_doan', 'lien_hiep', 'phap_ly_dieu_hanh')
      and field.data_type not in ('select', 'multi_select')
      and field.options <> '[]'::jsonb
  ) then raise exception 'non-select field has options'; end if;

  if exists (
    select 1
    from public.db_form_fields field
    join public.db_form_definitions form on form.id = field.form_definition_id
    join public.db_record_types t on t.id = form.record_type_id
    join public.db_categories c on c.id = t.category_id
    where form.status = 'published'
      and t.active
      and c.code in ('cong_tac_dang', 'cong_doan', 'lien_hiep', 'phap_ly_dieu_hanh')
      and field.data_type in ('select', 'multi_select')
      and field.options = '[]'::jsonb
  ) then raise exception 'select field has empty options'; end if;

  if exists (
    select 1
    from public.db_form_fields field
    join public.db_form_definitions form on form.id = field.form_definition_id
    join public.db_record_types t on t.id = form.record_type_id
    join public.db_categories c on c.id = t.category_id
    where form.status = 'published'
      and t.active
      and c.code in ('cong_tac_dang', 'cong_doan', 'lien_hiep', 'phap_ly_dieu_hanh')
      and field.field_key = 'keywords'
      and field.data_type <> 'text'
  ) then raise exception 'keywords type invalid'; end if;

  if exists (
    select 1
    from public.db_form_fields field
    join public.db_form_definitions form on form.id = field.form_definition_id
    join public.db_record_types t on t.id = form.record_type_id
    join public.db_categories c on c.id = t.category_id
    where form.status = 'published'
      and t.active
      and c.code in ('cong_tac_dang', 'cong_doan', 'lien_hiep', 'phap_ly_dieu_hanh')
      and field.field_key = 'con_phai_thu'
      and field.data_type <> 'number'
  ) then raise exception 'con_phai_thu type invalid'; end if;

  if exists (
    select 1
    from public.db_form_fields field
    join public.db_form_definitions form on form.id = field.form_definition_id
    join public.db_record_types t on t.id = form.record_type_id
    join public.db_categories c on c.id = t.category_id
    where form.status = 'published'
      and t.active
      and c.code in ('cong_tac_dang', 'cong_doan', 'lien_hiep', 'phap_ly_dieu_hanh')
      and field.validation->>'help' = 'Đính kèm tài liệu chi tiết ở mục Tệp.'
  ) then raise exception 'stale help remains'; end if;

  if not exists (
    select 1
    from public.db_form_fields field
    join public.db_form_definitions form on form.id = field.form_definition_id
    join public.db_record_types t on t.id = form.record_type_id
    where form.status = 'published'
      and t.code = 'dang_bao_cao_cong_van'
      and field.field_key = 'loai_van_ban'
      and field.options @> '[{"value":"Chỉ thị","label":"Chỉ thị"}]'::jsonb
  ) then raise exception 'dang_bao_cao_cong_van option invalid'; end if;

  if not exists (
    select 1
    from public.db_form_fields field
    join public.db_form_definitions form on form.id = field.form_definition_id
    join public.db_record_types t on t.id = form.record_type_id
    where form.status = 'published'
      and t.code = 'van_ban_quan_ly_dieu_hanh'
      and field.field_key = 'loai'
      and field.options @> '[{"value":"Thông báo","label":"Thông báo"}]'::jsonb
  ) then raise exception 'van_ban_quan_ly_dieu_hanh option invalid'; end if;

  if exists (
    select 1
    from public.db_form_fields field
    join public.db_form_definitions form on form.id = field.form_definition_id
    join public.db_record_types t on t.id = form.record_type_id
    where form.status = 'published'
      and t.active
      and field.data_type in ('select', 'multi_select')
      and field.options @> '[{"value":"Chưa xử lý"}]'::jsonb
      and not (
        field.field_key = 'status'
        or (
          field.field_key = 'tinh_trang'
          and t.code in ('dang_phat_trien_ket_nap', 'cong_doan_van_ban_den', 'cong_doan_van_ban_di')
        )
      )
  ) then raise exception 'stale status options remain'; end if;
end
$assert$;

commit;
