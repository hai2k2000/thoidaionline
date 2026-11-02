begin;

update public.db_record_types set name='Danh bạ đối tác, chuyên gia, cộng tác viên',updated_at=now() where code='ngoai_ngu_danh_ba_doi_tac';

insert into public.db_record_types(category_id,code,name,description,active,sort_order) select id,'ngoai_ngu_ho_so_nhan_vat','Hồ sơ nhân vật','Danh mục Database Management V1.',true,35 from public.db_categories where code='ngoai_ngu' on conflict(code) do update set name=excluded.name,description=excluded.description,active=true,sort_order=excluded.sort_order;

create temporary table dot1_tt(code text primary key,title_label text,summary_label text,search_fields jsonb,summary_help text) on commit drop;

insert into dot1_tt values ('khach_hang_doi_tac','Tên khách hàng / đối tác','Ghi chú','["title","ma_khach_hang","ma_so_thue","linh_vuc"]'::jsonb,null),
  ('de_xuat_bao_gia_thuong_thao','Tên đề xuất / báo giá','Nội dung đề xuất','["title","ma_khach_hang","ten_khach_hang","so_hop_dong","tinh_trang_bao_gia"]'::jsonb,null),
  ('hop_dong_nghiep_vu','Tên hợp đồng','Nội dung hợp đồng','["title","so_hop_dong","ma_khach_hang","ten_khach_hang","tinh_trang_hop_dong"]'::jsonb,null),
  ('san_pham_truyen_thong_hop_dong','Tên sản phẩm / hạng mục','Mô tả','["title","so_hop_dong","ma_khach_hang","loai_san_pham","tinh_trang_thuc_hien"]'::jsonb,null),
  ('nghiem_thu_ban_giao_thanh_ly','Tên biên bản / đợt nghiệm thu','Ghi chú','["title","so_hop_dong","ma_khach_hang","tinh_trang_ho_so"]'::jsonb,'Biên bản nghiệm thu, bàn giao, thanh lý đính kèm ở mục Tệp.'),
  ('tham_chieu_thanh_toan_quyet_toan','Tên hồ sơ thanh toán','Ghi chú','["title","so_hop_dong","ma_khach_hang","ten_khach_hang","so_hoa_don","tinh_trang_thanh_toan"]'::jsonb,'Chứng từ thanh toán, giấy đề nghị thanh toán, hóa đơn đính kèm ở mục Tệp.'),
  ('tai_tro_quang_cao_hop_tac','Tên chương trình / sự kiện / chiến dịch','Kết quả thực hiện','["title","ma_khach_hang","ten_khach_hang","so_hop_dong","hinh_thuc_hop_tac"]'::jsonb,null),
  ('kho_thiet_ke_nhan_dien','Tên tài liệu / sản phẩm','Mô tả','["title","loai_tai_nguyen","chuong_trinh","nguoi_thiet_ke"]'::jsonb,null),
  ('bao_cao_thong_ke_nghiep_vu','Tên báo cáo','Nội dung tóm tắt','["title","loai_bao_cao","ky_bao_cao","thoi_gian_bao_cao"]'::jsonb,'File báo cáo đính kèm ở mục Tệp. Báo cáo tự tổng hợp và xuất Excel sẽ làm ở giai đoạn sau.');

create temporary table dot1_fields(type_code text,key text,label text,data_type text,sort_order int,help text,options jsonb) on commit drop;

