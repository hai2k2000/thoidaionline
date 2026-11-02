begin;

-- 1. Nhóm con
insert into public.db_categories (code, name, parent_id, department_id, sort_order, restricted, active)
select x.code, x.name, p.id, p.department_id, x.sort_order, x.restricted, true
from (values
  ('tong_hop_van_thu_luu_tru', 'Văn thư – Lưu trữ', 10, false),
  ('tong_hop_to_chuc_can_bo', 'Tổ chức – Cán bộ', 20, true),
  ('tong_hop_chung', 'Tổng hợp chung', 30, false)
) as x(code, name, sort_order, restricted)
join public.db_categories p on p.code = 'tong_hop'
on conflict (code) do update set
  name = excluded.name,
  parent_id = excluded.parent_id,
  sort_order = excluded.sort_order,
  restricted = excluded.restricted,
  active = true,
  updated_at = now();

-- 2. Chuyển type
create temporary table p3_moves (
  category_code text,
  type_code text primary key
) on commit drop;

insert into p3_moves(category_code, type_code) values
  ('tong_hop_van_thu_luu_tru', 'van_ban_den'),
  ('tong_hop_van_thu_luu_tru', 'van_ban_di'),
  ('tong_hop_van_thu_luu_tru', 'so_sach_van_thu_luu_tru'),
  ('tong_hop_van_thu_luu_tru', 'bieu_mau_hanh_chinh'),
  ('tong_hop_chung', 'bao_cao'),
  ('tong_hop_chung', 'bien_ban_ket_luan_hop'),
  ('tong_hop_chung', 'ho_so_cong_viec_trong_tam'),
  ('tong_hop_chung', 'ke_hoach_cong_tac'),
  ('tong_hop_chung', 'phieu_giao_viec'),
  ('tong_hop_chung', 'van_ban_noi_bo'),
  ('tong_hop_chung', 'cho_phan_loai');

update public.db_record_types t
set category_id = c.id, updated_at = now()
from p3_moves m
join public.db_categories c on c.code = m.category_code
where t.code = m.type_code;

-- 3. Chuyển hồ sơ của 11 type
update public.db_records r
set category_id = t.category_id, updated_at = now()
from public.db_record_types t
where t.id = r.record_type_id
  and t.code in ('van_ban_den', 'van_ban_di', 'so_sach_van_thu_luu_tru', 'bieu_mau_hanh_chinh', 'bao_cao', 'bien_ban_ket_luan_hop',
    'ho_so_cong_viec_trong_tam', 'ke_hoach_cong_tac', 'phieu_giao_viec', 'van_ban_noi_bo', 'cho_phan_loai')
  and r.category_id <> t.category_id;

-- 4. Tạo 4 type mới
insert into public.db_record_types (category_id, code, name, description, active, sort_order)
select c.id, x.code, x.name, x.description, true, x.sort_order
from (values
  ('tccb_tai_lieu_ho_so_nhan_su', 'Tài liệu hồ sơ nhân sự', 'Danh mục Database Management V1.', 10),
  ('tccb_hop_dong_lao_dong', 'Hợp đồng lao động và phụ lục', 'Danh mục Database Management V1.', 20),
  ('tccb_bien_dong_nhan_su', 'Bổ nhiệm, điều động, biến động nhân sự', 'Danh mục Database Management V1.', 30),
  ('tccb_danh_gia_khen_thuong_ky_luat', 'Đánh giá, thi đua – khen thưởng, kỷ luật', 'Danh mục Database Management V1.', 40)
) as x(code, name, description, sort_order)
join public.db_categories c on c.code = 'tong_hop_to_chuc_can_bo'
on conflict (code) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

-- 5. Dữ liệu tạm cho form
create temporary table p3_types (
  type_code text primary key,
  kind text check (kind in ('redesigned', 'light', 'new')),
  title_label text,
  summary_label text,
  summary_help text,
  search_fields jsonb
) on commit drop;

