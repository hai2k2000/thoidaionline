# Góp ý tổ ngoại ngữ và Phòng Truyền thông — 02/11/2026

## Nguồn góp ý

- Phòng Nội dung: Tổ tiếng Anh, Tổ tiếng Trung, Tổ tiếng Nga, Tổ tiếng Lào, Tổ Khmer.
- Phòng Truyền thông (văn bản ngày 01/11/2026).

## Tổ ngoại ngữ

Phần lớn góp ý đã có trong form từ migration `20261102100000`: thêm Tổ Tiếng Nga; tách hồ sơ tổ chức, sự kiện, văn kiện; bỏ "Vị trí hồ sơ giấy"; danh bạ có loại đối tượng, chức vụ, điện thoại, email, địa chỉ; đề tài có loại hình, thời gian, nhân sự; phỏng vấn có người được phỏng vấn, hình thức; thuật ngữ có cột tiếng Việt và cách dịch chuẩn; tài liệu nguồn có loại, ngày tiếp nhận, quyền sử dụng.

Đợt 1 (migration `20261102190000`) làm thêm:

- Mã hồ sơ tự sinh và ẩn; Trạng thái không bắt buộc (giống Tổ Tiếng Việt).
- Thêm loại "Hồ sơ nhân vật" (họ tên, tiểu sử, chức danh, cơ quan, quốc tịch, ngày sinh, quá trình công tác, lĩnh vực). Theo góp ý Tổ Nga, Tổ Lào; giữ riêng như quyết định với Tổ Tiếng Việt.
- Đổi tên "Nhân vật, đối tác, chuyên gia, cộng tác viên" thành "Danh bạ đối tác, chuyên gia, cộng tác viên".
- Danh bạ ngoại ngữ chỉ trong phạm vi phòng, không được để tài liệu chung (UI, repository, trigger). Số điện thoại, email, địa chỉ của nhân vật lưu ở danh bạ, không lưu ở Hồ sơ nhân vật.

Không làm:

- Tổ tiếng Anh đề nghị bỏ "Ảnh, video, multimedia", "Dữ liệu nền", "Đề tài"; các tổ khác vẫn dùng. Danh mục dùng chung cho mọi tổ; chỉ "Tên" bắt buộc, tổ không dùng loại nào thì bỏ qua.
- Tổ tiếng Trung đề nghị bỏ "nhân vật" vì trùng danh bạ; không theo, vì danh bạ là thông tin liên hệ, hồ sơ nhân vật là tiểu sử.
- Tổ Khmer liệt kê trường tối thiểu: form hiện tại đáp ứng vì các trường khác không bắt buộc.

## Phòng Truyền thông

Đợt 1 (migration `20261102190000`):

- Form mới cho 9 loại hồ sơ theo danh sách trường của phòng: khách hàng – đối tác; đề xuất – báo giá – thương thảo; hợp đồng; sản phẩm truyền thông theo hợp đồng; nghiệm thu – bàn giao – thanh lý; thanh toán – quyết toán tham chiếu; tài trợ – quảng cáo – hợp tác; kho thiết kế – nhận diện; báo cáo – thống kê (lưu file báo cáo).
- Bỏ các trường trùng của form cũ (hai "Người phụ trách", "Đối tác"/"Tên đối tác", "Thời hạn đến"/"Ngày kết thúc", "Vị trí hồ sơ giấy").
- Tình trạng báo giá, hợp đồng, sản phẩm, nghiệm thu, thanh toán là ô chọn; giá trị tiền là trường số.
- Mọi loại liên quan hợp đồng có "Mã khách hàng / đối tác" và "Số hợp đồng". Gõ số hợp đồng hoặc mã khách hàng vào ô tìm kiếm để thấy mọi hồ sơ liên quan (cách tạm thay cho liên kết hồ sơ).
- Lỗi "Ngày kết thúc không nhập được": ô ngày hiển thị theo định dạng trình duyệt (mm/dd/yyyy trên máy tiếng Anh), gõ ngày kiểu Việt Nam bị sai. Ô ngày của CSDL đổi sang nhập dd/mm/yyyy.

Để giai đoạn sau (Giai đoạn 3):

- Báo cáo tự tổng hợp: hợp đồng, doanh thu, thu tiền và công nợ, tiến độ, hiệu quả truyền thông, khách hàng; xuất Excel theo thời gian, khách hàng, người phụ trách, loại dịch vụ.
- Liên kết hồ sơ thật sự (từ một hợp đồng mở ra báo giá, phụ lục, sản phẩm, nghiệm thu, hóa đơn, công nợ).
- Phân quyền Phòng Tổng hợp cập nhật, đối chiếu hóa đơn, thanh toán, doanh thu, công nợ trong nhóm Phòng Truyền thông (hiện cấp quyền theo nhóm chỉ áp dụng cho nhóm hạn chế).
