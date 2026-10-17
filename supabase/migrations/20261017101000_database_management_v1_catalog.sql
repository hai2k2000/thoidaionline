begin;

insert into public.db_categories (code, name, department_id, sort_order)
values
  ('tong_hop', 'Phòng Tổng hợp', null, 10),
  ('truyen_thong', 'Phòng Truyền thông', null, 20),
  ('noi_dung_tieng_viet', 'Phòng Nội dung - Tổ Tiếng Việt', null, 30),
  ('ngoai_ngu', 'Các tổ Ngoại ngữ', null, 40),
  ('doan_the_quan_ly', 'Tổ chức đoàn thể và hồ sơ quản lý chuyên biệt', null, 50)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order, updated_at = now();

with type_catalog(category_code, code, name, sort_order) as (values
  ('tong_hop','van_ban_den','Văn bản đến',10),
  ('tong_hop','van_ban_di','Văn bản đi',20),
  ('tong_hop','van_ban_noi_bo','Văn bản nội bộ',30),
  ('tong_hop','quy_che_quy_dinh_quy_trinh','Quy chế, quy định, quy trình',40),
  ('tong_hop','ke_hoach_cong_tac','Kế hoạch công tác',50),
  ('tong_hop','bao_cao','Báo cáo',60),
  ('tong_hop','bien_ban_ket_luan_hop','Biên bản và kết luận họp',70),
  ('tong_hop','phieu_giao_viec','Phiếu giao việc, theo dõi nhiệm vụ',80),
  ('tong_hop','so_sach_van_thu_luu_tru','Sổ sách văn thư, lưu trữ',90),
  ('tong_hop','bieu_mau_hanh_chinh','Biểu mẫu hành chính',100),
  ('tong_hop','ho_so_cong_viec_trong_tam','Hồ sơ công việc, nhiệm vụ trọng tâm',110),
  ('tong_hop','cho_phan_loai','Dữ liệu chờ phân loại',120),
  ('truyen_thong','khach_hang_doi_tac','Khách hàng, đối tác',10),
  ('truyen_thong','de_xuat_bao_gia_thuong_thao','Đề xuất, báo giá, thương thảo',20),
  ('truyen_thong','hop_dong_nghiep_vu','Hợp đồng nghiệp vụ',30),
  ('truyen_thong','san_pham_truyen_thong_hop_dong','Sản phẩm truyền thông theo hợp đồng',40),
  ('truyen_thong','nghiem_thu_ban_giao_thanh_ly','Nghiệm thu, bàn giao, thanh lý',50),
  ('truyen_thong','tai_tro_quang_cao_hop_tac','Tài trợ, quảng cáo, hợp tác truyền thông',60),
  ('truyen_thong','kho_thiet_ke_nhan_dien','Kho thiết kế, nhận diện, tài nguyên truyền thông',70),
  ('truyen_thong','bao_cao_thong_ke_nghiep_vu','Báo cáo, thống kê nghiệp vụ',80),
  ('truyen_thong','tham_chieu_thanh_toan_quyet_toan','Nhóm tài liệu thanh toán/quyết toán tham chiếu',90),
  ('noi_dung_tieng_viet','ho_so_de_tai_tuyen_bai_chuyen_de','Hồ sơ đề tài, tuyến bài, chuyên đề',10),
  ('noi_dung_tieng_viet','van_kien_tai_lieu_chi_dao_tu_lieu','Văn kiện, tài liệu chỉ đạo và tư liệu nguồn',20),
  ('noi_dung_tieng_viet','ho_so_phong_van','Hồ sơ phỏng vấn',30),
  ('noi_dung_tieng_viet','kho_anh_video','Kho ảnh, video',40),
  ('noi_dung_tieng_viet','ho_so_nhan_vat','Hồ sơ nhân vật',50),
  ('noi_dung_tieng_viet','ho_so_to_chuc_doi_tac','Hồ sơ tổ chức, đối tác',60),
  ('noi_dung_tieng_viet','ho_so_su_kien','Hồ sơ sự kiện',70),
  ('noi_dung_tieng_viet','du_lieu_nen_linh_vuc','Dữ liệu nền theo lĩnh vực',80),
  ('noi_dung_tieng_viet','danh_ba_nghiep_vu','Danh bạ nghiệp vụ',90),
  ('noi_dung_tieng_viet','giai_bao_chi_san_pham_tieu_bieu','Hồ sơ giải báo chí và sản phẩm tiêu biểu',100),
  ('ngoai_ngu','ngoai_ngu_de_tai_tuyen_bai','Hồ sơ đề tài, tuyến bài, chuyên đề',10),
  ('ngoai_ngu','ngoai_ngu_tai_lieu_nguon_doi_tac','Tài liệu nguồn và tài liệu đối tác',20),
  ('ngoai_ngu','ngoai_ngu_phong_van_tu_lieu','Phỏng vấn và tư liệu liên quan',30),
  ('ngoai_ngu','ngoai_ngu_anh_video_multimedia','Ảnh, video, multimedia',40),
  ('ngoai_ngu','ngoai_ngu_nhan_vat_to_chuc_su_kien','Hồ sơ nhân vật, tổ chức, sự kiện, văn kiện',50),
  ('ngoai_ngu','ngoai_ngu_danh_ba_doi_tac','Danh bạ đối tác, chuyên gia, cộng tác viên',60),
  ('ngoai_ngu','ngoai_ngu_du_lieu_nen','Dữ liệu nền, chuyên mục trọng điểm',70),
  ('ngoai_ngu','tai_nguyen_ngon_ngu','Tài nguyên ngôn ngữ, thuật ngữ, quy chuẩn',80),
  ('ngoai_ngu','bao_cao_nghiep_vu_ngoai_ngu','Báo cáo nghiệp vụ',90),
  ('doan_the_quan_ly','ho_so_dang','Hồ sơ Đảng',10),
  ('doan_the_quan_ly','chi_hoi_nha_bao','Chi hội Nhà báo',20),
  ('doan_the_quan_ly','doan_thanh_nien','Đoàn Thanh niên',30),
  ('doan_the_quan_ly','giay_phep_quan_ly_bao_chi','Giấy phép, hồ sơ quản lý hoạt động báo chí',40)
)
insert into public.db_record_types (category_id, code, name, description, active)
select c.id, t.code, t.name,
  case when c.code = 'doan_the_quan_ly' then 'Nhóm hạn chế; mặc định deny nếu chưa có ACL.' else 'Danh mục Database Management V1.' end,
  true