insert into p3_types(type_code, kind, title_label, summary_label, summary_help, search_fields) values
  ('van_ban_den', 'redesigned', 'Trích yếu nội dung', 'Ghi chú', null,
    ('["title","so_den","document_number","sender_organization","loai_van_ban","tinh_trang_xu_ly' || '"]')::jsonb),
  ('van_ban_di', 'redesigned', 'Trích yếu nội dung', 'Ghi chú', null, '["title","document_number","loai_van_ban","noi_nhan","nguoi_ky"]'::jsonb),
  ('tccb_tai_lieu_ho_so_nhan_su', 'new', 'Tên tài liệu', 'Ghi chú',
    ('Không nhập lại lý lịch, quá trình công tác, trình độ: các thông tin đó ở module Hồ sơ nhân' || ' sự. Bản scan đính kèm ở mục Tệp.'),
    '["title","nhan_su","loai_tai_lieu"]'::jsonb),
  ('tccb_hop_dong_lao_dong', 'new', 'Tên hợp đồng / phụ lục', 'Ghi chú',
    'Không ghi mức lương ở đây; mức lương nằm trong file hợp đồng đính kèm ở mục Tệp.',
    '["title","nhan_su","so_hop_dong","loai_hop_dong","tinh_trang_ky"]'::jsonb),
  ('tccb_bien_dong_nhan_su', 'new', 'Tên quyết định / nội dung biến động', 'Ghi chú', 'Quyết định đính kèm ở mục Tệp.',
    '["title","nhan_su","hinh_thuc_bien_dong","so_quyet_dinh"]'::jsonb),
  ('tccb_danh_gia_khen_thuong_ky_luat', 'new', 'Tên hồ sơ', 'Ghi chú', 'Văn bản, quyết định đính kèm ở mục Tệp.',
    '["title","doi_tuong","nhan_su","phan_loai","ky_nam"]'::jsonb),
  ('so_sach_van_thu_luu_tru', 'light', null, null, null, null),
  ('bieu_mau_hanh_chinh', 'light', null, null, null, null),
  ('bao_cao', 'light', null, null, null, null),
  ('bien_ban_ket_luan_hop', 'light', null, null, null, null),
  ('ho_so_cong_viec_trong_tam', 'light', null, null, null, null),
  ('ke_hoach_cong_tac', 'light', null, null, null, null),
  ('phieu_giao_viec', 'light', null, null, null, null),
  ('van_ban_noi_bo', 'light', null, null, null, null),
  ('cho_phan_loai', 'light', null, null, null, null);

create temporary table p3_fields (
  type_code text,
  field_key text,
  label text,
  data_type text,
  options jsonb,
  help text,
  sort_order int,
  primary key (type_code, field_key)
) on commit drop;

