begin;

alter table public.db_form_fields
  add column if not exists hidden boolean not null default false;

alter table public.db_records drop constraint if exists db_records_language_code_check;
alter table public.db_records add constraint db_records_language_code_check
  check (language_code is null or language_code in ('vi', 'en', 'zh', 'lo', 'km', 'ru'));

insert into public.db_categories (code, name, parent_id, department_id, sort_order)
select 'noi_dung_tieng_nga', 'Tổ Tiếng Nga', parent.id, null, 60
from public.db_categories parent
where parent.code = 'phong_noi_dung'
on conflict (code) do update set name = excluded.name, parent_id = excluded.parent_id, active = true, updated_at = now();

insert into public.db_record_types (category_id, code, name, description, active, sort_order)
select category.id, item.code, item.name, 'Danh mục Database Management V1.', true, item.sort_order
from public.db_categories category
cross join (values
  ('ngoai_ngu_ho_so_su_kien', 'Hồ sơ sự kiện', 50),
  ('ngoai_ngu_ho_so_van_kien', 'Hồ sơ văn kiện', 60)
) item(code, name, sort_order)
where category.code = 'ngoai_ngu'
on conflict (code) do update set category_id = excluded.category_id, name = excluded.name, active = true, sort_order = excluded.sort_order, updated_at = now();

update public.db_record_types set name = case code
  when 'ngoai_ngu_anh_video_multimedia' then 'Ảnh, video, multimedia'
  when 'bao_cao_nghiep_vu_ngoai_ngu' then 'Báo cáo nghiệp vụ'
  when 'ngoai_ngu_danh_ba_doi_tac' then 'Nhân vật, đối tác, chuyên gia, cộng tác viên'
  when 'ngoai_ngu_nhan_vat_to_chuc_su_kien' then 'Hồ sơ tổ chức'
  when 'ngoai_ngu_de_tai_tuyen_bai' then 'Hồ sơ đề tài, tuyến bài, chuyên đề'
  when 'ngoai_ngu_du_lieu_nen' then 'Dữ liệu nền, chuyên mục trọng điểm'
  when 'ngoai_ngu_phong_van_tu_lieu' then 'Phỏng vấn và tư liệu liên quan'
  when 'ngoai_ngu_tai_lieu_nguon_doi_tac' then 'Tài liệu nguồn và tài liệu đối tác'
  when 'tai_nguyen_ngon_ngu' then 'Tài nguyên ngôn ngữ, thuật ngữ, quy chuẩn'
  else name end,
  sort_order = case code
    when 'ngoai_ngu_anh_video_multimedia' then 10
    when 'bao_cao_nghiep_vu_ngoai_ngu' then 20
    when 'ngoai_ngu_danh_ba_doi_tac' then 30
    when 'ngoai_ngu_nhan_vat_to_chuc_su_kien' then 40
    when 'ngoai_ngu_ho_so_su_kien' then 50
    when 'ngoai_ngu_ho_so_van_kien' then 60
    when 'ngoai_ngu_de_tai_tuyen_bai' then 70
    when 'ngoai_ngu_du_lieu_nen' then 80
    when 'ngoai_ngu_phong_van_tu_lieu' then 90
    when 'ngoai_ngu_tai_lieu_nguon_doi_tac' then 100
    when 'tai_nguyen_ngon_ngu' then 110
    else sort_order end,
  updated_at = now()
where code in ('ngoai_ngu_anh_video_multimedia','bao_cao_nghiep_vu_ngoai_ngu','ngoai_ngu_danh_ba_doi_tac','ngoai_ngu_nhan_vat_to_chuc_su_kien','ngoai_ngu_ho_so_su_kien','ngoai_ngu_ho_so_van_kien','ngoai_ngu_de_tai_tuyen_bai','ngoai_ngu_du_lieu_nen','ngoai_ngu_phong_van_tu_lieu','ngoai_ngu_tai_lieu_nguon_doi_tac','tai_nguyen_ngon_ngu');

do $forms$
declare
  item record;
  form_id uuid;
  base record;
