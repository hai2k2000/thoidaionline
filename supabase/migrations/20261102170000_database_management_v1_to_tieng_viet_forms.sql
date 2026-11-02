begin;

create temporary table tv_form_types (
  type_code text primary key,
  title_label text not null,
  summary_label text not null,
  search_fields jsonb not null
) on commit drop;

insert into tv_form_types (type_code, title_label, summary_label, search_fields)
values
  ('danh_ba_nghiep_vu', 'Họ và tên người liên hệ', 'Mô tả / ghi chú', '["title","organization","subject","quoc_gia","nhom_doi_tuong"]'),
  ('du_lieu_nen_linh_vuc', 'Tên bộ tư liệu / chủ đề', 'Mô tả tóm tắt', '["title","subject","organization","quoc_gia"]'),
  ('ho_so_de_tai_tuyen_bai_chuyen_de', 'Tên đề tài / tuyến bài / chuyên đề', 'Nội dung trọng tâm', '["title","subject","loai_de_tai"]'),
  ('giai_bao_chi_san_pham_tieu_bieu', 'Tên tác phẩm / bộ tác phẩm', 'Mô tả tóm tắt', '["title","tac_gia","phan_loai","ten_giai"]'),
  ('ho_so_nhan_vat', 'Họ và tên nhân vật', 'Thông tin giới thiệu / tóm tắt tiểu sử', '["title","organization","subject","quoc_gia"]'),
  ('ho_so_phong_van', 'Tên / chủ đề cuộc phỏng vấn', 'Nội dung chính của cuộc phỏng vấn', '["title","nhan_vat_phong_van","nguoi_phong_van","hinh_thuc"]'),
  ('ho_so_su_kien', 'Tên sự kiện', 'Nội dung, kết quả chính', '["title","organization","related_country","loai_su_kien"]'),
  ('ho_so_to_chuc_doi_tac', 'Tên cơ quan / tổ chức', 'Mô tả tóm tắt', '["title","subject","quoc_gia","loai_hinh"]'),
  ('kho_anh_video', 'Tên ảnh / video / bộ tư liệu', 'Chú thích / mô tả nội dung', '["title","organization","subject","loai_tu_lieu"]'),
  ('van_kien_tai_lieu_chi_dao_tu_lieu', 'Tên văn bản / tài liệu / bài phát biểu', 'Trích yếu / nội dung chính', '["title","organization","subject","loai_tai_lieu"]');

do $forms$
declare
  item record;
  old_form record;
  new_form_id uuid;
begin
  for item in select * from tv_form_types loop
    select f.* into old_form from public.db_form_definitions f join public.db_record_types t on t.id = f.record_type_id where t.code = item.type_code and f.status = 'published' order by f.version desc limit 1;
    if old_form.id is null then raise exception 'published source form missing for %', item.type_code; end if;
    update public.db_form_definitions set status = 'retired' where id = old_form.id;
    insert into public.db_form_definitions(record_type_id, version, status, search_config, display_config) values (old_form.record_type_id, old_form.version + 1, 'published', jsonb_build_object('fields', item.search_fields), old_form.display_config) returning id into new_form_id;
    insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, hidden, sort_order)
    select new_form_id, field_key, label, data_type, false, searchable, case when data_type in ('select','multi_select') then options else '[]'::jsonb end, validation, true, sort_order + 1000 from public.db_form_fields where form_definition_id = old_form.id;
    update public.db_form_fields set required = true, hidden = false, label = item.title_label, data_type = 'text', options = '[]'::jsonb, sort_order = 10 where form_definition_id = new_form_id and field_key = 'title';
    update public.db_form_fields set label = item.summary_label, data_type = 'long_text', options = '[]'::jsonb, hidden = false, sort_order = 20 where form_definition_id = new_form_id and field_key = 'summary';
    update public.db_form_fields set data_type = 'text', options = '[]'::jsonb, hidden = false, required = false where form_definition_id = new_form_id and field_key = 'keywords';
    update public.db_form_fields set hidden = false, required = false, options = '[]'::jsonb, sort_order = 700 where form_definition_id = new_form_id and field_key = 'responsible_person';
    update public.db_form_fields set hidden = false, required = false, label = 'Liên kết tham chiếu', data_type = 'url', options = '[]'::jsonb, sort_order = 710 where form_definition_id = new_form_id and field_key in ('publication_url','reference_url');
    update public.db_form_fields set hidden = false, required = false, sort_order = 900 where form_definition_id = new_form_id and field_key = 'status';
    update public.db_form_fields set hidden = true, required = false where form_definition_id = new_form_id and field_key = 'record_code';
    update public.db_form_fields set hidden = (item.type_code not in ('van_kien_tai_lieu_chi_dao_tu_lieu','giai_bao_chi_san_pham_tieu_bieu','ho_so_phong_van','ho_so_su_kien')) where form_definition_id = new_form_id and field_key = 'archive_location';
  end loop;