insert into p3_fields(type_code, field_key, label, data_type, options, help, sort_order) values
  ('van_ban_den', 'so_den', 'Số đến', 'text', '[]'::jsonb, null, 30),
  ('van_ban_den', 'received_date', 'Ngày đến', 'date', '[]'::jsonb, null, 40),
  ('van_ban_den', 'sender_organization', 'Cơ quan gửi', 'text', '[]'::jsonb, null, 50),
  ('van_ban_den', 'document_number', 'Số, ký hiệu', 'text', '[]'::jsonb, null, 60),
  ('van_ban_den', 'issued_date_source', 'Ngày ban hành', 'date', '[]'::jsonb, null, 70),
  ('van_ban_den', 'loai_van_ban', 'Loại văn bản', 'select', ('["Nghị quyết","Quyết định","Chỉ thị","Kết luận","Thông báo","Công văn","Kế hoạch","Báo cáo'
    || '","Tờ trình","Giấy mời","Khác"]')::jsonb, null, 80),
  ('van_ban_den', 'muc_do_khan', 'Mức độ khẩn', 'select', '["Thường","Khẩn","Thượng khẩn","Hỏa tốc"]'::jsonb, null, 90),
  ('van_ban_den', 'do_mat', 'Độ mật', 'select', '["Thường","Mật","Tối mật"]'::jsonb,
    'Văn bản Mật, Tối mật: chỉ ghi thông tin quản lý, không đính kèm toàn văn.', 100),
  ('van_ban_den', 'handler', 'Người xử lý', 'person', '[]'::jsonb, null, 110),
  ('van_ban_den', 'responsible_department', 'Bộ phận xử lý', 'department', '[]'::jsonb, null, 120),
  ('van_ban_den', 'processing_deadline', 'Hạn xử lý', 'date', '[]'::jsonb, null, 130),
  ('van_ban_den', 'tinh_trang_xu_ly', 'Tình trạng xử lý', 'select', '["Chưa xử lý","Đang xử lý","Đã xử lý"]'::jsonb, null, 140),
  ('van_ban_den', 'van_ban_tra_loi', 'Văn bản trả lời (số, ký hiệu)', 'text', '[]'::jsonb, null, 150),
  ('van_ban_den', 'original_location', 'Vị trí lưu bản giấy', 'text', '[]'::jsonb, null, 160),
  ('van_ban_di', 'document_number', 'Số, ký hiệu', 'text', '[]'::jsonb, null, 30),
  ('van_ban_di', 'loai_van_ban', 'Loại văn bản', 'select', ('["Nghị quyết","Quyết định","Chỉ thị","Kết luận","Thông báo","Công văn","Kế hoạch","Báo cáo'
    || '","Tờ trình","Giấy mời","Khác"]')::jsonb, null, 40),
  ('van_ban_di', 'issued_date', 'Ngày ký / ban hành', 'date', '[]'::jsonb, null, 50),
  ('van_ban_di', 'nguoi_ky', 'Người ký', 'text', '[]'::jsonb, null, 60),
  ('van_ban_di', 'responsible_department', 'Bộ phận soạn thảo', 'department', '[]'::jsonb, null, 70),
  ('van_ban_di', 'noi_nhan', 'Nơi nhận', 'long_text', '[]'::jsonb, null, 80),
  ('van_ban_di', 'muc_do_khan', 'Mức độ khẩn', 'select', '["Thường","Khẩn","Thượng khẩn","Hỏa tốc"]'::jsonb, null, 90),
  ('van_ban_di', 'do_mat', 'Độ mật', 'select', '["Thường","Mật","Tối mật"]'::jsonb,
    'Văn bản Mật, Tối mật: chỉ ghi thông tin quản lý, không đính kèm toàn văn.', 100),
  ('van_ban_di', 'hinh_thuc_phat_hanh', 'Hình thức phát hành', 'select', '["Bản giấy","Điện tử","Bản giấy và điện tử"]'::jsonb, null, 110),
  ('van_ban_di', 'ngay_phat_hanh', 'Ngày phát hành', 'date', '[]'::jsonb, null, 120),
  ('van_ban_di', 'archive_location', 'Vị trí lưu bản giấy', 'text', '[]'::jsonb, null, 130),
  ('tccb_tai_lieu_ho_so_nhan_su', 'nhan_su', 'Nhân sự', 'person', '[]'::jsonb, null, 30),
  ('tccb_tai_lieu_ho_so_nhan_su', 'loai_tai_lieu', 'Loại tài liệu', 'select', '["Sơ yếu lý lịch","Bằng cấp, chứng chỉ","Quyết định","Khác"]'::jsonb, null, 40),
  ('tccb_tai_lieu_ho_so_nhan_su', 'ngay_tai_lieu', 'Ngày tài liệu', 'date', '[]'::jsonb, null, 50),
  ('tccb_tai_lieu_ho_so_nhan_su', 'nguoi_quan_ly', 'Người quản lý hồ sơ', 'person', '[]'::jsonb, null, 60),
  ('tccb_hop_dong_lao_dong', 'nhan_su', 'Nhân sự', 'person', '[]'::jsonb, null, 30),
  ('tccb_hop_dong_lao_dong', 'so_hop_dong', 'Số hợp đồng / phụ lục', 'text', '[]'::jsonb, null, 40),
  ('tccb_hop_dong_lao_dong', 'loai_hop_dong', 'Loại hợp đồng', 'select',
    '["Không xác định thời hạn","Xác định thời hạn","Phụ lục hợp đồng","Khác"]'::jsonb, null, 50),
  ('tccb_hop_dong_lao_dong', 'ngay_ky', 'Ngày ký', 'date', '[]'::jsonb, null, 60),
  ('tccb_hop_dong_lao_dong', 'ngay_hieu_luc', 'Ngày hiệu lực', 'date', '[]'::jsonb, null, 70),
  ('tccb_hop_dong_lao_dong', 'thoi_han', 'Thời hạn', 'text', '[]'::jsonb, 'Ví dụ: 12 tháng, 36 tháng.', 80),
  ('tccb_hop_dong_lao_dong', 'ngay_het_han', 'Ngày hết hạn', 'date', '[]'::jsonb, null, 90),
  ('tccb_hop_dong_lao_dong', 'vi_tri_viec_lam', 'Vị trí việc làm', 'text', '[]'::jsonb, null, 100),
  ('tccb_hop_dong_lao_dong', 'tinh_trang_ky', 'Tình trạng', 'select', '["Dự thảo","Đã ký","Hết hạn","Đã chấm dứt"]'::jsonb, null, 110),
  ('tccb_bien_dong_nhan_su', 'nhan_su', 'Nhân sự', 'person', '[]'::jsonb, null, 30),
  ('tccb_bien_dong_nhan_su', 'hinh_thuc_bien_dong', 'Hình thức biến động', 'select',
    ('["Tuyển dụng","Bổ nhiệm","Bổ nhiệm lại","Điều động","Luân chuyển","Thôi việc, nghỉ hưu","K' || 'hác"]')::jsonb, null, 40),
  ('tccb_bien_dong_nhan_su', 'vi_tri_truoc', 'Vị trí trước', 'text', '[]'::jsonb, null, 50),
  ('tccb_bien_dong_nhan_su', 'vi_tri_sau', 'Vị trí sau', 'text', '[]'::jsonb, null, 60),
  ('tccb_bien_dong_nhan_su', 'so_quyet_dinh', 'Số quyết định', 'text', '[]'::jsonb, null, 70),
  ('tccb_bien_dong_nhan_su', 'ngay_ky', 'Ngày ký', 'date', '[]'::jsonb, null, 80),
  ('tccb_bien_dong_nhan_su', 'ngay_hieu_luc', 'Ngày hiệu lực', 'date', '[]'::jsonb, null, 90),
  ('tccb_bien_dong_nhan_su', 'cap_quyet_dinh', 'Cấp quyết định', 'text', '[]'::jsonb, null, 100),
  ('tccb_bien_dong_nhan_su', 'tinh_trang', 'Tình trạng', 'select', '["Dự thảo","Đã ban hành","Đã thực hiện","Đã hủy"]'::jsonb, null, 110),
  ('tccb_danh_gia_khen_thuong_ky_luat', 'phan_loai', 'Phân loại', 'select', '["Đánh giá, xếp loại","Khen thưởng","Kỷ luật"]'::jsonb, null, 30),
  ('tccb_danh_gia_khen_thuong_ky_luat', 'doi_tuong', 'Cá nhân / tập thể', 'text', '[]'::jsonb, null, 40),
  ('tccb_danh_gia_khen_thuong_ky_luat', 'nhan_su', 'Nhân sự (nếu là cá nhân)', 'person', '[]'::jsonb, null, 50),
  ('tccb_danh_gia_khen_thuong_ky_luat', 'ky_nam', 'Kỳ / năm', 'text', '[]'::jsonb, null, 60),
  ('tccb_danh_gia_khen_thuong_ky_luat', 'ket_qua_xep_loai', 'Kết quả xếp loại', 'select',
    ('["Hoàn thành xuất sắc nhiệm vụ","Hoàn thành tốt nhiệm vụ","Hoàn thành nhiệm vụ","Không hoà' || 'n thành nhiệm vụ"]')::jsonb, null, 70),
  ('tccb_danh_gia_khen_thuong_ky_luat', 'hinh_thuc', 'Hình thức khen thưởng / kỷ luật', 'text', '[]'::jsonb, null, 80),
  ('tccb_danh_gia_khen_thuong_ky_luat', 'so_van_ban', 'Số văn bản', 'text', '[]'::jsonb, null, 90),
  ('tccb_danh_gia_khen_thuong_ky_luat', 'ngay_van_ban', 'Ngày văn bản', 'date', '[]'::jsonb, null, 100),
  ('tccb_danh_gia_khen_thuong_ky_luat', 'cap_quyet_dinh', 'Cấp quyết định', 'text', '[]'::jsonb, null, 110),
  ('tccb_danh_gia_khen_thuong_ky_luat', 'nguoi_tong_hop', 'Người tổng hợp', 'person', '[]'::jsonb, null, 120);