insert into dot1_fields values ('khach_hang_doi_tac','ma_khach_hang','Mã khách hàng / đối tác','text',30,'Dùng cùng một mã ở mọi hồ sơ liên quan (báo giá, hợp đồng, nghiệm thu, thanh toán) để tra cứu.','[]'::jsonb),
  ('khach_hang_doi_tac','ma_so_thue','Mã số thuế','text',40,null,'[]'::jsonb),
  ('khach_hang_doi_tac','dia_chi','Địa chỉ','text',50,null,'[]'::jsonb),
  ('khach_hang_doi_tac','nguoi_dai_dien','Người đại diện','text',60,null,'[]'::jsonb),
  ('khach_hang_doi_tac','so_dien_thoai','Số điện thoại','text',70,null,'[]'::jsonb),
  ('khach_hang_doi_tac','email','Email','text',80,null,'[]'::jsonb),
  ('khach_hang_doi_tac','linh_vuc','Lĩnh vực hoạt động','text',90,null,'[]'::jsonb),
  ('khach_hang_doi_tac','nhu_cau_dich_vu','Nhu cầu và loại hình dịch vụ truyền thông','long_text',100,null,'[]'::jsonb),
  ('khach_hang_doi_tac','lich_su_hop_tac','Lịch sử hợp tác, các hợp đồng đã thực hiện','long_text',110,null,'[]'::jsonb),
  ('khach_hang_doi_tac','tinh_trang_hop_tac','Tình trạng hợp tác','select',120,null,'["Khách hàng mới","Đang hợp tác","Đã từng hợp tác","Tạm dừng"]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','ma_khach_hang','Mã khách hàng / đối tác','text',30,null,'[]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','ten_khach_hang','Khách hàng / đối tác','text',40,null,'[]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','so_hop_dong','Số hợp đồng','text',50,'Điền khi báo giá đã thành hợp đồng.','[]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','hang_muc','Số lượng tin, bài, ảnh, video, banner và các sản phẩm khác','long_text',60,null,'[]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','thoi_gian_dia_diem','Thời gian, địa điểm thực hiện','text',70,null,'[]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','don_gia','Đơn giá từng hạng mục','long_text',80,'Mỗi hạng mục một dòng; bảng báo giá chi tiết đính kèm ở mục Tệp.','[]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','tong_gia_tri','Tổng giá trị báo giá (đồng)','number',90,null,'[]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','vat','VAT','select',100,null,'["Đã bao gồm VAT","Chưa bao gồm VAT"]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','ngay_lap','Ngày lập báo giá','date',110,null,'[]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','ngay_gui','Ngày gửi khách hàng','date',120,null,'[]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','nguoi_lap','Người lập','person',130,null,'[]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','nguoi_kiem_tra','Người kiểm tra','person',140,null,'[]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','nguoi_phe_duyet','Người phê duyệt','person',150,null,'[]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','tinh_trang_bao_gia','Tình trạng báo giá','select',160,null,'["Đã gửi","Đang thương thảo","Đã chấp thuận","Không thực hiện"]'::jsonb),
  ('de_xuat_bao_gia_thuong_thao','noi_dung_thuong_thao','Nội dung thương thảo (nếu có)','long_text',170,'Biên bản thương thảo đính kèm ở mục Tệp.','[]'::jsonb),
  ('hop_dong_nghiep_vu','so_hop_dong','Số hợp đồng','text',30,'Gõ số hợp đồng vào ô tìm kiếm để xem mọi hồ sơ cùng hợp đồng.','[]'::jsonb),
  ('hop_dong_nghiep_vu','ma_khach_hang','Mã khách hàng / đối tác','text',40,null,'[]'::jsonb),
  ('hop_dong_nghiep_vu','ten_khach_hang','Khách hàng / đối tác','text',50,null,'[]'::jsonb),
  ('hop_dong_nghiep_vu','loai_hop_dong','Loại hợp đồng','select',60,null,'["Ký mới","Gia hạn","Điều chỉnh"]'::jsonb),
  ('hop_dong_nghiep_vu','ngay_ky','Ngày ký','date',70,null,'[]'::jsonb),
  ('hop_dong_nghiep_vu','ngay_bat_dau','Ngày bắt đầu','date',80,null,'[]'::jsonb),
  ('hop_dong_nghiep_vu','ngay_ket_thuc','Ngày kết thúc / thời hạn hợp đồng','date',90,null,'[]'::jsonb),
  ('hop_dong_nghiep_vu','gia_tri_truoc_thue','Giá trị trước thuế (đồng)','number',100,null,'[]'::jsonb),
  ('hop_dong_nghiep_vu','thue_vat','Thuế VAT (đồng)','number',110,null,'[]'::jsonb),
  ('hop_dong_nghiep_vu','tong_gia_tri','Tổng giá trị thanh toán (đồng)','number',120,null,'[]'::jsonb),
  ('hop_dong_nghiep_vu','san_pham','Số lượng, nội dung các sản phẩm truyền thông','long_text',130,null,'[]'::jsonb),
  ('hop_dong_nghiep_vu','phuong_thuc_thanh_toan','Phương thức và tiến độ thanh toán','long_text',140,null,'[]'::jsonb),
  ('hop_dong_nghiep_vu','nguoi_ky','Người ký hợp đồng','text',150,null,'[]'::jsonb),
  ('hop_dong_nghiep_vu','phu_luc','Phụ lục, văn bản điều chỉnh, bổ sung','long_text',160,'Mỗi văn bản một dòng; tệp đính kèm ở mục Tệp.','[]'::jsonb),
  ('hop_dong_nghiep_vu','tinh_trang_hop_dong','Tình trạng hợp đồng','select',170,null,'["Dự thảo","Đã ký","Đang thực hiện","Đã hoàn thành","Đã thanh lý"]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','so_hop_dong','Số hợp đồng liên quan','text',30,null,'[]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','ma_khach_hang','Mã khách hàng / đối tác','text',40,null,'[]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','loai_san_pham','Loại sản phẩm','select',50,null,'["Tin","Bài","Ảnh","Video","Banner","Infographic","Bài đăng mạng xã hội","Khác"]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','so_luong_hop_dong','Số lượng theo hợp đồng','number',60,null,'[]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','so_luong_da_thuc_hien','Số lượng đã thực hiện','number',70,null,'[]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','so_luong_da_dang','Số lượng đã đăng tải / bàn giao','number',80,null,'[]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','duong_link','Đường link sản phẩm đã đăng tải','long_text',90,'Mỗi link một dòng.','[]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','ngay_san_xuat','Ngày sản xuất','date',100,null,'[]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','ngay_dang_tai','Ngày đăng tải','date',110,null,'[]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','nguoi_thuc_hien','Người thực hiện','person',120,null,'[]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','nguoi_bien_tap','Người biên tập','person',130,null,'[]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','nguoi_duyet','Người duyệt','person',140,null,'[]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','luot_xem','Lượt xem / tương tác (nếu có)','number',150,null,'[]'::jsonb),
  ('san_pham_truyen_thong_hop_dong','tinh_trang_thuc_hien','Tình trạng thực hiện','select',160,null,'["Chưa triển khai","Đang triển khai","Đã hoàn thành"]'::jsonb),
  ('nghiem_thu_ban_giao_thanh_ly','so_hop_dong','Số hợp đồng','text',30,null,'[]'::jsonb),
  ('nghiem_thu_ban_giao_thanh_ly','ma_khach_hang','Mã khách hàng / đối tác','text',40,null,'[]'::jsonb),
  ('nghiem_thu_ban_giao_thanh_ly','so_luong_hoan_thanh','Số lượng sản phẩm thực tế hoàn thành','long_text',50,null,'[]'::jsonb),
  ('nghiem_thu_ban_giao_thanh_ly','gia_tri_nghiem_thu','Giá trị được nghiệm thu (đồng)','number',60,null,'[]'::jsonb),
  ('nghiem_thu_ban_giao_thanh_ly','gia_tri_dieu_chinh','Giá trị điều chỉnh (đồng, nếu có)','number',70,null,'[]'::jsonb),
  ('nghiem_thu_ban_giao_thanh_ly','ngay_ky_bien_ban','Ngày ký biên bản nghiệm thu','date',80,null,'[]'::jsonb),
  ('nghiem_thu_ban_giao_thanh_ly','tinh_trang_ho_so','Tình trạng hồ sơ','select',90,null,'["Chưa nghiệm thu","Đã nghiệm thu","Chưa thanh lý","Đã thanh lý"]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','so_hop_dong','Số hợp đồng','text',30,null,'[]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','ma_khach_hang','Mã khách hàng / đối tác','text',40,null,'[]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','ten_khach_hang','Khách hàng / đối tác','text',50,null,'[]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','tong_gia_tri_hop_dong','Tổng giá trị hợp đồng (đồng)','number',60,null,'[]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','gia_tri_nghiem_thu','Giá trị nghiệm thu (đồng)','number',70,null,'[]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','so_hoa_don','Số hóa đơn','text',80,null,'[]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','ngay_hoa_don','Ngày xuất hóa đơn','date',90,null,'[]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','gia_tri_hoa_don','Giá trị hóa đơn (đồng)','number',100,null,'[]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','da_thanh_toan','Số tiền đã thanh toán (đồng)','number',110,null,'[]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','con_phai_thu','Số tiền còn phải thu (đồng)','number',120,null,'[]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','han_thanh_toan','Hạn thanh toán','date',130,null,'[]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','ngay_thanh_toan','Ngày thanh toán','date',140,null,'[]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','hinh_thuc_thanh_toan','Hình thức thanh toán','select',150,null,'["Chuyển khoản","Tiền mặt","Khác"]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','tinh_trang_thanh_toan','Tình trạng thanh toán','select',160,null,'["Chưa đến hạn","Đến hạn","Đã thanh toán một phần","Đã thanh toán đủ"]'::jsonb),
  ('tham_chieu_thanh_toan_quyet_toan','nguyen_nhan_cham','Nguyên nhân chậm thanh toán (nếu có)','long_text',170,null,'[]'::jsonb),
  ('tai_tro_quang_cao_hop_tac','ten_khach_hang','Đơn vị tài trợ / khách hàng','text',30,null,'[]'::jsonb),
  ('tai_tro_quang_cao_hop_tac','ma_khach_hang','Mã khách hàng / đối tác','text',40,null,'[]'::jsonb),
  ('tai_tro_quang_cao_hop_tac','so_hop_dong','Số hợp đồng','text',50,null,'[]'::jsonb),
  ('tai_tro_quang_cao_hop_tac','hinh_thuc_hop_tac','Hình thức hợp tác','select',60,null,'["Tài trợ","Quảng cáo","Bảo trợ truyền thông","Truyền thông trọn gói","Khác"]'::jsonb),
  ('tai_tro_quang_cao_hop_tac','so_luong_vi_tri','Số lượng, vị trí, thời gian đăng tải quảng cáo','long_text',70,null,'[]'::jsonb),
  ('tai_tro_quang_cao_hop_tac','ngay_bat_dau','Ngày bắt đầu','date',80,null,'[]'::jsonb),
  ('tai_tro_quang_cao_hop_tac','ngay_ket_thuc','Ngày kết thúc','date',90,null,'[]'::jsonb),
  ('tai_tro_quang_cao_hop_tac','gia_tri','Giá trị tài trợ / hợp tác (đồng)','number',100,null,'[]'::jsonb),
  ('tai_tro_quang_cao_hop_tac','da_thu','Giá trị đã thu (đồng)','number',110,null,'[]'::jsonb),
  ('tai_tro_quang_cao_hop_tac','con_phai_thu','Giá trị còn phải thu (đồng)','number',120,null,'[]'::jsonb),
  ('tai_tro_quang_cao_hop_tac','tinh_trang','Tình trạng thực hiện và thanh toán','select',130,null,'["Chưa triển khai","Đang thực hiện","Đã hoàn thành, chưa thu đủ","Đã hoàn thành, đã thu đủ"]'::jsonb),
  ('kho_thiet_ke_nhan_dien','loai_tai_nguyen','Loại tài nguyên','select',30,null,'["Logo","Banner","Template","Infographic","Video","Ảnh","Font chữ","Khác"]'::jsonb),
  ('kho_thiet_ke_nhan_dien','chuong_trinh','Chương trình / đơn vị sử dụng','text',40,null,'[]'::jsonb),
  ('kho_thiet_ke_nhan_dien','nguoi_thiet_ke','Người thiết kế / người tạo lập','text',50,null,'[]'::jsonb),
  ('kho_thiet_ke_nhan_dien','ngay_tao','Ngày tạo lập','date',60,null,'[]'::jsonb),
  ('kho_thiet_ke_nhan_dien','ngay_cap_nhat','Ngày cập nhật','date',70,null,'[]'::jsonb),
  ('kho_thiet_ke_nhan_dien','dinh_dang','Định dạng file','text',80,null,'[]'::jsonb),
  ('kho_thiet_ke_nhan_dien','duong_dan','Đường dẫn lưu trữ','text',90,null,'[]'::jsonb),
  ('kho_thiet_ke_nhan_dien','pham_vi_su_dung','Phạm vi và thời hạn được phép sử dụng (nếu có)','long_text',100,null,'[]'::jsonb),
  ('kho_thiet_ke_nhan_dien','tinh_trang_su_dung','Tình trạng sử dụng','select',110,null,'["Đang sử dụng","Ngừng sử dụng","Hết hạn quyền sử dụng"]'::jsonb),
  ('bao_cao_thong_ke_nghiep_vu','loai_bao_cao','Loại báo cáo','select',30,null,'["Hợp đồng truyền thông","Doanh thu","Thu tiền và công nợ","Tiến độ thực hiện hợp đồng","Hiệu quả hoạt động truyền thông","Khách hàng, đối tác","Khác"]'::jsonb),
  ('bao_cao_thong_ke_nghiep_vu','ky_bao_cao','Kỳ báo cáo','select',40,null,'["Tháng","Quý","6 tháng","Năm"]'::jsonb),
  ('bao_cao_thong_ke_nghiep_vu','thoi_gian_bao_cao','Thời gian báo cáo','text',50,'Ví dụ: Quý III/2026.','[]'::jsonb),
  ('bao_cao_thong_ke_nghiep_vu','ngay_bao_cao','Ngày báo cáo','date',60,null,'[]'::jsonb),
  ('bao_cao_thong_ke_nghiep_vu','ma_khach_hang','Mã khách hàng / đối tác (nếu báo cáo theo khách hàng)','text',70,null,'[]'::jsonb);