from type_catalog t join public.db_categories c on c.code = t.category_code
on conflict (code) do update set category_id = excluded.category_id, name = excluded.name, description = excluded.description, active = true, updated_at = now();

do $forms$
declare
  record_type record;
  form_id uuid;
begin
  for record_type in select id from public.db_record_types where active = true loop
    insert into public.db_form_definitions(record_type_id, version, status, search_config, display_config)
    values (record_type.id, 1, 'published', '{"fields":["record_code","title","summary","issued_date","organization","responsible_person","status","archive_location","keywords"]}'::jsonb, '{"columns":["record_code","title","status","updated_at"]}'::jsonb)
    on conflict (record_type_id, version) do update set status = 'published', search_config = excluded.search_config, display_config = excluded.display_config
    returning id into form_id;
    if form_id is null then select id into form_id from public.db_form_definitions where record_type_id = record_type.id and version = 1; end if;
    insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, sort_order)
    values
      (form_id,'record_code','Mã hồ sơ','text',true,true,'[]'::jsonb,'{"maxLength":120}'::jsonb,10),
      (form_id,'title','Tên hồ sơ / trích yếu','text',true,true,'[]'::jsonb,'{"maxLength":500}'::jsonb,20),
      (form_id,'summary','Mô tả tóm tắt','long_text',false,true,'[]'::jsonb,'{"maxLength":5000}'::jsonb,30),
      (form_id,'issued_date','Ngày ban hành / ngày tạo','date',false,true,'[]'::jsonb,'{}'::jsonb,40),
      (form_id,'organization','Cơ quan, tổ chức, đối tác','text',false,true,'[]'::jsonb,'{"maxLength":240}'::jsonb,50),
      (form_id,'responsible_person','Người phụ trách','person',false,true,'[]'::jsonb,'{}'::jsonb,60),
      (form_id,'status','Trạng thái','select',true,true,'[{"value":"draft","label":"Nháp"},{"value":"pending_review","label":"Chờ duyệt"},{"value":"approved","label":"Đã duyệt"},{"value":"archived","label":"Lưu trữ"}]'::jsonb,'{}'::jsonb,70),
      (form_id,'archive_location','Vị trí hồ sơ giấy','text',false,true,'[]'::jsonb,'{"maxLength":240}'::jsonb,80),
      (form_id,'keywords','Từ khóa','multi_select',false,true,'[]'::jsonb,'{"maxItems":50}'::jsonb,90)
    on conflict (form_definition_id, field_key) do update set label = excluded.label, data_type = excluded.data_type, required = excluded.required, searchable = excluded.searchable, options = excluded.options, validation = excluded.validation, sort_order = excluded.sort_order;
  end loop;
end
$forms$;

-- CP2: only fields explicitly described by the approved acceptance brief are
-- specialized here. Other record types keep the common skeleton until their
-- business field contract is confirmed by the owner.
do $specialized$
declare
  item record;
  form_id uuid;