-- 6. Tạo version form
do $forms$
declare
  item record;
  old_form public.db_form_definitions%rowtype;
  new_form_id uuid;
begin
  for item in select * from p3_types loop
    old_form := null;

    select f.* into old_form
    from public.db_form_definitions f
    join public.db_record_types t on t.id = f.record_type_id
    where t.code = item.type_code
      and f.status = 'published'
    order by f.version desc
    limit 1;

    if item.kind <> 'new' and old_form.id is null then
      raise exception 'published source form missing for %', item.type_code;
    end if;

    if old_form.id is not null then
      update public.db_form_definitions
      set status = 'retired'
      where id = old_form.id;
    end if;

    insert into public.db_form_definitions (
      record_type_id, version, status, search_config, display_config
    ) values (
      (select id from public.db_record_types where code = item.type_code),
      coalesce((
        select max(f.version)
        from public.db_form_definitions f
        join public.db_record_types t on t.id = f.record_type_id
        where t.code = item.type_code
      ), 0) + 1,
      'published',
      case when item.search_fields is null then old_form.search_config
           else jsonb_build_object('fields', item.search_fields) end,
      coalesce(old_form.display_config, '{"columns":["record_code","title","status","updated_at"]}'::jsonb)
    ) returning id into new_form_id;

    if old_form.id is not null then
      insert into public.db_form_fields (
        form_definition_id, field_key, label, data_type, required, searchable,
        options, validation, hidden, sort_order
      )
      select
        new_form_id,
        src.field_key,
        src.label,
        src.data_type,
        case when item.kind = 'light' then src.required else false end,
        src.searchable,
        case
          when item.kind = 'light' then src.options
          when src.data_type in ('select', 'multi_select') then src.options
          else '[]'::jsonb
        end,
        src.validation,
        case when item.kind = 'light' then src.hidden else true end,
        case when item.kind = 'light' then src.sort_order else src.sort_order + 1000 end
      from public.db_form_fields src
      where src.form_definition_id = old_form.id
      on conflict (form_definition_id, field_key) do update set
        label = excluded.label,
        data_type = excluded.data_type,
        required = excluded.required,
        searchable = excluded.searchable,
        options = excluded.options,
        validation = excluded.validation,
        hidden = excluded.hidden,
        sort_order = excluded.sort_order;
    end if;

    if item.kind = 'light' then
      update public.db_form_fields
      set data_type = 'text',
          options = '[]'::jsonb,
          validation = '{"maxLength":500}'::jsonb,
          hidden = false,
          required = false
      where form_definition_id = new_form_id
        and field_key = 'keywords';
    else
      insert into public.db_form_fields (
        form_definition_id, field_key, label, data_type, required, searchable,
        options, validation, hidden, sort_order
      ) values
        (new_form_id, 'record_code', 'Mã hồ sơ', 'text', false, false, '[]'::jsonb, '{}'::jsonb, true, 800),
        (new_form_id, 'title', item.title_label, 'text', true, true, '[]'::jsonb, '{}'::jsonb, false, 10),
        (
          new_form_id,
          'summary',
          item.summary_label,
          'long_text',
          false,
          true,
          '[]'::jsonb,
          coalesce((
            select src.validation
            from public.db_form_fields src
            where src.form_definition_id = old_form.id
              and src.field_key = 'summary'
          ), '{}'::jsonb)
            || case when item.summary_help is null then '{}'::jsonb
                    else jsonb_build_object('help', item.summary_help) end,
          false,
          20
        ),
        (
          new_form_id, 'keywords', 'Từ khóa', 'text', false, true,
          '[]'::jsonb, '{"maxLength":500}'::jsonb, false, 720
        ),
        (
          new_form_id, 'responsible_person', 'Người phụ trách', 'person', false, true,
          '[]'::jsonb, '{}'::jsonb, false, 700
        ),
        (
          new_form_id, 'status', 'Trạng thái', 'select', false, true,
          ('[{"value":"draft","label":"Nháp"},{"value":"pending_review","label":"Chờ duyệt"},{"value":' ||
    '"approved","label":"Đã duyệt"},{"value":"archived","label":"Lưu trữ"}]')::jsonb, '{}'::jsonb, false, 900
        )
      on conflict (form_definition_id, field_key) do update set
        label = excluded.label,
        data_type = excluded.data_type,
        required = excluded.required,
        searchable = excluded.searchable,
        options = excluded.options,
        validation = excluded.validation,
        hidden = excluded.hidden,
        sort_order = excluded.sort_order;

      insert into public.db_form_fields (
        form_definition_id, field_key, label, data_type, required, searchable,
        options, validation, hidden, sort_order
      )
      select
        new_form_id,
        x.field_key,
        x.label,
        x.data_type,
        false,
        true,
        case when x.data_type = 'select' then coalesce((
          select jsonb_agg(jsonb_build_object('value', option_value, 'label', option_value))
          from jsonb_array_elements_text(x.options) option_value
        ), '[]'::jsonb) else '[]'::jsonb end,
        (case when x.data_type = 'number' then '{"min":0}'::jsonb else '{}'::jsonb end)
          || case when x.help is null then '{}'::jsonb else jsonb_build_object('help', x.help) end,
        false,
        x.sort_order
      from p3_fields x
      where x.type_code = item.type_code
      on conflict (form_definition_id, field_key) do update set
        label = excluded.label,
        data_type = excluded.data_type,
        required = excluded.required,
        searchable = excluded.searchable,
        options = excluded.options,
        validation = excluded.validation,
        hidden = excluded.hidden,
        sort_order = excluded.sort_order;
    end if;

    update public.db_form_fields
    set hidden = true, required = false
    where form_definition_id = new_form_id
      and field_key = 'record_code';

    update public.db_form_fields
    set hidden = false, required = false
    where form_definition_id = new_form_id
      and field_key = 'status';
  end loop;