end
$forms$;

create temporary table tv_fields(type_code text, field_key text, label text, data_type text, options jsonb, help text, sort_order integer, primary key(type_code, field_key)) on commit drop;
insert into tv_fields (type_code, field_key, label, data_type, options, help, sort_order)
values
('danh_ba_nghiep_vu','organization','Cơ quan / tổ chức công tác','text','[]',null,30),
('danh_ba_nghiep_vu','subject','Lĩnh vực chuyên môn','text','[]',null,40),
('danh_ba_nghiep_vu','chuc_danh','Chức danh / vị trí công tác','text','[]',null,50),
('danh_ba_nghiep_vu','so_dien_thoai','Số điện thoại liên hệ','text','[]',null,60),
('danh_ba_nghiep_vu','email','Email liên hệ','text','[]','Nên có ít nhất một trong hai: số điện thoại hoặc email.',70),
('danh_ba_nghiep_vu','nhom_doi_tuong','Nhóm đối tượng','select','[{"value":"Chuyên gia","label":"Chuyên gia"},{"value":"Cộng tác viên","label":"Cộng tác viên"},{"value":"Người phát ngôn","label":"Người phát ngôn"},{"value":"Đầu mối báo chí","label":"Đầu mối báo chí"},{"value":"Đối tác","label":"Đối tác"},{"value":"Khác","label":"Khác"}]',null,80),
('danh_ba_nghiep_vu','quoc_gia','Quốc gia / địa phương','country','[]',null,90),
('danh_ba_nghiep_vu','ngay_cap_nhat_lien_he','Ngày cập nhật thông tin liên hệ gần nhất','date','[]',null,100),
('du_lieu_nen_linh_vuc','subject','Lĩnh vực','text','[]',null,30),
('du_lieu_nen_linh_vuc','organization','Cơ quan / nguồn cung cấp thông tin','text','[]',null,40),
('du_lieu_nen_linh_vuc','quoc_gia','Quốc gia / khu vực liên quan','country','[]',null,50),
('du_lieu_nen_linh_vuc','giai_doan','Giai đoạn / thời kỳ dữ liệu phản ánh','text','[]',null,60),
('du_lieu_nen_linh_vuc','nguon_tham_khao','Nguồn tài liệu, số liệu tham khảo','long_text','[]',null,70),
('du_lieu_nen_linh_vuc','ngay_kiem_chung','Ngày cập nhật / kiểm chứng gần nhất','date','[]',null,80),
('ho_so_de_tai_tuyen_bai_chuyen_de','subject','Chủ đề / đề tài','text','[]',null,30),
('ho_so_de_tai_tuyen_bai_chuyen_de','loai_de_tai','Loại','select','[{"value":"Đề tài đơn lẻ","label":"Đề tài đơn lẻ"},{"value":"Tuyến bài","label":"Tuyến bài"},{"value":"Chuyên đề","label":"Chuyên đề"}]',null,40),
('ho_so_de_tai_tuyen_bai_chuyen_de','thoi_gian_trien_khai','Thời gian triển khai','text','[]',null,50),
('ho_so_de_tai_tuyen_bai_chuyen_de','tinh_trang_thuc_hien','Tình trạng thực hiện','select','[{"value":"Đề xuất","label":"Đề xuất"},{"value":"Đã duyệt","label":"Đã duyệt"},{"value":"Đang thực hiện","label":"Đang thực hiện"},{"value":"Hoàn thành","label":"Hoàn thành"},{"value":"Tạm dừng","label":"Tạm dừng"}]',null,60),
('ho_so_de_tai_tuyen_bai_chuyen_de','san_pham_da_xuat_ban','Danh mục sản phẩm đã xuất bản và đường dẫn bài viết','long_text','[]','Mỗi sản phẩm một dòng, kèm đường dẫn.',70),
('giai_bao_chi_san_pham_tieu_bieu','issued_date','Ngày / năm xuất bản','date','[]',null,30),
('giai_bao_chi_san_pham_tieu_bieu','tac_gia','Tác giả / nhóm tác giả','text','[]',null,40),
('giai_bao_chi_san_pham_tieu_bieu','the_loai','Thể loại sản phẩm báo chí','text','[]',null,50),
('giai_bao_chi_san_pham_tieu_bieu','phan_loai','Phân loại','select','[{"value":"Sản phẩm tiêu biểu","label":"Sản phẩm tiêu biểu"},{"value":"Tác phẩm dự thi","label":"Tác phẩm dự thi"},{"value":"Tác phẩm đạt giải","label":"Tác phẩm đạt giải"}]',null,60),
('giai_bao_chi_san_pham_tieu_bieu','ten_giai','Tên giải báo chí / cuộc thi','text','[]','Không bắt buộc với sản phẩm chưa dự thi hoặc chưa đạt giải. Minh chứng đính kèm ở mục Tệp.',70),
('giai_bao_chi_san_pham_tieu_bieu','nam_tham_du','Năm tham dự','number','[]',null,80),
('giai_bao_chi_san_pham_tieu_bieu','ket_qua_giai','Kết quả giải thưởng','text','[]',null,90),
('giai_bao_chi_san_pham_tieu_bieu','duong_dan_tac_pham','Đường dẫn tác phẩm đã xuất bản','url','[]',null,100),
('ho_so_nhan_vat','organization','Cơ quan / tổ chức công tác','text','[]',null,30),
('ho_so_nhan_vat','subject','Lĩnh vực hoạt động','text','[]',null,40),
('ho_so_nhan_vat','quoc_gia','Quốc gia / quốc tịch','country','[]',null,50),
('ho_so_nhan_vat','chuc_danh','Chức danh / vị trí công tác','text','[]','Ghi theo thời điểm; nếu nhiều vị trí, ghi kèm giai đoạn.',60),
('ho_so_nhan_vat','ten_khac','Tên khác / cách viết, phiên âm tên','text','[]',null,70),
('ho_so_nhan_vat','nguon_anh','Ảnh chân dung — nguồn ảnh','text','[]','Ảnh đính kèm ở mục Tệp.',80),
('ho_so_phong_van','issued_date','Ngày phỏng vấn','date','[]',null,30),
('ho_so_phong_van','location','Địa điểm (nếu phỏng vấn trực tiếp)','text','[]',null,40),
('ho_so_phong_van','nhan_vat_phong_van','Họ tên nhân vật được phỏng vấn','text','[]',null,50),
('ho_so_phong_van','chuc_danh_co_quan','Chức danh / cơ quan của nhân vật','text','[]',null,60),
('ho_so_phong_van','nguoi_phong_van','Người thực hiện phỏng vấn','person','[]',null,70),
('ho_so_phong_van','hinh_thuc','Hình thức phỏng vấn','select','[{"value":"Trực tiếp","label":"Trực tiếp"},{"value":"Trực tuyến","label":"Trực tuyến"},{"value":"Email","label":"Email"},{"value":"Điện thoại","label":"Điện thoại"},{"value":"Khác","label":"Khác"}]',null,80),
('ho_so_phong_van','ngon_ngu','Ngôn ngữ phỏng vấn','select','[{"value":"Tiếng Việt","label":"Tiếng Việt"},{"value":"Tiếng Anh","label":"Tiếng Anh"},{"value":"Tiếng Trung","label":"Tiếng Trung"},{"value":"Tiếng Lào","label":"Tiếng Lào"},{"value":"Tiếng Khmer","label":"Tiếng Khmer"},{"value":"Tiếng Nga","label":"Tiếng Nga"},{"value":"Khác","label":"Khác"}]',null,90),
('ho_so_phong_van','tinh_trang_xu_ly','Tình trạng xử lý','select','[{"value":"Bản gốc","label":"Bản gốc"},{"value":"Đang biên tập","label":"Đang biên tập"},{"value":"Đã xuất bản","label":"Đã xuất bản"}]','Phân biệt bản trả lời gốc, bản biên tập và sản phẩm đã xuất bản; ghi âm/ghi hình đính kèm ở mục Tệp.',100),
('ho_so_su_kien','event_location','Địa điểm','text','[]',null,30),
('ho_so_su_kien','organization','Đơn vị chủ trì / tổ chức','text','[]',null,40),
('ho_so_su_kien','related_country','Quốc gia / địa phương liên quan','country','[]',null,50),
('ho_so_su_kien','nhan_vat_chinh','Nhân vật, đại biểu chính','text','[]',null,60),
('ho_so_su_kien','loai_su_kien','Loại sự kiện','select','[{"value":"Đại hội","label":"Đại hội"},{"value":"Hội nghị","label":"Hội nghị"},{"value":"Hội thảo","label":"Hội thảo"},{"value":"Chuyến thăm","label":"Chuyến thăm"},{"value":"Lễ kỷ niệm","label":"Lễ kỷ niệm"},{"value":"Giao lưu hữu nghị","label":"Giao lưu hữu nghị"},{"value":"Khác","label":"Khác"}]',null,70),
('ho_so_su_kien','thoi_gian_bat_dau','Thời gian bắt đầu','date','[]',null,80),
('ho_so_su_kien','thoi_gian_ket_thuc','Thời gian kết thúc','date','[]',null,90),
('ho_so_su_kien','don_vi_phoi_hop','Đơn vị phối hợp','text','[]',null,100),
('ho_so_to_chuc_doi_tac','subject','Lĩnh vực hoạt động','text','[]',null,30),
('ho_so_to_chuc_doi_tac','location','Trụ sở / địa bàn hoạt động','text','[]',null,40),
('ho_so_to_chuc_doi_tac','ten_viet_tat','Tên viết tắt / tên tiếng nước ngoài','text','[]',null,50),
('ho_so_to_chuc_doi_tac','quoc_gia','Quốc gia','country','[]',null,60),
('ho_so_to_chuc_doi_tac','loai_hinh','Loại hình tổ chức','text','[]',null,70),
('ho_so_to_chuc_doi_tac','website','Website chính thức','url','[]',null,80),
('ho_so_to_chuc_doi_tac','dau_moi','Người đại diện / đầu mối liên hệ','text','[]','Số điện thoại, email cá nhân lưu ở Danh bạ nghiệp vụ.',90),
('kho_anh_video','activity_date','Ngày chụp / quay','date','[]',null,30),
('kho_anh_video','organization','Nguồn cung cấp tư liệu','text','[]',null,40),
('kho_anh_video','location','Địa điểm','text','[]',null,50),
('kho_anh_video','subject','Chủ đề / đề tài','text','[]',null,60),
('kho_anh_video','loai_tu_lieu','Loại tư liệu','select','[{"value":"Ảnh","label":"Ảnh"},{"value":"Bộ ảnh","label":"Bộ ảnh"},{"value":"Video gốc","label":"Video gốc"},{"value":"Video hoàn chỉnh","label":"Video hoàn chỉnh"}]',null,70),
('kho_anh_video','tac_gia','Tác giả / người chụp, quay','text','[]',null,80),
('kho_anh_video','su_kien_lien_quan','Sự kiện liên quan','text','[]',null,90),
('kho_anh_video','nhan_vat_chinh','Nhân vật chính xuất hiện','text','[]',null,100),
('kho_anh_video','quoc_gia','Quốc gia / địa phương liên quan','country','[]',null,110),
('kho_anh_video','quyen_su_dung','Quyền sử dụng tư liệu','select','[{"value":"Được phép sử dụng","label":"Được phép sử dụng"},{"value":"Sử dụng có điều kiện","label":"Sử dụng có điều kiện"},{"value":"Chờ xác minh nguồn, quyền","label":"Chờ xác minh nguồn, quyền"}]','Tư liệu chưa rõ nguồn hoặc quyền sử dụng chọn ''Chờ xác minh'', không mặc nhiên tái sử dụng.',120),
('kho_anh_video','vi_tri_tep_goc','Đường dẫn hoặc vị trí lưu tệp gốc','text','[]',null,130),
('van_kien_tai_lieu_chi_dao_tu_lieu','organization','Cơ quan ban hành / cung cấp tài liệu','text','[]',null,30),
('van_kien_tai_lieu_chi_dao_tu_lieu','issued_date','Ngày ban hành / công bố / phát biểu','date','[]',null,40),
('van_kien_tai_lieu_chi_dao_tu_lieu','subject','Chủ đề / đề tài','text','[]',null,50),
('van_kien_tai_lieu_chi_dao_tu_lieu','location','Địa điểm (nếu là sự kiện, bài phát biểu)','text','[]',null,60),
('van_kien_tai_lieu_chi_dao_tu_lieu','loai_tai_lieu','Loại tài liệu','select','[{"value":"Nghị quyết","label":"Nghị quyết"},{"value":"Chỉ thị","label":"Chỉ thị"},{"value":"Kết luận","label":"Kết luận"},{"value":"Quyết định","label":"Quyết định"},{"value":"Kế hoạch","label":"Kế hoạch"},{"value":"Bài phát biểu","label":"Bài phát biểu"},{"value":"Phát biểu chỉ đạo","label":"Phát biểu chỉ đạo"},{"value":"Thông cáo báo chí","label":"Thông cáo báo chí"},{"value":"Tài liệu nguồn khác","label":"Tài liệu nguồn khác"}]',null,70),
('van_kien_tai_lieu_chi_dao_tu_lieu','so_ky_hieu','Số, ký hiệu văn bản','text','[]',null,80),
('van_kien_tai_lieu_chi_dao_tu_lieu','nguoi_ky_phat_bieu','Người ký / người phát biểu','text','[]',null,90),
('van_kien_tai_lieu_chi_dao_tu_lieu','chuc_danh_nguoi_phat_bieu','Chức danh của người phát biểu','text','[]',null,100),
('van_kien_tai_lieu_chi_dao_tu_lieu','nguon_chinh_thuc','Nguồn tài liệu / đường dẫn chính thức','url','[]',null,110),
('van_kien_tai_lieu_chi_dao_tu_lieu','tinh_trang_hieu_luc','Tình trạng hiệu lực','select','[{"value":"Còn hiệu lực","label":"Còn hiệu lực"},{"value":"Hết hiệu lực","label":"Hết hiệu lực"},{"value":"Bị thay thế","label":"Bị thay thế"},{"value":"Không áp dụng","label":"Không áp dụng"}]',null,120);

insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, hidden, sort_order)
select d.id, x.field_key, x.label, x.data_type, false, true, x.options, case when x.help is null then '{}'::jsonb else jsonb_build_object('help',x.help) end, false, x.sort_order
from tv_fields x join public.db_record_types t on t.code=x.type_code join public.db_form_definitions d on d.record_type_id=t.id and d.status='published'
on conflict(form_definition_id, field_key) do update set label=excluded.label,data_type=excluded.data_type,required=false,options=excluded.options,validation=excluded.validation,hidden=false,sort_order=excluded.sort_order;

update public.db_form_fields f set validation=jsonb_build_object('help','Ưu tiên dữ liệu về quan hệ Việt Nam với các nước, mốc thiết lập/nâng cấp quan hệ, đối ngoại nhân dân, tổ chức hữu nghị.') from public.db_form_definitions d join public.db_record_types t on t.id=d.record_type_id where f.form_definition_id=d.id and d.status='published' and t.code='du_lieu_nen_linh_vuc' and f.field_key='title';
update public.db_form_fields f set validation=jsonb_build_object('help','Ưu tiên bản toàn văn chính thức, có nguồn xác thực.') from public.db_form_definitions d join public.db_record_types t on t.id=d.record_type_id where f.form_definition_id=d.id and d.status='published' and t.code='van_kien_tai_lieu_chi_dao_tu_lieu' and f.field_key='title';

