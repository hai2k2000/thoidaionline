begin;

-- CP2-B proposed optional fields. These are searchable and configurable, but
-- deliberately non-required; legal, retention and sensitive identity fields
-- remain owner-controlled and are not seeded here.
do $cp2b$
declare
  item record;
  form_id uuid;
begin
  for item in
    select t.code, f.id as form_id
    from public.db_record_types t
    join public.db_form_definitions f on f.record_type_id = t.id and f.version = 1 and f.status = 'published'
    where t.active
  loop
    form_id := item.form_id;
    if item.code in ('van_ban_den','van_ban_di','van_ban_noi_bo','quy_che_quy_dinh_quy_trinh','ke_hoach_cong_tac','bao_cao','bien_ban_ket_luan_hop','phieu_giao_viec','so_sach_van_thu_luu_tru','bieu_mau_hanh_chinh','ho_so_cong_viec_trong_tam','cho_phan_loai') then
      insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, sort_order) values
        (form_id,'reference_number','Số / mã tham chiếu','text',false,true,'[]'::jsonb,'{"maxLength":120}'::jsonb,200),
        (form_id,'effective_date','Ngày hiệu lực / ngày thực hiện','date',false,true,'[]'::jsonb,'{}'::jsonb,210),
        (form_id,'review_deadline','Hạn rà soát / hoàn thành','date',false,true,'[]'::jsonb,'{}'::jsonb,220),
        (form_id,'responsible_department','Phòng / đơn vị phụ trách','department',false,true,'[]'::jsonb,'{}'::jsonb,230),
        (form_id,'source_url','Liên kết nguồn','url',false,true,'[]'::jsonb,'{}'::jsonb,240)
      on conflict (form_definition_id, field_key) do update set label=excluded.label,data_type=excluded.data_type,required=false,searchable=excluded.searchable,options=excluded.options,validation=excluded.validation,sort_order=excluded.sort_order;
    elsif item.code in ('khach_hang_doi_tac','de_xuat_bao_gia_thuong_thao','hop_dong_nghiep_vu','san_pham_truyen_thong_hop_dong','nghiem_thu_ban_giao_thanh_ly','tai_tro_quang_cao_hop_tac','kho_thiet_ke_nhan_dien','bao_cao_thong_ke_nghiep_vu','tham_chieu_thanh_toan_quyet_toan') then
      insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, sort_order) values
        (form_id,'partner_name','Tên đối tác','text',false,true,'[]'::jsonb,'{"maxLength":240}'::jsonb,200),
        (form_id,'engagement_start','Ngày bắt đầu','date',false,true,'[]'::jsonb,'{}'::jsonb,210),
        (form_id,'engagement_end','Ngày kết thúc','date',false,true,'[]'::jsonb,'{}'::jsonb,220),
        (form_id,'media_format','Định dạng sản phẩm','select',false,true,'[{"value":"text","label":"Bài viết"},{"value":"photo","label":"Ảnh"},{"value":"video","label":"Video"},{"value":"multimedia","label":"Multimedia"}]'::jsonb,'{}'::jsonb,230),
        (form_id,'reference_url','Liên kết tham chiếu','url',false,true,'[]'::jsonb,'{}'::jsonb,240)
      on conflict (form_definition_id, field_key) do update set label=excluded.label,data_type=excluded.data_type,required=false,searchable=excluded.searchable,options=excluded.options,validation=excluded.validation,sort_order=excluded.sort_order;
    elsif item.code in ('ho_so_de_tai_tuyen_bai_chuyen_de','van_kien_tai_lieu_chi_dao_tu_lieu','ho_so_phong_van','kho_anh_video','ho_so_nhan_vat','ho_so_to_chuc_doi_tac','ho_so_su_kien','du_lieu_nen_linh_vuc','danh_ba_nghiep_vu','giai_bao_chi_san_pham_tieu_bieu') then
      insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, sort_order) values
        (form_id,'subject','Chủ đề / đề tài','text',false,true,'[]'::jsonb,'{"maxLength":500}'::jsonb,200),
        (form_id,'source_person','Nguồn / nhân vật liên hệ','person',false,true,'[]'::jsonb,'{}'::jsonb,210),
        (form_id,'activity_date','Ngày hoạt động','date',false,true,'[]'::jsonb,'{}'::jsonb,220),
        (form_id,'location','Địa điểm','text',false,true,'[]'::jsonb,'{"maxLength":240}'::jsonb,230),
        (form_id,'publication_url','Liên kết tham chiếu','url',false,true,'[]'::jsonb,'{}'::jsonb,240)
      on conflict (form_definition_id, field_key) do update set label=excluded.label,data_type=excluded.data_type,required=false,searchable=excluded.searchable,options=excluded.options,validation=excluded.validation,sort_order=excluded.sort_order;
    elsif item.code in ('ngoai_ngu_de_tai_tuyen_bai','ngoai_ngu_tai_lieu_nguon_doi_tac','ngoai_ngu_phong_van_tu_lieu','ngoai_ngu_anh_video_multimedia','ngoai_ngu_nhan_vat_to_chuc_su_kien','ngoai_ngu_danh_ba_doi_tac','ngoai_ngu_du_lieu_nen','tai_nguyen_ngon_ngu','bao_cao_nghiep_vu_ngoai_ngu') then
      insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, sort_order) values
        (form_id,'source_language','Ngôn ngữ nguồn','text',false,true,'[]'::jsonb,'{"maxLength":80}'::jsonb,200),
        (form_id,'target_language','Ngôn ngữ đích','text',false,true,'[]'::jsonb,'{"maxLength":80}'::jsonb,210),
        (form_id,'related_country','Quốc gia liên quan','country',false,true,'[]'::jsonb,'{}'::jsonb,220),
        (form_id,'terminology_topic','Chủ đề thuật ngữ','text',false,true,'[]'::jsonb,'{"maxLength":240}'::jsonb,230),
        (form_id,'reference_url','Liên kết tham chiếu','url',false,true,'[]'::jsonb,'{}'::jsonb,240)
      on conflict (form_definition_id, field_key) do update set label=excluded.label,data_type=excluded.data_type,required=false,searchable=excluded.searchable,options=excluded.options,validation=excluded.validation,sort_order=excluded.sort_order;
    else
      -- Sensitive/regulated groups get only the shared skeleton until owner approval.
      null;
    end if;
  end loop;
end
$cp2b$;

commit;