end
$forms$;

-- 7. Assertions
do $assert$
begin
  if exists (
    select 1
    from (values
      ('tong_hop_van_thu_luu_tru', false),
      ('tong_hop_to_chuc_can_bo', true),
      ('tong_hop_chung', false)
    ) as x(code, restricted)
    left join public.db_categories c on c.code = x.code
    left join public.db_categories p on p.id = c.parent_id
    where c.id is null
      or p.code <> 'tong_hop'
      or c.restricted <> x.restricted
      or c.active is not true
  ) then
    raise exception 'phase 3 subgroup contract invalid';
  end if;

  if exists (
    select 1
    from public.db_record_types t
    join public.db_categories c on c.id = t.category_id
    where t.code in (
      'tccb_tai_lieu_ho_so_nhan_su', 'tccb_hop_dong_lao_dong',
      'tccb_bien_dong_nhan_su', 'tccb_danh_gia_khen_thuong_ky_luat'
    )
      and (c.code <> 'tong_hop_to_chuc_can_bo' or t.active is not true)
  ) then
    raise exception 'new type contract invalid';
  end if;

  if (select count(*) from p3_types) <> 15 then
    raise exception 'phase 3 type specification count invalid';
  end if;

  if exists (
    select 1
    from p3_moves m
    join public.db_record_types t on t.code = m.type_code
    join public.db_categories c on c.code = m.category_code
    where t.category_id <> c.id
  ) then
    raise exception 'moved type category mismatch';
  end if;

  if exists (
    select 1
    from public.db_records r
    join public.db_record_types t on t.id = r.record_type_id
    where t.code in ('van_ban_den', 'van_ban_di', 'so_sach_van_thu_luu_tru', 'bieu_mau_hanh_chinh', 'bao_cao', 'bien_ban_ket_luan_hop',
    'ho_so_cong_viec_trong_tam', 'ke_hoach_cong_tac', 'phieu_giao_viec', 'van_ban_noi_bo', 'cho_phan_loai')
      and r.category_id <> t.category_id
  ) then
    raise exception 'moved record category mismatch';
  end if;

  if exists (
    select 1
    from public.db_record_types t
    left join public.db_form_definitions f
      on f.record_type_id = t.id and f.status = 'published'
    where t.code in ('van_ban_den', 'van_ban_di', 'so_sach_van_thu_luu_tru', 'bieu_mau_hanh_chinh', 'bao_cao', 'bien_ban_ket_luan_hop',
    'ho_so_cong_viec_trong_tam', 'ke_hoach_cong_tac', 'phieu_giao_viec', 'van_ban_noi_bo', 'cho_phan_loai', 'tccb_tai_lieu_ho_so_nhan_su',
    'tccb_hop_dong_lao_dong', 'tccb_bien_dong_nhan_su', 'tccb_danh_gia_khen_thuong_ky_luat')
    group by t.id
    having count(f.id) <> 1
  ) then
    raise exception 'published form count invalid';
  end if;

  if exists (
    select 1
    from public.db_form_fields x
    join public.db_form_definitions f on f.id = x.form_definition_id
    join public.db_record_types t on t.id = f.record_type_id
    where f.status = 'published'
      and t.code in ('van_ban_den', 'van_ban_di', 'so_sach_van_thu_luu_tru', 'bieu_mau_hanh_chinh', 'bao_cao', 'bien_ban_ket_luan_hop',
    'ho_so_cong_viec_trong_tam', 'ke_hoach_cong_tac', 'phieu_giao_viec', 'van_ban_noi_bo', 'cho_phan_loai', 'tccb_tai_lieu_ho_so_nhan_su',
    'tccb_hop_dong_lao_dong', 'tccb_bien_dong_nhan_su', 'tccb_danh_gia_khen_thuong_ky_luat')
      and x.field_key like '%luong%'
  ) then
    raise exception 'salary field forbidden';
  end if;
end
$assert$;

notify pgrst, 'reload schema';
commit;