create temporary table dot1_new(key text primary key,label text,data_type text,required boolean,hidden boolean,sort_order int,help text) on commit drop;

insert into dot1_new values ('title','Họ và tên nhân vật','text',true,false,10,null),
  ('summary','Tiểu sử / thông tin giới thiệu','long_text',false,false,20,'Ảnh chân dung, tài liệu, hình ảnh liên quan đính kèm ở mục Tệp.'),
  ('position','Chức danh / chức vụ','text',false,false,30,null),
  ('organization','Cơ quan công tác','text',false,false,40,null),
  ('related_country','Quốc tịch','country',false,false,50,null),
  ('birth_date','Ngày sinh','date',false,false,60,null),
  ('career_history','Quá trình công tác','long_text',false,false,70,null),
  ('terminology_topic','Lĩnh vực hoạt động','text',false,false,80,null),
  ('responsible_person','Người phụ trách','text',false,false,90,'Số điện thoại, email, địa chỉ liên hệ lưu ở loại Danh bạ đối tác, chuyên gia, cộng tác viên (chỉ trong phạm vi phòng).'),
  ('reference_url','Liên kết tham chiếu','url',false,false,100,null),
  ('keywords','Từ khóa','text',false,false,110,null),
  ('status','Trạng thái','select',false,false,810,null),
  ('record_code','Mã hồ sơ','text',false,true,800,null);