create or replace function public.enforce_danh_ba_department_visibility()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.visibility = 'public'
    and exists (
      select 1
      from public.db_record_types
      where id = new.record_type_id
        and code = 'danh_ba_nghiep_vu'
    ) then
    raise exception 'danh_ba_nghiep_vu_department_only';
  end if;

  return new;
end;
$function$;
update public.db_records r set visibility='department' from public.db_record_types t where t.id=r.record_type_id and t.code='danh_ba_nghiep_vu' and r.visibility='public';
drop trigger if exists db_records_danh_ba_visibility on public.db_records;
create trigger db_records_danh_ba_visibility before insert or update of visibility,record_type_id on public.db_records for each row execute function public.enforce_danh_ba_department_visibility();

do $assert$
declare bad integer;
begin
  select count(*) into bad from tv_form_types x where (select count(*) from public.db_record_types t join public.db_categories c on c.id=t.category_id where t.code=x.type_code and c.code='noi_dung_tieng_viet' and t.active) <> 1;
  if bad <> 0 then raise exception 'Tổ Tiếng Việt record types missing: %', bad; end if;
  select count(*) into bad from tv_form_types x where (select count(*) from public.db_form_definitions f join public.db_record_types t on t.id=f.record_type_id where t.code=x.type_code and f.status='published') <> 1;
  if bad <> 0 then raise exception 'published form count invalid: %', bad; end if;
  if exists (select 1 from public.db_form_fields f join public.db_form_definitions d on d.id=f.form_definition_id join public.db_record_types t on t.id=d.record_type_id where d.status='published' and t.code in (select type_code from tv_form_types) and f.required and f.field_key <> 'title') then raise exception 'only title may be required'; end if;
  if exists (select 1 from tv_form_types x where (select count(*) from public.db_form_fields f join public.db_form_definitions d on d.id=f.form_definition_id join public.db_record_types t on t.id=d.record_type_id where d.status='published' and t.code=x.type_code and f.field_key='title' and f.required and not f.hidden) <> 1) then raise exception 'title must be required'; end if;
  if exists (select 1 from public.db_form_fields f join public.db_form_definitions d on d.id=f.form_definition_id join public.db_record_types t on t.id=d.record_type_id where d.status='published' and t.code in (select type_code from tv_form_types) and f.field_key='record_code' and not f.hidden) then raise exception 'record_code must be hidden'; end if;
  if exists (select 1 from public.db_form_fields f join public.db_form_definitions d on d.id=f.form_definition_id join public.db_record_types t on t.id=d.record_type_id where d.status='published' and t.code in (select type_code from tv_form_types) and f.field_key='keywords' and f.data_type <> 'text') then raise exception 'keywords must be text'; end if;
  if exists (
    select 1
    from public.db_form_fields f
    join public.db_form_definitions d on d.id = f.form_definition_id
    join public.db_record_types t on t.id = d.record_type_id
    where d.status = 'published'
      and t.code in (select type_code from tv_form_types)
      and f.data_type in ('select', 'multi_select')
      and jsonb_typeof(f.options) <> 'array'
  ) then
    raise exception 'select options invalid';
  end if;
  if exists (
    select 1
    from tv_form_types x
    join public.db_record_types t on t.code = x.type_code
    join public.db_form_definitions d on d.record_type_id = t.id and d.status = 'published'
    join public.db_form_fields f on f.form_definition_id = d.id
    where not f.hidden
      and not (
        f.field_key in ('title', 'summary', 'keywords', 'responsible_person', 'publication_url', 'reference_url', 'status')
        or (f.field_key = 'archive_location' and x.type_code in ('van_kien_tai_lieu_chi_dao_tu_lieu', 'giai_bao_chi_san_pham_tieu_bieu', 'ho_so_phong_van', 'ho_so_su_kien'))
        or exists (select 1 from tv_fields expected where expected.type_code = x.type_code and expected.field_key = f.field_key)
      )
  ) then
    raise exception 'unexpected visible field';
  end if;

  if exists (
    select 1
    from tv_form_types x
    join public.db_record_types t on t.code = x.type_code
    join public.db_form_definitions d on d.record_type_id = t.id and d.status = 'published'
    join public.db_form_fields f on f.form_definition_id = d.id
    where not f.hidden
      and f.field_key in ('issued_date', 'organization', 'subject', 'activity_date', 'location', 'event_name', 'event_datetime', 'event_location', 'participants', 'materials', 'related_activities', 'organizer_department')
      and not exists (
        select 1
        from tv_fields expected
        where expected.type_code = x.type_code
          and expected.field_key = f.field_key
      )
  ) then
    raise exception 'type-specific field visible outside specification';
  end if;

  if exists (
    select 1
    from tv_fields expected
    join public.db_record_types t on t.code = expected.type_code
    join public.db_form_definitions d on d.record_type_id = t.id and d.status = 'published'
    left join public.db_form_fields f on f.form_definition_id = d.id and f.field_key = expected.field_key
    where f.id is null or f.hidden
  ) then
    raise exception 'expected field is hidden or missing';
  end if;

  if exists (
    select 1
    from public.db_records r
    join public.db_record_types t on t.id = r.record_type_id
    where t.code = 'danh_ba_nghiep_vu'
      and r.visibility = 'public'
  ) then
    raise exception 'danh_ba_nghiep_vu public record exists';
  end if;
end
$assert$;

commit;