begin
  for item in select * from (values
    ('ngoai_ngu_anh_video_multimedia'), ('bao_cao_nghiep_vu_ngoai_ngu'), ('ngoai_ngu_danh_ba_doi_tac'),
    ('ngoai_ngu_nhan_vat_to_chuc_su_kien'), ('ngoai_ngu_ho_so_su_kien'), ('ngoai_ngu_ho_so_van_kien'),
    ('ngoai_ngu_de_tai_tuyen_bai'), ('ngoai_ngu_du_lieu_nen'), ('ngoai_ngu_phong_van_tu_lieu'),
    ('ngoai_ngu_tai_lieu_nguon_doi_tac'), ('tai_nguyen_ngon_ngu')
  ) types(code) loop
    insert into public.db_form_definitions(record_type_id, version, status, search_config, display_config)
    select id, 1, 'published', '{"fields":["record_code","title"]}'::jsonb, '{"columns":["record_code","title","status","updated_at"]}'::jsonb
    from public.db_record_types where code = item.code
    on conflict (record_type_id, version) do update set status = 'published'
    returning id into form_id;
    if form_id is null then select f.id into form_id from public.db_form_definitions f join public.db_record_types t on t.id = f.record_type_id where t.code = item.code and f.version = 1; end if;

    update public.db_form_fields
    set hidden = true, required = false, sort_order = case when sort_order < 900 then 900 + sort_order else sort_order end
    where form_definition_id = form_id;

    for base in select * from (values
      ('record_code','Mã hồ sơ','text',10), ('title','Tên hồ sơ / trích yếu','text',20), ('summary','Mô tả tóm tắt','long_text',30),
      ('issued_date','Ngày ban hành / ngày tạo','date',40), ('organization','Cơ quan / tổ chức','text',50), ('responsible_person','Người phụ trách','text',60),
      ('status','Trạng thái','select',70), ('archive_location','Vị trí lưu trữ','text',80), ('keywords','Từ khóa','text',90),
      ('source_language','Ngôn ngữ nguồn','text',100), ('target_language','Ngôn ngữ đích','text',110), ('related_country','Quốc gia liên quan','country',120),
      ('terminology_topic','Chủ đề thuật ngữ','text',130), ('reference_url','Liên kết tham chiếu','url',140)
    ) fields(field_key,label,data_type,sort_order) loop
      insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, hidden, sort_order)
      values (form_id, base.field_key, base.label, base.data_type, base.field_key = 'title', true, '[]'::jsonb, '{}'::jsonb, true, 900 + base.sort_order)
      on conflict (form_definition_id, field_key) do update set label=excluded.label, data_type=excluded.data_type, required=excluded.required, searchable=excluded.searchable, options=excluded.options, validation=excluded.validation, hidden=excluded.hidden, sort_order=excluded.sort_order;
    end loop;

    insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, hidden, sort_order)
    select form_id, x.field_key,
      case when item.code = 'ngoai_ngu_nhan_vat_to_chuc_su_kien' and x.field_key = 'address' then 'Địa chỉ / trụ sở' else x.label end,
      x.data_type, false, true, x.options, x.validation, false, x.sort_order
    from (values
      ('contact_type','Loại đối tượng','select','[{"value":"Nhân vật","label":"Nhân vật"},{"value":"Đối tác","label":"Đối tác"},{"value":"Chuyên gia","label":"Chuyên gia"},{"value":"Cộng tác viên","label":"Cộng tác viên"},{"value":"Cơ quan báo chí","label":"Cơ quan báo chí"},{"value":"Cơ quan ngoại giao","label":"Cơ quan ngoại giao"},{"value":"Tổ chức","label":"Tổ chức"}]'::jsonb,'{}'::jsonb,150),
      ('position','Chức danh / chức vụ','text','[]'::jsonb,'{}'::jsonb,160), ('phone','Số điện thoại','text','[]'::jsonb,'{}'::jsonb,170), ('email','Email','text','[]'::jsonb,'{}'::jsonb,180), ('address','Địa chỉ','text','[]'::jsonb,'{}'::jsonb,190), ('contact_language','Ngôn ngữ giao tiếp','text','[]'::jsonb,'{}'::jsonb,200),
      ('org_type','Loại hình tổ chức','text','[]'::jsonb,'{}'::jsonb,150), ('founded_year','Năm thành lập','number','[]'::jsonb,'{}'::jsonb,160), ('leader','Người đứng đầu','text','[]'::jsonb,'{}'::jsonb,200),
      ('event_type','Loại hình sự kiện','text','[]'::jsonb,'{}'::jsonb,30), ('event_location','Địa điểm','text','[]'::jsonb,'{}'::jsonb,50), ('co_organizer','Đơn vị phối hợp','text','[]'::jsonb,'{}'::jsonb,70), ('participants','Nhân vật / đại biểu tham dự','long_text','[]'::jsonb,'{}'::jsonb,80), ('event_result','Kết quả sự kiện','long_text','[]'::jsonb,'{}'::jsonb,100),
      ('document_type','Loại văn kiện','text','[]'::jsonb,'{}'::jsonb,30), ('document_number','Số, ký hiệu','text','[]'::jsonb,'{}'::jsonb,40), ('effective_date','Ngày có hiệu lực','date','[]'::jsonb,'{}'::jsonb,70),
      ('work_type','Loại hình','select','[{"value":"Đề tài","label":"Đề tài"},{"value":"Tuyến bài","label":"Tuyến bài"},{"value":"Chuyên đề","label":"Chuyên đề"},{"value":"Loạt bài","label":"Loạt bài"},{"value":"Dự án truyền thông","label":"Dự án truyền thông"}]'::jsonb,'{}'::jsonb,30), ('start_date','Ngày bắt đầu','date','[]'::jsonb,'{}'::jsonb,50), ('due_date','Hạn hoàn thành','date','[]'::jsonb,'{}'::jsonb,60), ('team','Nhân sự thực hiện (phóng viên, biên tập viên, cộng tác viên)','long_text','[]'::jsonb,'{}'::jsonb,70), ('outputs','Sản phẩm đầu ra','long_text','[]'::jsonb,'{}'::jsonb,80),
      ('data_kind','Loại dữ liệu','select','[{"value":"Dữ liệu nền","label":"Dữ liệu nền"},{"value":"Hồ sơ chuyên đề","label":"Hồ sơ chuyên đề"},{"value":"Chuyên mục trọng điểm","label":"Chuyên mục trọng điểm"},{"value":"Bộ tư liệu tham khảo","label":"Bộ tư liệu tham khảo"}]'::jsonb,'{}'::jsonb,30),
      ('interviewee','Người được phỏng vấn (họ tên, chức vụ)','text','[]'::jsonb,'{}'::jsonb,30), ('interview_format','Hình thức','select','[{"value":"Trực tiếp","label":"Trực tiếp"},{"value":"Trực tuyến","label":"Trực tuyến"},{"value":"Qua văn bản","label":"Qua văn bản"}]'::jsonb,'{}'::jsonb,40),
      ('source_doc_type','Loại tài liệu','select','[{"value":"Văn bản","label":"Văn bản"},{"value":"Báo cáo","label":"Báo cáo"},{"value":"Nghiên cứu","label":"Nghiên cứu"},{"value":"Thông cáo báo chí","label":"Thông cáo báo chí"},{"value":"Ấn phẩm","label":"Ấn phẩm"},{"value":"Tài liệu hình ảnh","label":"Tài liệu hình ảnh"},{"value":"Khác","label":"Khác"}]'::jsonb,'{}'::jsonb,30), ('received_date','Ngày tiếp nhận','date','[]'::jsonb,'{}'::jsonb,50), ('usage_rights','Quyền sử dụng','select','[{"value":"Được trích dẫn","label":"Được trích dẫn"},{"value":"Được đăng tải","label":"Được đăng tải"},{"value":"Được biên tập / dịch","label":"Được biên tập / dịch"},{"value":"Chỉ tham khảo","label":"Chỉ tham khảo"}]'::jsonb,'{}'::jsonb,60),
      ('resource_type','Loại tài nguyên','select','[{"value":"Thuật ngữ","label":"Thuật ngữ"},{"value":"Từ điển","label":"Từ điển"},{"value":"Bảng đối chiếu","label":"Bảng đối chiếu"},{"value":"Quy chuẩn biên tập","label":"Quy chuẩn biên tập"},{"value":"Hướng dẫn dịch thuật","label":"Hướng dẫn dịch thuật"}]'::jsonb,'{}'::jsonb,30), ('vi_term','Thuật ngữ tiếng Việt','text','[]'::jsonb,'{}'::jsonb,40), ('standard_translation','Cách dịch chuẩn (theo ngôn ngữ của tổ)','text','[]'::jsonb,'{}'::jsonb,50)
    ) x(field_key,label,data_type,options,validation,sort_order)
    where (item.code = 'ngoai_ngu_danh_ba_doi_tac' and x.field_key in ('contact_type','position','phone','email','address','contact_language'))
       or (item.code = 'ngoai_ngu_nhan_vat_to_chuc_su_kien' and x.field_key in ('org_type','founded_year','address','email','phone','leader'))
       or (item.code = 'ngoai_ngu_ho_so_su_kien' and x.field_key in ('event_type','event_location','co_organizer','participants','event_result'))
       or (item.code = 'ngoai_ngu_ho_so_van_kien' and x.field_key in ('document_type','document_number','effective_date'))
       or (item.code = 'ngoai_ngu_de_tai_tuyen_bai' and x.field_key in ('work_type','start_date','due_date','team','outputs'))
       or (item.code = 'ngoai_ngu_du_lieu_nen' and x.field_key = 'data_kind')
       or (item.code = 'ngoai_ngu_phong_van_tu_lieu' and x.field_key in ('interviewee','interview_format'))
       or (item.code = 'ngoai_ngu_tai_lieu_nguon_doi_tac' and x.field_key in ('source_doc_type','received_date','usage_rights'))
       or (item.code = 'tai_nguyen_ngon_ngu' and x.field_key in ('resource_type','vi_term','standard_translation'))
    on conflict (form_definition_id, field_key) do update set label=excluded.label, data_type=excluded.data_type, required=false, options=excluded.options, validation=excluded.validation, hidden=false, sort_order=excluded.sort_order;

    update public.db_form_fields f set hidden = false, label = v.label, sort_order = v.sort_order, validation = case when v.field_key = 'summary' and item.code in ('ngoai_ngu_anh_video_multimedia','ngoai_ngu_danh_ba_doi_tac','ngoai_ngu_ho_so_van_kien','ngoai_ngu_phong_van_tu_lieu') then jsonb_build_object('help', v.help) else '{}'::jsonb end
    from (values
      ('title','Tên / trích yếu',10,null), ('summary','Mô tả',20,null), ('issued_date','Ngày tạo',30,null), ('responsible_person','Người phụ trách',40,null), ('terminology_topic','Chủ đề',50,null), ('target_language','Ngôn ngữ đích',60,null), ('related_country','Quốc gia liên quan',70,null), ('reference_url','Liên kết / đường dẫn lưu trữ tệp',80,null), ('keywords','Từ khóa',90,null),
      ('organization','Phòng ban nhận báo cáo',50,null), ('source_language','Ngôn ngữ văn bản gốc',80,null), ('effective_date','Ngày có hiệu lực',70,null)
    ) v(field_key,label,sort_order,help) where f.form_definition_id = form_id and f.field_key = v.field_key and ((item.code='ngoai_ngu_anh_video_multimedia' and v.field_key in ('title','summary','issued_date','responsible_person','terminology_topic','target_language','related_country','reference_url','keywords')) or (item.code='bao_cao_nghiep_vu_ngoai_ngu' and v.field_key in ('title','summary','issued_date','responsible_person','organization','reference_url','keywords')) or (item.code='ngoai_ngu_danh_ba_doi_tac' and v.field_key in ('title','summary','organization','related_country','terminology_topic','responsible_person','reference_url','keywords')) or (item.code='ngoai_ngu_nhan_vat_to_chuc_su_kien' and v.field_key in ('title','organization','related_country','terminology_topic','summary','reference_url','responsible_person','keywords')) or (item.code='ngoai_ngu_de_tai_tuyen_bai' and v.field_key in ('title','terminology_topic','responsible_person','summary','related_country','reference_url','keywords')) or (item.code='ngoai_ngu_du_lieu_nen' and v.field_key in ('title','summary','issued_date','terminology_topic','related_country','responsible_person','reference_url','keywords')) or (item.code='ngoai_ngu_phong_van_tu_lieu' and v.field_key in ('title','issued_date','organization','summary','terminology_topic','responsible_person','reference_url','keywords')) or (item.code='ngoai_ngu_tai_lieu_nguon_doi_tac' and v.field_key in ('title','summary','organization','issued_date','source_language','related_country','responsible_person','reference_url','keywords')) or (item.code='tai_nguyen_ngon_ngu' and v.field_key in ('title','summary','source_language','target_language','terminology_topic','responsible_person','reference_url','keywords')) or (item.code='ngoai_ngu_ho_so_su_kien' and v.field_key in ('title','event_type','issued_date','event_location','related_country','organization','co_organizer','participants','summary','event_result','responsible_person','reference_url','keywords')) or (item.code='ngoai_ngu_ho_so_van_kien' and v.field_key in ('title','document_type','document_number','organization','issued_date','effective_date','summary','source_language','related_country','responsible_person','reference_url','keywords')));

    update public.db_form_fields f
    set label = config.label,
        hidden = false,
        required = config.field_key = 'title',
        validation = case when config.help is null then '{}'::jsonb else jsonb_build_object('help', config.help) end,
        sort_order = config.sort_order
    from (values
      ('ngoai_ngu_anh_video_multimedia','title','Tên / trích yếu',10,null), ('ngoai_ngu_anh_video_multimedia','summary','Mô tả',20,'Nội dung, nhân vật, địa điểm, thời điểm ghi hình'), ('ngoai_ngu_anh_video_multimedia','issued_date','Ngày tạo',30,null), ('ngoai_ngu_anh_video_multimedia','responsible_person','Người phụ trách',40,null), ('ngoai_ngu_anh_video_multimedia','terminology_topic','Chủ đề',50,null), ('ngoai_ngu_anh_video_multimedia','target_language','Ngôn ngữ đích',60,null), ('ngoai_ngu_anh_video_multimedia','related_country','Quốc gia liên quan',70,null), ('ngoai_ngu_anh_video_multimedia','reference_url','Liên kết / đường dẫn lưu trữ tệp',80,null), ('ngoai_ngu_anh_video_multimedia','keywords','Từ khóa',90,null),
      ('bao_cao_nghiep_vu_ngoai_ngu','title','Tên báo cáo',10,null), ('bao_cao_nghiep_vu_ngoai_ngu','summary','Mô tả',20,null), ('bao_cao_nghiep_vu_ngoai_ngu','issued_date','Ngày báo cáo',30,null), ('bao_cao_nghiep_vu_ngoai_ngu','responsible_person','Người phụ trách',40,null), ('bao_cao_nghiep_vu_ngoai_ngu','organization','Phòng ban nhận báo cáo',50,null), ('bao_cao_nghiep_vu_ngoai_ngu','reference_url','Liên kết / đường dẫn lưu trữ tệp',60,null), ('bao_cao_nghiep_vu_ngoai_ngu','keywords','Từ khóa',70,null),
      ('ngoai_ngu_danh_ba_doi_tac','title','Họ và tên / Tên tổ chức',10,null), ('ngoai_ngu_danh_ba_doi_tac','summary','Thông tin giới thiệu / tiểu sử',20,'Ảnh chân dung đính kèm ở mục Tệp'), ('ngoai_ngu_danh_ba_doi_tac','organization','Cơ quan / đơn vị công tác',30,null), ('ngoai_ngu_danh_ba_doi_tac','related_country','Quốc tịch / quốc gia',40,null), ('ngoai_ngu_danh_ba_doi_tac','terminology_topic','Lĩnh vực chuyên môn',50,null), ('ngoai_ngu_danh_ba_doi_tac','responsible_person','Người phụ trách liên hệ',60,null), ('ngoai_ngu_danh_ba_doi_tac','reference_url','Website',70,null), ('ngoai_ngu_danh_ba_doi_tac','keywords','Từ khóa',80,null), ('ngoai_ngu_danh_ba_doi_tac','contact_type','Loại đối tượng',90,null), ('ngoai_ngu_danh_ba_doi_tac','position','Chức danh / chức vụ',100,null), ('ngoai_ngu_danh_ba_doi_tac','phone','Số điện thoại',110,null), ('ngoai_ngu_danh_ba_doi_tac','email','Email',120,null), ('ngoai_ngu_danh_ba_doi_tac','address','Địa chỉ',130,null), ('ngoai_ngu_danh_ba_doi_tac','contact_language','Ngôn ngữ giao tiếp',140,null),
      ('ngoai_ngu_nhan_vat_to_chuc_su_kien','title','Tên tổ chức',10,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','organization','Tên viết tắt',20,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','related_country','Quốc gia',30,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','terminology_topic','Lĩnh vực hoạt động',40,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','summary','Chức năng, nhiệm vụ / giới thiệu',50,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','reference_url','Website',60,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','responsible_person','Người phụ trách',70,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','keywords','Từ khóa',80,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','org_type','Loại hình tổ chức',90,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','founded_year','Năm thành lập',100,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','address','Địa chỉ / trụ sở',110,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','email','Email',120,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','phone','Số điện thoại',130,null), ('ngoai_ngu_nhan_vat_to_chuc_su_kien','leader','Người đứng đầu',140,null),
      ('ngoai_ngu_ho_so_su_kien','title','Tên sự kiện',10,null), ('ngoai_ngu_ho_so_su_kien','event_type','Loại hình sự kiện',20,null), ('ngoai_ngu_ho_so_su_kien','issued_date','Thời gian tổ chức',30,null), ('ngoai_ngu_ho_so_su_kien','event_location','Địa điểm',40,null), ('ngoai_ngu_ho_so_su_kien','related_country','Quốc gia liên quan',50,null), ('ngoai_ngu_ho_so_su_kien','organization','Đơn vị tổ chức',60,null), ('ngoai_ngu_ho_so_su_kien','co_organizer','Đơn vị phối hợp',70,null), ('ngoai_ngu_ho_so_su_kien','participants','Nhân vật / đại biểu tham dự',80,null), ('ngoai_ngu_ho_so_su_kien','summary','Nội dung chính',90,null), ('ngoai_ngu_ho_so_su_kien','event_result','Kết quả sự kiện',100,null), ('ngoai_ngu_ho_so_su_kien','responsible_person','Người phụ trách',110,null), ('ngoai_ngu_ho_so_su_kien','reference_url','Liên kết',120,null), ('ngoai_ngu_ho_so_su_kien','keywords','Từ khóa',130,null),
      ('ngoai_ngu_ho_so_van_kien','title','Tên văn kiện',10,null), ('ngoai_ngu_ho_so_van_kien','document_type','Loại văn kiện',20,null), ('ngoai_ngu_ho_so_van_kien','document_number','Số, ký hiệu',30,null), ('ngoai_ngu_ho_so_van_kien','organization','Cơ quan ban hành',40,null), ('ngoai_ngu_ho_so_van_kien','issued_date','Ngày ký',50,null), ('ngoai_ngu_ho_so_van_kien','effective_date','Ngày có hiệu lực',60,null), ('ngoai_ngu_ho_so_van_kien','summary','Nội dung tóm tắt',70,'File văn bản gốc / bản dịch đính kèm ở mục Tệp'), ('ngoai_ngu_ho_so_van_kien','source_language','Ngôn ngữ văn bản gốc',80,null), ('ngoai_ngu_ho_so_van_kien','related_country','Quốc gia liên quan',90,null), ('ngoai_ngu_ho_so_van_kien','responsible_person','Người phụ trách',100,null), ('ngoai_ngu_ho_so_van_kien','reference_url','Liên kết',110,null), ('ngoai_ngu_ho_so_van_kien','keywords','Từ khóa',120,null),
      ('ngoai_ngu_de_tai_tuyen_bai','title','Tên đề tài / tuyến bài / chuyên đề',10,null), ('ngoai_ngu_de_tai_tuyen_bai','terminology_topic','Chủ đề / lĩnh vực',20,null), ('ngoai_ngu_de_tai_tuyen_bai','responsible_person','Biên tập viên phụ trách',30,null), ('ngoai_ngu_de_tai_tuyen_bai','summary','Mô tả',40,null), ('ngoai_ngu_de_tai_tuyen_bai','related_country','Quốc gia liên quan',50,null), ('ngoai_ngu_de_tai_tuyen_bai','reference_url','Liên kết',60,null), ('ngoai_ngu_de_tai_tuyen_bai','keywords','Từ khóa',70,null), ('ngoai_ngu_de_tai_tuyen_bai','work_type','Loại hình',80,null), ('ngoai_ngu_de_tai_tuyen_bai','start_date','Ngày bắt đầu',90,null), ('ngoai_ngu_de_tai_tuyen_bai','due_date','Hạn hoàn thành',100,null), ('ngoai_ngu_de_tai_tuyen_bai','team','Nhân sự thực hiện (phóng viên, biên tập viên, cộng tác viên)',110,null), ('ngoai_ngu_de_tai_tuyen_bai','outputs','Sản phẩm đầu ra',120,null),
      ('ngoai_ngu_du_lieu_nen','title','Tên hồ sơ',10,null), ('ngoai_ngu_du_lieu_nen','summary','Mô tả',20,null), ('ngoai_ngu_du_lieu_nen','issued_date','Ngày tạo',30,null), ('ngoai_ngu_du_lieu_nen','terminology_topic','Chủ đề',40,null), ('ngoai_ngu_du_lieu_nen','related_country','Quốc gia liên quan',50,null), ('ngoai_ngu_du_lieu_nen','responsible_person','Người phụ trách',60,null), ('ngoai_ngu_du_lieu_nen','reference_url','Liên kết / đường dẫn lưu trữ tài liệu',70,null), ('ngoai_ngu_du_lieu_nen','keywords','Từ khóa',80,null), ('ngoai_ngu_du_lieu_nen','data_kind','Loại dữ liệu',90,null),
      ('ngoai_ngu_phong_van_tu_lieu','title','Tên / chủ đề cuộc phỏng vấn',10,null), ('ngoai_ngu_phong_van_tu_lieu','issued_date','Ngày phỏng vấn',20,null), ('ngoai_ngu_phong_van_tu_lieu','organization','Cơ quan / đơn vị của người được phỏng vấn',30,null), ('ngoai_ngu_phong_van_tu_lieu','summary','Nội dung tóm tắt',40,'Bản ghi âm, ghi hình, bản chép lời đính kèm ở mục Tệp'), ('ngoai_ngu_phong_van_tu_lieu','terminology_topic','Chủ đề / lĩnh vực',50,null), ('ngoai_ngu_phong_van_tu_lieu','responsible_person','Người phụ trách',60,null), ('ngoai_ngu_phong_van_tu_lieu','reference_url','Liên kết',70,null), ('ngoai_ngu_phong_van_tu_lieu','keywords','Từ khóa',80,null), ('ngoai_ngu_phong_van_tu_lieu','interviewee','Người được phỏng vấn (họ tên, chức vụ)',90,null), ('ngoai_ngu_phong_van_tu_lieu','interview_format','Hình thức',100,null),
      ('ngoai_ngu_tai_lieu_nguon_doi_tac','title','Tên hồ sơ',10,null), ('ngoai_ngu_tai_lieu_nguon_doi_tac','summary','Mô tả',20,null), ('ngoai_ngu_tai_lieu_nguon_doi_tac','organization','Nguồn cung cấp (cơ quan / đối tác)',30,null), ('ngoai_ngu_tai_lieu_nguon_doi_tac','issued_date','Ngày ban hành',40,null), ('ngoai_ngu_tai_lieu_nguon_doi_tac','source_language','Ngôn ngữ nguồn',50,null), ('ngoai_ngu_tai_lieu_nguon_doi_tac','related_country','Quốc gia liên quan',60,null), ('ngoai_ngu_tai_lieu_nguon_doi_tac','responsible_person','Người phụ trách',70,null), ('ngoai_ngu_tai_lieu_nguon_doi_tac','reference_url','Đường dẫn nguồn',80,null), ('ngoai_ngu_tai_lieu_nguon_doi_tac','keywords','Từ khóa',90,null), ('ngoai_ngu_tai_lieu_nguon_doi_tac','source_doc_type','Loại tài liệu',100,null), ('ngoai_ngu_tai_lieu_nguon_doi_tac','received_date','Ngày tiếp nhận',110,null), ('ngoai_ngu_tai_lieu_nguon_doi_tac','usage_rights','Quyền sử dụng',120,null),
      ('tai_nguyen_ngon_ngu','title','Tên hồ sơ',10,null), ('tai_nguyen_ngon_ngu','summary','Mô tả',20,null), ('tai_nguyen_ngon_ngu','source_language','Ngôn ngữ nguồn',30,null), ('tai_nguyen_ngon_ngu','target_language','Ngôn ngữ đích',40,null), ('tai_nguyen_ngon_ngu','terminology_topic','Chủ đề thuật ngữ',50,null), ('tai_nguyen_ngon_ngu','responsible_person','Người phụ trách',60,null), ('tai_nguyen_ngon_ngu','reference_url','Liên kết',70,null), ('tai_nguyen_ngon_ngu','keywords','Từ khóa',80,null), ('tai_nguyen_ngon_ngu','resource_type','Loại tài nguyên',90,null), ('tai_nguyen_ngon_ngu','vi_term','Thuật ngữ tiếng Việt',100,null), ('tai_nguyen_ngon_ngu','standard_translation','Cách dịch chuẩn (theo ngôn ngữ của tổ)',110,null)
    ) config(type_code, field_key, label, sort_order, help)
    where config.type_code = item.code and f.form_definition_id = form_id and f.field_key = config.field_key;

    update public.db_form_fields set hidden = false, required = false, sort_order = case field_key when 'record_code' then 800 when 'status' then 810 else sort_order end where form_definition_id = form_id and field_key in ('record_code','status');
  end loop;
end
$forms$;

do $assert$
declare total_types integer; bad_titles integer; russian_category integer;
begin
  select count(*) into total_types from public.db_record_types t join public.db_categories c on c.id = t.category_id where c.code = 'ngoai_ngu' and t.active;
  if total_types <> 11 then raise exception 'expected 11 active ngoai_ngu record types, got %', total_types; end if;
  select count(*) into bad_titles from public.db_form_definitions f join public.db_record_types t on t.id = f.record_type_id join public.db_categories c on c.id = t.category_id left join public.db_form_fields ff on ff.form_definition_id = f.id and ff.field_key = 'title' where c.code = 'ngoai_ngu' and f.status = 'published' and (ff.id is null or ff.hidden);
  if bad_titles <> 0 then raise exception 'published ngoai_ngu forms must expose title'; end if;
  select count(*) into russian_category from public.db_categories where code = 'noi_dung_tieng_nga' and active;
  if russian_category <> 1 then raise exception 'Russian language category missing'; end if;
end
$assert$;

notify pgrst, 'reload schema';

commit;