do $forms$
declare
  item record;
  old public.db_form_definitions%rowtype;
  form_id uuid;
begin
  for item in
    select rt.*
    from public.db_record_types rt
    join public.db_categories c on c.id = rt.category_id
    where c.code = 'ngoai_ngu'
      and rt.active
      and rt.code <> 'ngoai_ngu_ho_so_nhan_vat'
  loop
    select *
    into old
    from public.db_form_definitions
    where record_type_id = item.id
      and status = 'published'
    order by version desc
    limit 1;

    if old.id is null then
      raise exception 'published source form missing for %', item.code;
    end if;

    update public.db_form_definitions
    set status = 'retired'
    where id = old.id;

    insert into public.db_form_definitions(record_type_id, version, status, search_config, display_config)
    values (item.id, (select max(f2.version) from public.db_form_definitions f2 where f2.record_type_id = item.id) + 1, 'published', old.search_config, old.display_config)
    returning id into form_id;

    insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, hidden, sort_order)
    select form_id, field_key, label, data_type, required, searchable, options, validation, hidden, sort_order
    from public.db_form_fields
    where form_definition_id = old.id;

    update public.db_form_fields
    set hidden = true, required = false
    where form_definition_id = form_id
      and field_key = 'record_code';

    update public.db_form_fields
    set hidden = false,
        required = false,
        options = '[{"value":"draft","label":"Nháp"},{"value":"pending_review","label":"Chờ duyệt"},{"value":"approved","label":"Đã duyệt"},{"value":"archived","label":"Lưu trữ"}]'::jsonb
    where form_definition_id = form_id
      and field_key = 'status';

    if item.code = 'ngoai_ngu_danh_ba_doi_tac' then
      update public.db_form_fields
      set validation = coalesce(validation, '{}') || jsonb_build_object('help', 'Hồ sơ tiểu sử nhân vật nhập ở loại Hồ sơ nhân vật. Danh bạ chỉ lưu trong phạm vi phòng.')
      where form_definition_id = form_id
        and field_key = 'contact_type';
    end if;
  end loop;

  select id
  into form_id
  from public.db_record_types
  where code = 'ngoai_ngu_ho_so_nhan_vat';

  if not exists (
    select 1
    from public.db_form_definitions
    where record_type_id = form_id
      and status = 'published'
  ) then
    insert into public.db_form_definitions(record_type_id, version, status, search_config, display_config)
    values (
      form_id,
      coalesce((select max(f2.version) from public.db_form_definitions f2 where f2.record_type_id = form_id), 0) + 1,
      'published',
      jsonb_build_object('fields', '["title","organization","terminology_topic","related_country","position"]'::jsonb),
      '{"columns":["record_code","title","status","updated_at"]}'
    )
    returning id into form_id;

    insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, hidden, sort_order)
    select form_id, key, label, data_type, required, true,
           case when key = 'status' then '[{"value":"draft","label":"Nháp"},{"value":"pending_review","label":"Chờ duyệt"},{"value":"approved","label":"Đã duyệt"},{"value":"archived","label":"Lưu trữ"}]'::jsonb else '[]'::jsonb end,
           case when help is null then '{}'::jsonb else jsonb_build_object('help', help) end,
           hidden, sort_order
    from dot1_new;
  end if;
