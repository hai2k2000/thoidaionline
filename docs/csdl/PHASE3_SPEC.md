# CSDL giai đoạn 3: nhóm con Phòng Tổng hợp (bản nháp)

Trạng thái: **nháp**. Làm sau giai đoạn 2, vì nhóm Tổ chức – Cán bộ dùng cơ chế nhóm hạn chế của giai đoạn 2.

## 1. Vấn đề
Phòng Tổng hợp có nhiều mảng việc, nên ô chọn loại hồ sơ của phòng quá dài. Phòng đề nghị chia nhóm con: Kế toán, Văn thư – Lưu trữ, Tổ chức – Cán bộ, Quản trị – Lễ tân, Công nghệ, Pháp chế, Đối ngoại, An sinh/xã hội…

## 2. Thiết kế
- Nhóm con là `db_categories` có `parent_id` trỏ tới `tong_hop`; loại hồ sơ gắn trực tiếp vào nhóm con.
- **Giao diện:** khi nhóm đã chọn có nhóm con, hiện thêm ô "Nhóm con", giống cách Phòng Nội dung đang chọn tổ ngôn ngữ.
  - Cần tổng quát hóa code hiện tại trong `languageGroup.mjs`, `DatabaseRecordForm.tsx` và bộ lọc ở trang danh sách.
  - Phải giữ nguyên hành vi tổ ngôn ngữ của Phòng Nội dung.
- **Bước này chỉ tạo các nhóm con đã có danh mục:** Văn thư – Lưu trữ, Tổ chức – Cán bộ, và "Tổng hợp chung" để chứa các loại hiện có còn lại. Kế toán, Quản trị, Công nghệ, Pháp chế, Đối ngoại: làm khi Phòng Tổng hợp gửi danh mục.

## 3. Chuyển 12 loại hiện có
| code | Chuyển vào |
|---|---|
| `van_ban_den`, `van_ban_di`, `so_sach_van_thu_luu_tru`, `bieu_mau_hanh_chinh` | Văn thư – Lưu trữ |
| `bao_cao`, `bien_ban_ket_luan_hop`, `ho_so_cong_viec_trong_tam`, `ke_hoach_cong_tac`, `phieu_giao_viec`, `van_ban_noi_bo`, `cho_phan_loai` | Tổng hợp chung |
| `quy_che_quy_dinh_quy_trinh` | Theo quyết định ở giai đoạn 2, mục 5.2 |

## 4. Văn thư – Lưu trữ
**Văn bản đến**
- Hiện: Số đến; Ngày đến; Cơ quan gửi; Số, ký hiệu; Ngày ban hành; Loại văn bản; Trích yếu (title); Mức độ khẩn [Thường / Khẩn / Thượng khẩn / Hỏa tốc]; Độ mật [Thường / Mật / Tối mật]; Người/bộ phận xử lý; Hạn xử lý; Tình trạng xử lý [Chưa xử lý / Đang xử lý / Đã xử lý]; Văn bản trả lời (liên kết); Vị trí lưu bản giấy.
- Form hiện tại đã có `document_number`, `sender_organization`, `received_date`, `handler`, `processing_deadline`, `original_location`. Tái sử dụng các trường này, ẩn các trường gốc không dùng.

**Văn bản đi**
- Trường: Số, ký hiệu; Loại văn bản; Ngày ký/ban hành; Trích yếu; Người ký; Bộ phận soạn thảo; Nơi nhận; Mức độ khẩn; Độ mật; Hình thức phát hành; Ngày phát hành; Vị trí lưu bản giấy.

## 5. Tổ chức – Cán bộ (nhóm hạn chế, `restricted=true`)
**Nguyên tắc:** hệ thống đã có module Hồ sơ nhân sự (`/hr-profiles`) và Đánh giá. CSDL **chỉ lưu văn bản và quyết định**, liên kết tới nhân sự bằng trường kiểu `person`. Không nhập lại ngày sinh, quá trình công tác hay trình độ.

4 loại:
1. **Tài liệu hồ sơ nhân sự:** Nhân sự (person); Loại tài liệu [Sơ yếu lý lịch / Bằng cấp / Quyết định / Khác]; Ngày tài liệu; Người quản lý.
2. **Hợp đồng lao động và phụ lục:** Nhân sự; Số hợp đồng/phụ lục; Loại hợp đồng; Ngày ký; Ngày hiệu lực; Thời hạn; Ngày hết hạn; Vị trí việc làm; Tình trạng ký. Không lưu mức lương dạng trường; mức lương nằm trong file. [HỎI OWNER]
3. **Bổ nhiệm, điều động, biến động nhân sự:** Nhân sự; Hình thức biến động; Vị trí trước; Vị trí sau; Số quyết định; Ngày ký; Ngày hiệu lực; Cấp quyết định; Tình trạng.
4. **Đánh giá, thi đua – khen thưởng, kỷ luật:** Cá nhân/tập thể; Kỳ/năm; Kết quả xếp loại; Hình thức khen thưởng/kỷ luật; Số, ngày văn bản; Cấp quyết định; Người tổng hợp.

## 6. Kiểm thử
- Chọn Phòng Tổng hợp thì hiện ô Nhóm con.
- Chọn Văn thư – Lưu trữ thì chỉ hiện 4 loại của nhóm đó.
- Bộ lọc trang danh sách theo nhóm cha bao gồm cả hồ sơ thuộc các nhóm con.
- Phòng Nội dung chọn tổ ngôn ngữ như cũ.
- Tổ chức – Cán bộ ẩn với người không có grant.
