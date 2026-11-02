# CSDL giai đoạn 2: tách nhóm đoàn thể và phân quyền theo nhóm hồ sơ (bản nháp)

Trạng thái: đã triển khai production 2026-11-02 (PR #108, #109)

Trạng thái: **owner đã chốt 2026-11-02**. Nguồn: góp ý của Phòng Tổng hợp (người lập: Hoàng Quỳnh Trang).

## 1. Mục tiêu
1. Tách nhóm "Các tổ chức đoàn thể" (`doan_the_quan_ly`, 16 loại) thành các nhóm riêng, và thêm các nhóm còn thiếu.
2. Thay quy tắc "chỉ Admin xem" bằng **quyền truy cập theo nhóm hồ sơ**, cấp cho từng người trong trang phân quyền.
3. Mỗi loại hồ sơ có form riêng theo đề xuất của Tổng hợp, dùng cơ chế `hidden` và `validation.help` đã có. Không tách bảng.

## 2. Nhóm hồ sơ mới (top-level)
| code | Tên | Hạn chế (restricted) | Loại hồ sơ |
|---|---|---|---|
| `cong_tac_dang` | Công tác Đảng | có | 10 loại, mục 3 |
| `chi_hoi_nha_bao` | Chi hội Nhà báo | có | 5 loại `nha_bao_*` hiện có |
| `cong_doan` | Công đoàn | có | 5 loại mới, mục 4 |
| `doan_thanh_nien` | Đoàn Thanh niên | có | `doan_tn_van_ban` hiện có |
| `cuc_bao_chi` | Hồ sơ, văn bản Cục Báo chí | có | 4 loại `cuc_bc_*` hiện có |
| `lien_hiep` | Hồ sơ, văn bản Liên hiệp | có | 6 loại mới: Quyết định; Nghị quyết; Chương trình hành động; Báo cáo định kỳ; Bản tin; Báo cáo theo yêu cầu |
| `phap_ly_dieu_hanh` | Hồ sơ pháp lý, tổ chức và quản lý điều hành | không | 3 loại mới, mục 5 |

Cách chuyển:
- Chuyển các loại hiện có sang nhóm mới bằng cách cập nhật `category_id`, đồng thời cập nhật `db_records.category_id` của các hồ sơ thuộc loại đó.
- Đổi tên loại: bỏ tiền tố "Đảng – ", "Cục Báo chí – " vì tên nhóm đã nói rõ.
- `doan_the_quan_ly`: đặt `active=false`. Không xóa.

## 3. Công tác Đảng: 10 loại
Đối chiếu với 6 loại hiện có (đều chưa có hồ sơ):
1. **Hồ sơ đảng viên** (mới). Trường: Họ và tên (title); Ngày sinh; Chi bộ; Ngày vào Đảng; Ngày chính thức; Số thẻ đảng viên; Chức vụ trong Đảng; Tình trạng sinh hoạt; Quá trình sinh hoạt/chuyển sinh hoạt (long_text); Người quản lý.
2. **Sinh hoạt chi bộ, nghị quyết và kết luận**: đổi tên `dang_bien_ban_sinh_hoat`. Gộp luôn "sinh hoạt chuyên đề": `dang_sinh_hoat_chuyen_de` đặt inactive, trường "Loại sinh hoạt" có lựa chọn Thường kỳ / Chuyên đề. Trường: Tên cuộc họp/chuyên đề; Loại sinh hoạt; Kỳ (tháng/quý/năm); Ngày giờ; Địa điểm; Thành phần; Chủ trì; Thư ký; Nội dung chính; Nghị quyết/kết luận; Nhiệm vụ được giao; Hạn hoàn thành; Người theo dõi.
3. **Phát triển Đảng, kết nạp và chuyển sinh hoạt** (mới). Trường: Họ và tên; Nhóm thủ tục [Nguồn kết nạp / Kết nạp / Chính thức / Chuyển sinh hoạt]; Chi bộ; Ngày tiếp nhận; Các mốc xử lý; Văn bản liên quan; Người theo dõi; Tình trạng; Thời hạn.
4. **Kiểm tra, giám sát và đánh giá đảng viên** (mới). Trường: Năm/kỳ; Nội dung; Đối tượng; Văn bản căn cứ; Ngày thực hiện; Kết luận/kết quả; Xếp loại; Kiến nghị; Thời hạn khắc phục; Người theo dõi.
5. **Văn bản chỉ đạo, hướng dẫn và triển khai**: đổi tên `dang_bao_cao_cong_van`. Trường: Số, ký hiệu; Ngày ban hành; Cơ quan ban hành; Loại văn bản [Nghị quyết / Chỉ thị / Kết luận / Quy định / Hướng dẫn / Kế hoạch / Công văn]; Trích yếu; Lĩnh vực; Đơn vị/cá nhân thực hiện; Thời hạn; Tình trạng thực hiện.
6. **Hồ sơ đại hội chi bộ các nhiệm kỳ**: `dang_dai_hoi`. Trường: Nhiệm kỳ; Tên đại hội; Thời gian, địa điểm; Kết quả bầu cử; Người quản lý hồ sơ. Các văn kiện, báo cáo, biên bản đính kèm ở mục Tệp; ghi vào help.
7. **Kế hoạch, chương trình công tác Đảng định kỳ hằng năm**: đổi tên `dang_van_ban_dinh_ky`. Trường: Năm; Tên kế hoạch; Số, ký hiệu; Ngày ban hành; Nhiệm vụ trọng tâm; Chỉ tiêu; Phân công; Thời hạn; Tiến độ; Kết quả; Người theo dõi.
8. **Báo cáo định kỳ, sơ kết và tổng kết**: đổi tên `dang_tong_ket_nam`. Trường: Năm/kỳ; Loại báo cáo [Tháng / Quý / 6 tháng / Năm / Nhiệm kỳ / Đột xuất]; Số, ký hiệu; Ngày ban hành; Nội dung; Kết quả; Hạn chế; Phương hướng; Kiến nghị; Cơ quan nhận; Người lập; Người phê duyệt.
9. **Đánh giá, xếp loại tổ chức đảng và đảng viên hằng năm** (mới). Trường: Năm; Tổ chức/cá nhân được đánh giá; Nội dung kiểm điểm; Kết quả biểu quyết; Mức xếp loại; Người quản lý.
10. **Thi đua, khen thưởng và kỷ luật** (mới). Trường: Năm; Loại [Thi đua / Khen thưởng / Kỷ luật]; Tập thể/cá nhân; Nội dung thành tích/vi phạm; Hình thức; Cấp quyết định; Kết quả xử lý.

Quy ước chung:
- Mọi form giữ các trường gốc: title, summary, keywords, responsible_person, status, record_code.
- Trường không dùng thì đặt `hidden`.
- Chỉ `title` bắt buộc.
- "Mức độ bảo mật" không làm thành trường riêng, vì phân quyền theo nhóm (mục 6) đã đáp ứng.

## 4. Công đoàn: 5 loại
1. **Văn bản đến**: Số, ký hiệu; Ngày ban hành; Ngày tiếp nhận; Cơ quan ban hành; Loại văn bản; Trích yếu; Yêu cầu thực hiện; Người xử lý; Thời hạn; Tình trạng.
2. **Văn bản đi**: Số, ký hiệu; Ngày ban hành; Loại văn bản; Trích yếu; Người soạn thảo; Người ký; Nơi nhận; Ngày phát hành; Tình trạng.
3. **Danh sách đoàn viên và quản lý đoàn viên**: Họ và tên; Ngày sinh; Bộ phận; Ngày gia nhập; Mã số đoàn viên; Chức vụ Công đoàn; Tình trạng; Chuyển đến/chuyển đi.
4. **Danh sách thu đoàn phí hằng tháng**: lưu theo kỳ, kèm file danh sách. Không nhập từng người. Trường: Tháng/năm; Tổng phải thu (number); Tổng thực thu (number); Còn phải thu (number); Người lập; Người kiểm tra.
5. **Sổ theo dõi thu, chi tài chính**: lưu theo kỳ, kèm file sổ hoặc chứng từ. Không làm sổ kế toán. Trường: Năm tài chính; Kỳ; Tổng thu; Tổng chi; Số dư; Người lập; Người phê duyệt.

## 5. Pháp lý, tổ chức và quản lý điều hành: 3 loại
1. **Hồ sơ pháp lý và tổ chức hoạt động**: giấy phép hoạt động, quyết định thành lập, chức năng nhiệm vụ, cơ cấu tổ chức. Trường: Loại văn bản; Số, ký hiệu; Cơ quan ban hành; Ngày ban hành; Ngày hiệu lực; Tình trạng hiệu lực.
2. **Nội quy, quy chế, quy định nội bộ**: nội quy, quy chế làm việc, chi tiêu nội bộ, trả lương, nhuận bút, đề án vị trí việc làm. Trường như mục 1, thêm "Văn bản thay thế/bị thay thế". Có chuyển loại `quy_che_quy_dinh_quy_trinh` của Tổng hợp sang đây không?
3. **Văn bản quản lý, chỉ đạo và điều hành**: quyết định, kế hoạch, thông báo, hướng dẫn do Tạp chí ban hành. Trường: Loại; Số, ký hiệu; Người ký; Ngày ban hành; Đơn vị thực hiện; Thời hạn.

## 6. Phân quyền theo nhóm hồ sơ
**Dữ liệu**
- Thêm cột `db_categories.restricted boolean not null default false`. Đặt `true` cho các nhóm "có" ở mục 2.
- Bảng mới `db_category_access_grants(user_id → staff_users on delete cascade, category_id → db_categories, level text check in ('view','contribute','approve'), granted_by, created_at, primary key(user_id, category_id))`. Bật RLS, chỉ `service_role` truy cập.

**Quy tắc** (thay predicate `doan_the_quan_ly` trong RPC search, RPC transition và `policy.ts`):
- Nhóm hạn chế là nhóm có `restricted=true`, xét cả nhóm cha.
- Hồ sơ thuộc nhóm hạn chế chỉ hiện với:
  - Admin (`record.sensitive.access`);
  - người có grant của nhóm đó, ở bất kỳ level nào.

  Người có grant thấy mọi hồ sơ trong nhóm, không phụ thuộc phòng ban.
- Tạo và sửa hồ sơ trong nhóm hạn chế cần `record.create` cộng grant level `contribute` hoặc `approve`.
- Duyệt hồ sơ trong nhóm hạn chế cần grant `approve` hoặc Admin. Hồ sơ trong nhóm hạn chế **không** dùng quy tắc trưởng phòng duyệt.
- Catalog: nhóm hạn chế chỉ hiện trong ô chọn khi người dùng có grant `contribute` hoặc `approve`, hoặc là Admin.
- Giữ predicate 4 code cũ (`ho_so_dang` …) để an toàn.

**Giao diện**
- Trang phân quyền, phần từng user: mục "Nhóm hồ sơ hạn chế", mỗi nhóm một ô chọn [Không / Xem / Đóng góp / Duyệt]. Chỉ người có `permission.manage` thao tác được.

**Migration**
- Viết lại tường minh cả 2 RPC, lấy bản mới nhất làm gốc (xem HANDOFF mục 2).
- Khối DO assertion cuối:
  - định nghĩa hàm có `db_category_access_grants`;
  - nhóm `doan_the_quan_ly` không còn loại nào active;
  - các nhóm hạn chế tồn tại.

## 7. Kiểm thử bắt buộc
Ma trận user:
- Admin;
- A có grant view cho `cong_tac_dang`;
- B có grant approve cho `cong_doan`;
- C không có grant nào.

Hồ sơ: mỗi nhóm hạn chế có hồ sơ nháp và hồ sơ đã duyệt, thêm một hồ sơ pháp lý không hạn chế.

Kỳ vọng:
- A thấy Đảng, không tạo được hồ sơ Đảng.
- B tạo và duyệt được hồ sơ Công đoàn, không thấy hồ sơ Đảng.
- C không thấy nhóm hạn chế nào.
- Admin thấy tất cả.