end
$forms$;

do $forms$
declare
  item record;
  old public.db_form_definitions%rowtype;
  form_id uuid;
begin
  for item in
    select *
    from dot1_tt
  loop
    select f.*
    into old
    from public.db_form_definitions f
    join public.db_record_types rt on rt.id = f.record_type_id
    where rt.code = item.code
      and f.status = 'published'
    order by f.version desc
    limit 1;

    if old.id is null then
      raise exception 'published source form missing for %', item.code;
    end if;

    update public.db_form_definitions
    set status = 'retired'
    where id = old.id;

    insert into public.db_form_definitions(record_type_id, version, status, search_config, display_config)
    values (old.record_type_id, (select max(f2.version) from public.db_form_definitions f2 where f2.record_type_id = old.record_type_id) + 1, 'published', jsonb_build_object('fields', item.search_fields), old.display_config)
    returning id into form_id;

    insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, hidden, sort_order)
    select form_id, field_key, label, data_type, false, searchable,
           case when data_type in ('select', 'multi_select') then options else '[]'::jsonb end,
           validation, true, sort_order + 1000
    from public.db_form_fields
    where form_definition_id = old.id;

    update public.db_form_fields
    set required = true, hidden = false, label = item.title_label, data_type = 'text', options = '[]'::jsonb, sort_order = 10
    where form_definition_id = form_id
      and field_key = 'title';

    update public.db_form_fields
    set hidden = false, required = false, label = item.summary_label, data_type = 'long_text', sort_order = 20,
        validation = case when item.summary_help is null then validation else coalesce(validation, '{}') || jsonb_build_object('help', item.summary_help) end
    where form_definition_id = form_id
      and field_key = 'summary';

    update public.db_form_fields
    set hidden = false, required = false, data_type = 'text', options = '[]'::jsonb, validation = '{"maxLength":500}', sort_order = 720
    where form_definition_id = form_id
      and field_key = 'keywords';

    update public.db_form_fields
    set hidden = false, required = false, label = 'Người phụ trách', options = '[]'::jsonb, sort_order = 700
    where form_definition_id = form_id
      and field_key = 'responsible_person';

    insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, hidden, sort_order)
    values (form_id, 'reference_url', 'Liên kết tham chiếu', 'url', false, false, '[]'::jsonb, '{}'::jsonb, false, 710)
    on conflict(form_definition_id, field_key) do update set label = excluded.label, data_type = 'url', options = '[]'::jsonb, hidden = false, sort_order = 710;

    update public.db_form_fields
    set hidden = false, required = false, sort_order = 900
    where form_definition_id = form_id
      and field_key = 'status';

    update public.db_form_fields
    set hidden = true, required = false
    where form_definition_id = form_id
      and field_key in ('record_code', 'archive_location');

    insert into public.db_form_fields(form_definition_id, field_key, label, data_type, required, searchable, options, validation, hidden, sort_order)
    select form_id, key, label, data_type, false, true,
           case when data_type = 'select' then (select jsonb_agg(jsonb_build_object('value', v, 'label', v)) from jsonb_array_elements_text(options) v) else '[]'::jsonb end,
           case when data_type = 'number' then '{"min":0}'::jsonb else '{}'::jsonb end || case when help is null then '{}'::jsonb else jsonb_build_object('help', help) end,
           false, sort_order
    from dot1_fields
    where type_code = item.code
    on conflict(form_definition_id, field_key) do update set label = excluded.label, data_type = excluded.data_type, options = excluded.options, validation = excluded.validation, hidden = false, sort_order = excluded.sort_order;
  end loop;