begin
  for item in
    select t.code, f.id as form_id
    from public.db_record_types t
    join public.db_form_definitions f on f.record_type_id = t.id and f.version = 1 and f.status = 'published'
    where t.code in ('van_ban_den', 'hop_dong_nghiep_vu', 'ho_so_su_kien')
  loop
    form_id := item.form_id;
    if item.code = 'van_ban_den' then
      insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, sort_order) values
        (form_id, 'document_number', 'Số / ký hiệu', 'text', false, true, '[]'::jsonb, '{"maxLength":120}'::jsonb, 100),
        (form_id, 'sender_organization', 'Cơ quan gửi', 'text', false, true, '[]'::jsonb, '{"maxLength":240}'::jsonb, 110),
        (form_id, 'received_date', 'Ngày nhận', 'date', false, true, '[]'::jsonb, '{}'::jsonb, 120),
        (form_id, 'issued_date_source', 'Ngày ban hành', 'date', false, true, '[]'::jsonb, '{}'::jsonb, 130),
        (form_id, 'handler', 'Người xử lý', 'person', false, true, '[]'::jsonb, '{}'::jsonb, 140),
        (form_id, 'processing_deadline', 'Hạn xử lý', 'date', false, true, '[]'::jsonb, '{}'::jsonb, 150),
        (form_id, 'original_location', 'Vị trí bản gốc', 'text', false, true, '[]'::jsonb, '{"maxLength":240}'::jsonb, 160)
      on conflict (form_definition_id, field_key) do update set label = excluded.label, data_type = excluded.data_type, searchable = excluded.searchable, validation = excluded.validation, sort_order = excluded.sort_order;
    elsif item.code = 'hop_dong_nghiep_vu' then
      insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, sort_order) values
        (form_id, 'partner', 'Đối tác', 'text', false, true, '[]'::jsonb, '{"maxLength":240}'::jsonb, 100),
        (form_id, 'contract_number', 'Số hợp đồng', 'text', false, true, '[]'::jsonb, '{"maxLength":120}'::jsonb, 110),
        (form_id, 'signed_date', 'Ngày ký', 'date', false, true, '[]'::jsonb, '{}'::jsonb, 120),
        (form_id, 'term_end_date', 'Thời hạn đến', 'date', false, true, '[]'::jsonb, '{}'::jsonb, 130),
        (form_id, 'owner_person', 'Người phụ trách', 'person', false, true, '[]'::jsonb, '{}'::jsonb, 140),
        (form_id, 'scope', 'Phạm vi công việc', 'long_text', false, true, '[]'::jsonb, '{"maxLength":5000}'::jsonb, 150),
        (form_id, 'execution_status', 'Tình trạng thực hiện', 'select', false, true, '[{"value":"draft","label":"Dự thảo"},{"value":"active","label":"Đang thực hiện"},{"value":"completed","label":"Hoàn thành"},{"value":"terminated","label":"Chấm dứt"}]'::jsonb, '{}'::jsonb, 160)
      on conflict (form_definition_id, field_key) do update set label = excluded.label, data_type = excluded.data_type, searchable = excluded.searchable, options = excluded.options, validation = excluded.validation, sort_order = excluded.sort_order;
    else
      insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, sort_order) values
        (form_id, 'event_name', 'Tên sự kiện', 'text', false, true, '[]'::jsonb, '{"maxLength":500}'::jsonb, 100),
        (form_id, 'event_datetime', 'Thời gian', 'datetime', false, true, '[]'::jsonb, '{}'::jsonb, 110),
        (form_id, 'event_location', 'Địa điểm', 'text', false, true, '[]'::jsonb, '{"maxLength":240}'::jsonb, 120),
        (form_id, 'organizer_department', 'Đơn vị tổ chức', 'department', false, true, '[]'::jsonb, '{}'::jsonb, 130),
        (form_id, 'related_country', 'Quốc gia liên quan', 'country', false, true, '[]'::jsonb, '{}'::jsonb, 140),
        (form_id, 'participants', 'Nhân vật tham gia', 'multi_select', false, true, '[]'::jsonb, '{"maxItems":100}'::jsonb, 150),
        (form_id, 'materials', 'Tư liệu / tài liệu', 'long_text', false, true, '[]'::jsonb, '{"maxLength":5000}'::jsonb, 160),
        (form_id, 'related_activities', 'Hoạt động liên quan', 'long_text', false, true, '[]'::jsonb, '{"maxLength":5000}'::jsonb, 170)
      on conflict (form_definition_id, field_key) do update set label = excluded.label, data_type = excluded.data_type, searchable = excluded.searchable, validation = excluded.validation, sort_order = excluded.sort_order;
    end if;
  end loop;
end
$specialized$;

commit;