end
$forms$;

create or replace function public.enforce_danh_ba_department_visibility() returns trigger language plpgsql set search_path=public as $function$ begin if new.visibility='public' and exists(select 1 from public.db_record_types where id=new.record_type_id and code in ('danh_ba_nghiep_vu','ngoai_ngu_danh_ba_doi_tac')) then raise exception 'danh_ba_department_only'; end if; return new; end $function$;

update public.db_records r set visibility='department' from public.db_record_types t where t.id=r.record_type_id and t.code in ('danh_ba_nghiep_vu','ngoai_ngu_danh_ba_doi_tac') and r.visibility='public';

do $assert$
declare
  bad int;
begin
  select count(*) into bad
  from public.db_record_types t
  join public.db_categories c on c.id = t.category_id
  where c.code = 'ngoai_ngu' and t.active;
  if bad <> 12 then raise exception 'expected 12 active ngoai_ngu types'; end if;

  if exists (
    select 1 from public.db_record_types t
    where t.active
      and (t.code in (select code from dot1_tt) or exists (select 1 from public.db_categories c where c.id = t.category_id and c.code = 'ngoai_ngu'))
      and (select count(*) from public.db_form_definitions f where f.record_type_id = t.id and f.status = 'published') <> 1
  ) then raise exception 'published form count invalid'; end if;

  if exists (
    select 1 from public.db_form_fields f
    join public.db_form_definitions d on d.id = f.form_definition_id
    join public.db_record_types t on t.id = d.record_type_id
    where d.status = 'published'
      and (t.code in (select code from dot1_tt) or exists (select 1 from public.db_categories c where c.id = t.category_id and c.code = 'ngoai_ngu'))
      and f.required and f.field_key <> 'title'
  ) then raise exception 'only title may be required'; end if;

  if exists (
    select 1 from public.db_record_types t
    join public.db_form_definitions d on d.record_type_id = t.id and d.status = 'published'
    where (t.code in (select code from dot1_tt) or exists (select 1 from public.db_categories c where c.id = t.category_id and c.code = 'ngoai_ngu'))
      and (select count(*) from public.db_form_fields f where f.form_definition_id = d.id and f.field_key = 'title' and f.required and not f.hidden) <> 1
  ) then raise exception 'title must be visible and required'; end if;

  if exists (
    select 1 from public.db_form_fields f
    join public.db_form_definitions d on d.id = f.form_definition_id
    join public.db_record_types t on t.id = d.record_type_id
    where d.status = 'published'
      and (t.code in (select code from dot1_tt) or exists (select 1 from public.db_categories c where c.id = t.category_id and c.code = 'ngoai_ngu'))
      and f.field_key = 'record_code' and not f.hidden
  ) then raise exception 'record_code must be hidden'; end if;

  if exists (
    select 1 from public.db_form_fields f
    join public.db_form_definitions d on d.id = f.form_definition_id
    join public.db_record_types t on t.id = d.record_type_id
    where d.status = 'published'
      and (t.code in (select code from dot1_tt) or exists (select 1 from public.db_categories c where c.id = t.category_id and c.code = 'ngoai_ngu'))
      and not f.hidden and f.data_type in ('select', 'multi_select')
      and (jsonb_typeof(f.options) <> 'array' or jsonb_array_length(f.options) = 0)
  ) then raise exception 'visible select options invalid'; end if;

  if exists (
    select 1 from public.db_form_fields f
    join public.db_form_definitions d on d.id = f.form_definition_id
    join public.db_record_types t on t.id = d.record_type_id
    where d.status = 'published' and t.code in (select code from dot1_tt)
      and f.field_key = 'keywords' and f.data_type <> 'text'
  ) then raise exception 'keywords must be text'; end if;

  if exists (
    select 1 from public.db_form_fields f
    join public.db_form_definitions d on d.id = f.form_definition_id
    join public.db_record_types t on t.id = d.record_type_id
    where d.status = 'published' and t.code in (select code from dot1_tt) and not f.hidden
      and f.field_key not in ('title', 'summary', 'keywords', 'responsible_person', 'reference_url', 'status')
      and not exists (select 1 from dot1_fields x where x.type_code = t.code and x.key = f.field_key)
  ) then raise exception 'unexpected visible communication field'; end if;

  if exists (
    select 1 from dot1_fields x
    join public.db_record_types t on t.code = x.type_code
    join public.db_form_definitions d on d.record_type_id = t.id and d.status = 'published'
    left join public.db_form_fields f on f.form_definition_id = d.id and f.field_key = x.key
    where f.id is null or f.hidden
  ) then raise exception 'expected communication field hidden or missing'; end if;

  if exists (
    select 1 from public.db_record_types t
    join public.db_form_definitions d on d.record_type_id = t.id and d.status = 'published'
    join public.db_form_fields f on f.form_definition_id = d.id
    where t.code = 'ngoai_ngu_ho_so_nhan_vat'
      and ((f.field_key = 'birth_date' and (f.data_type <> 'date' or f.hidden)) or (f.field_key = 'career_history' and (f.data_type <> 'long_text' or f.hidden)))
  ) then raise exception 'ngoai_ngu_ho_so_nhan_vat field invalid'; end if;

  if (select count(*) from public.db_form_fields f join public.db_form_definitions d on d.id = f.form_definition_id join public.db_record_types t on t.id = d.record_type_id where d.status = 'published' and t.code = 'ngoai_ngu_ho_so_nhan_vat' and f.field_key in ('birth_date', 'career_history') and not f.hidden) <> 2 then raise exception 'ngoai_ngu_ho_so_nhan_vat fields missing'; end if;

  if exists (select 1 from public.db_records r join public.db_record_types t on t.id = r.record_type_id where t.code in ('danh_ba_nghiep_vu', 'ngoai_ngu_danh_ba_doi_tac') and r.visibility = 'public') then raise exception 'public directory record remains'; end if;
end
$assert$;

notify pgrst, 'reload schema';

commit;
