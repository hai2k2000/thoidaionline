# Bộ nghiệm thu thủ công Dự án V1/V1.1/V1.2

> Ghi chú phiên bản: form giao việc dự án đang được chỉnh trong PR #132 (hạn hoàn thành không bắt buộc). Nếu nhãn hoặc trường hiển thị khác, ghi chú lại; không xem đó là lỗi của nghiệm thu này.

## Chuẩn bị

- Dùng tài khoản **admin** để cấp/thu hồi quyền trong `/permissions` và kiểm tra quyền quản trị.
- Chọn người thường **U** đang hoạt động, không phải admin/TBT/CTV, chưa có quyền tạo (không chọn hongninh, leson: hai người này đã được cấp riêng `project.create` ngày 04/11); chọn người thường **P** khác làm phó. U và P khác M/trinhdao. Ghi username U: ...; P: ... . Không dùng quangthien thay U vì TBT có quyền tạo mặc định.
- Dùng **M** = một thành viên thường đang hoạt động, không phải trưởng (ví dụ thanhhai hoặc bachduong; ghi username M: ...) và **trinhdao** (vai trò `cong_tac_vien`, CTV).
- Dự án hiện có: `MXH_2026` — “Mạng xã hội”, trưởng **quangthien** (TBT) và **maianh**. Ngày 04/11 không còn task nào đang `Chờ duyệt`; nếu `[TEST] Kiểm tra dự án` của trinhdao không ở `Chờ duyệt` thì bỏ qua E.4; chỉ duyệt task này ở E.4, không thay thành viên/tệp hoặc đóng MXH_2026.
- Các bước có **[DỮ LIỆU]** thay đổi dữ liệu; bước còn lại chỉ quan sát (truy cập có thể ghi nhật ký). Tất cả thao tác khác dùng dự án mới **[TEST] Nghiệm thu dự án**. Chủ sở hữu chỉ thao tác trình duyệt, không chạy lệnh.
- Đăng xuất/đăng nhập đúng tài khoản khi đổi vai; tải lại trang sau mỗi thay đổi quyền. `[id]` là đoạn mã trong URL dự án thử; `[task-id]` là đoạn mã khi bấm tên task. Sao chép URL thật, không gõ dấu ngoặc.
- Trước khi thêm trinhdao vào dự án thử ở E.1, admin lưu URL dự án cho G.2 và thực hiện G.2 trước. Chuẩn bị PDF nhỏ không chứa dữ liệu thật, dưới 10 MiB.
- Mỗi ô ghi `[ ] Đạt / [ ] Lỗi — ghi chú: ...`.

## A. Quyền tạo dự án theo người dùng

1. **Ai đăng nhập:** admin. **Vào đâu:** “Phân quyền” `/permissions` → “Theo người dùng” → U → “Các quyền khác” → “Tìm quyền”: `project.create`, nhóm “Dự án”, dòng “Tạo dự án”. **Làm gì [DỮ LIỆU]:** ghi thiết lập ban đầu, chọn “Cấp riêng”, phạm vi “Toàn cơ quan”; chờ “Đã cập nhật quyền.” (tự lưu, không có nút Lưu cho dòng này).
   **Kết quả mong đợi:** quyền riêng hiển thị là đã cấp; không cấp cho CTV. [ ] Đạt / [ ] Lỗi — ghi chú: ...
2. **Ai đăng nhập:** U. **Vào đâu:** “Dự án” `/projects` → “Tạo dự án” (hoặc `/projects/new`). **Làm gì [DỮ LIỆU]:** nhập “Mã dự án” `TEST_NGHIEM_THU_YYYYMMDD` (thêm số nếu trùng), “Tên dự án” `[TEST] Nghiệm thu dự án`, “Đơn vị chủ trì”; giữ chỉ U làm trưởng, không thêm admin; bấm “Tạo dự án”. Lưu URL dự án thử.
   **Kết quả mong đợi:** thấy nút “Tạo dự án”, tạo thành công; người tạo tự là “Trưởng dự án”. [ ] Đạt / [ ] Lỗi — ghi chú: ...
3. **Ai đăng nhập:** người không có grant (và không có vai trò mặc định admin/TBT). **Vào đâu:** `/projects`, thử `/projects/new`. **Làm gì:** kiểm tra menu và truy cập trực tiếp.
   **Kết quả mong đợi:** không có nút “Tạo dự án”; `/projects/new` bị đưa về `/projects` hoặc bị từ chối. [ ] Đạt / [ ] Lỗi — ghi chú: ...
4. **Ai đăng nhập:** admin, rồi U. **Vào đâu:** `/permissions` → “Theo người dùng” → U → dòng `project.create`. **Làm gì [DỮ LIỆU]:** đổi “Cấp riêng” thành “Kế thừa”; chờ tự lưu; U đăng nhập lại, mở `/projects` và `/projects/new`.
   **Kết quả mong đợi:** không có “Tạo dự án”; URL tạo đưa về `/projects`. U vẫn là trưởng dự án vừa tạo và tiếp tục B được. Không dùng “Khôi phục tất cả mặc định” vì sẽ xoá quyền riêng khác. [ ] Đạt / [ ] Lỗi — ghi chú: ...

## B. Thành viên và phó dự án

1. **Ai đăng nhập:** U. **Vào đâu:** `/projects/[id]` → “Thành viên” (bấm mở phần đang thu gọn) → “Nhân sự đang hoạt động” / “Vai trò”. **Làm gì [DỮ LIỆU]:** chọn M / “Thành viên”, bấm “Thêm thành viên”; làm tương tự với P / “Phó trưởng dự án”.
   **Kết quả mong đợi:** hai vai trò hiển thị đúng. [ ] Đạt / [ ] Lỗi — ghi chú: ...
2. **Ai đăng nhập:** P. **Vào đâu:** `/projects/[id]` → “Công việc và thành viên” → “Giao việc trong dự án”. **Làm gì [DỮ LIỆU]:** chọn “Người nhận việc” M, “Người duyệt” U; nhập “Tên công việc” `[TEST] Phó giao việc`, “Mô tả”, “Yêu cầu”, ngày/giờ “Hạn hoàn thành” nếu form yêu cầu; bấm “Giao việc”, rồi “Mở công việc đã tạo”.
   **Kết quả mong đợi:** phó giao được; người duyệt là trưởng, không chọn phó làm người duyệt. [ ] Đạt / [ ] Lỗi — ghi chú: ...
3. **Ai đăng nhập:** M. **Vào đâu:** `/projects/[id]` → “Công việc trong dự án”. **Làm gì:** chọn “Mọi trạng thái”, “Mọi người”; xem danh sách và tìm nút “Giao việc trong dự án”. Lặp lại bằng U sau C.1 để kiểm tra task không giao cho mình.
   **Kết quả mong đợi:** thấy mọi task dự án nhưng không có quyền giao. [ ] Đạt / [ ] Lỗi — ghi chú: ...
4. **Ai đăng nhập:** M, rồi P. **Vào đâu:** bấm `[TEST] Phó giao việc` → `/tasks/[task-id]`. **Làm gì [DỮ LIỆU]:** M bấm “Hoàn thành”; P mở lại task.
   **Kết quả mong đợi:** “Chờ duyệt”; P không thấy nút duyệt “Hoàn thành”/“Từ chối”, dù P là người giao. Giữ task chờ cho C.2. [ ] Đạt / [ ] Lỗi — ghi chú: ...

## C. Chuyển trưởng dự án

1. **Ai đăng nhập:** trưởng hiện tại. **Vào đâu:** `/projects/[id]` → “Thành viên” → “Chuyển quyền Trưởng dự án”. **Làm gì [DỮ LIỆU]:** chọn M (hoặc thành viên thường), chọn “Vai trò của bạn sau khi chuyển” = “Thành viên”, bấm “Chuyển quyền”.
   **Kết quả mong đợi:** người mới là “Trưởng dự án”; trưởng cũ thành “Thành viên”. Người mới có thể “Giao việc” và duyệt. [ ] Đạt / [ ] Lỗi — ghi chú: ...
   Vai trò cũ do lựa chọn: “Thành viên” mất giao/duyệt; “Phó trưởng dự án” giữ giao nhưng mất duyệt; “Giữ vai trò Trưởng dự án” giữ cả hai. Ca này chọn “Thành viên”, chỉ thay trên dự án thử.
2. **Ai đăng nhập:** M, rồi U. **Vào đâu:** `/projects/[id]`, mở `[TEST] Phó giao việc` đang chờ. **Làm gì [DỮ LIỆU]:** M bấm “Hoàn thành”; quay về “Giao việc trong dự án”, giao `[TEST] Trưởng mới` cho U theo B.2 nhưng chọn “Người duyệt” M. U mở task này và kiểm tra dự án.
   **Kết quả mong đợi:** M duyệt được task cũ và giao được task mới; U thấy mọi task nhưng không có quyền giao/duyệt. [ ] Đạt / [ ] Lỗi — ghi chú: ...

## D. Admin override

1. **Ai đăng nhập:** admin không là thành viên. **Vào đâu:** `/projects` → dự án thử `/projects/[id]` → “Thành viên”. **Làm gì [DỮ LIỆU]:** xác nhận admin không có trong danh sách; dùng “Giao việc trong dự án” giao `[TEST] Admin override` cho U theo B.2, “Người duyệt” chọn chính admin.
   **Kết quả mong đợi:** mở/giao được mà không cần thêm admin vào dự án. [ ] Đạt / [ ] Lỗi — ghi chú: ...
2. **Ai đăng nhập:** U, rồi admin, U, admin. **Vào đâu:** bấm `[TEST] Admin override` → `/tasks/[task-id]`. **Làm gì [DỮ LIỆU]:** U “Hoàn thành”; admin “Từ chối”, nhập `Thử quyền admin`; U gửi lại; admin “Hoàn thành”.
   **Kết quả mong đợi:** lần lượt “Chờ duyệt” → “Đang thực hiện” → “Chờ duyệt” → “Hoàn thành”, không chấm điểm; admin vẫn không là thành viên. [ ] Đạt / [ ] Lỗi — ghi chú: ...

## E. Duyệt không chấm điểm

1. **Ai đăng nhập:** M (trưởng mới), rồi trinhdao. **Vào đâu:** dự án thử `/projects/[id]`. **Làm gì [DỮ LIỆU]:** sau G.2, M thêm trinhdao là “Thành viên”, giao `[TEST] Duyệt không điểm` cho trinhdao theo B.2 nhưng chọn “Người duyệt” M. Trinhdao bấm task → `/tasks/[task-id]` → “Hoàn thành”.
   **Kết quả mong đợi:** task chuyển `Chờ duyệt`; không thấy biểu mẫu điểm. [ ] Đạt / [ ] Lỗi — ghi chú: ...
2. **Ai đăng nhập:** M, rồi trinhdao. **Vào đâu:** `/tasks/[task-id]` của `[TEST] Duyệt không điểm`. **Làm gì [DỮ LIỆU]:** M bấm “Từ chối” (thao tác trả lại), để trống lý do và xác nhận: phải báo “Vui lòng nhập lý do.”, vẫn “Chờ duyệt”. Thử lại với `Bổ sung tệp nghiệm thu`; xem “Trao đổi” có lý do. Trinhdao thực hiện F.1 rồi bấm “Hoàn thành”.
   **Kết quả mong đợi:** lý do được lưu; task về `Đang thực hiện`; gửi lại thành `Chờ duyệt`. [ ] Đạt / [ ] Lỗi — ghi chú: ...
3. **Ai đăng nhập:** M. **Vào đâu:** cùng task `/tasks/[task-id]`. **Làm gì [DỮ LIỆU]:** bấm “Hoàn thành”; kiểm tra toàn bộ chi tiết trước/sau duyệt.
   **Kết quả mong đợi:** “Hoàn thành”; không có “Chấm điểm”, “Chấm điểm hoàn thành”, tổng điểm hay biểu mẫu điểm. [ ] Đạt / [ ] Lỗi — ghi chú: ...
4. **Ai đăng nhập:** quangthien hoặc admin. **Vào đâu:** `/projects` → `MXH_2026` “Mạng xã hội” → `[TEST] Kiểm tra dự án` của trinhdao → `/tasks/[task-id]`. **Làm gì [DỮ LIỆU]:** xác nhận đúng task đang “Chờ duyệt”, không yêu cầu gửi lại; xem nội dung rồi bấm “Hoàn thành”. Nếu trạng thái đã đổi, ghi chú và không sửa task khác.
   **Kết quả mong đợi:** task hiện có được duyệt không điểm; không thay đổi thành viên hoặc đóng MXH_2026. [ ] Đạt / [ ] Lỗi — ghi chú: ...
5. **Ai đăng nhập:** quangthien (TBT có quyền đánh giá). **Vào đâu:** “Đánh giá nhân viên” `/evaluations`, “Bảng đánh giá toàn cơ quan” `/evaluation-summary`; mở chi tiết nhân sự trong kỳ bao gồm ngày thử. **Làm gì:** tìm các task dự án vừa thử trong bằng chứng công việc/điểm.
   **Kết quả mong đợi:** không có task dự án trong dữ liệu chấm điểm/đánh giá; danh sách dự án cũng không có cột điểm. Nếu chưa có kỳ/nhân sự phù hợp, ghi “chưa kiểm chứng” vào ghi chú, không đánh Đạt. [ ] Đạt / [ ] Lỗi — ghi chú: ...

## F. Tệp và thư viện

1. **Ai đăng nhập:** trinhdao, lúc E.2 trả lại task thử. **Vào đâu:** `/tasks/[task-id]` → phần tệp, biểu tượng “Đính kèm tệp” → chọn tệp → nút mũi tên “Tải tệp lên”. **Làm gì [DỮ LIỆU]:** tải PDF thử dưới 10 MiB; bấm “Tải xuống”. Mở dự án thử → “Thư viện” `/projects/[id]?tab=library` → “Tệp từ công việc”, bấm tên tệp.
   **Kết quả mong đợi:** mở được nội dung tải về ở cả hai nơi; thư viện tự hiện tệp kèm liên kết task, không cần tải lại vào thư viện. PDF/PNG/JPEG/DOCX/XLSX được hỗ trợ. [ ] Đạt / [ ] Lỗi — ghi chú: ...
2. **Ai đăng nhập:** trinhdao. **Vào đâu:** dự án thử → “Thư viện” `/projects/[id]?tab=library`, ở gốc. **Làm gì [DỮ LIỆU]:** “Thư mục mới” → “Tên” `[TEST] Thu muc` → “Lưu”; ở thư mục vừa tạo, “Thao tác” → “Đổi tên” → “Tên mới” `[TEST] Da doi ten` → “Lưu”.
   **Kết quả mong đợi:** thư mục tạo/đổi tên được; thư mục hệ thống không bị xoá. [ ] Đạt / [ ] Lỗi — ghi chú: ...

## G. CTV trinhdao

1. **Ai đăng nhập:** trinhdao. **Vào đâu:** menu và các URL `/my-tasks`, `/account`, `/projects`; mở task được giao và dự án mình là thành viên. **Làm gì:** kiểm tra menu, mở thư viện và task.
   **Kết quả mong đợi:** chỉ thấy công việc của tôi, Dự án (nếu có membership), Tài khoản; dùng được chi tiết task/thư viện được phép. [ ] Đạt / [ ] Lỗi — ghi chú: ...
2. **Ai đăng nhập:** trinhdao, thực hiện sau A.2 nhưng trước E.1 (chưa được thêm vào dự án thử). **Vào đâu:** nhập trực tiếp `/permissions`, `/users`, `/evaluations`, và URL thật `/projects/[id]` admin đã sao chép. **Làm gì:** mở từng URL.
   **Kết quả mong đợi:** admin pages bị chặn; dự án không tham gia trả “Bạn không có quyền xem dự án này.” hoặc từ chối. [ ] Đạt / [ ] Lỗi — ghi chú: ...

## H. Đóng dự án

1. **Ai đăng nhập:** M, rồi P. **Vào đâu:** dự án thử `/projects/[id]`. **Làm gì [DỮ LIỆU]:** làm cuối cùng. P mở sẵn “Giao việc trong dự án” trong cửa sổ riêng, điền task `[TEST] Sau dong`; M bấm “Đóng dự án”. P thử bấm “Giao việc” trên form cũ, rồi tải lại trang.
   **Kết quả mong đợi:** “Đã đóng”; form cũ bị từ chối, không tạo task mới; sau tải lại cả trưởng/phó không còn “Giao việc trong dự án”. [ ] Đạt / [ ] Lỗi — ghi chú: ...

## Dọn dẹp sau khi thử

- **[DỮ LIỆU]** Admin vào `/permissions` → “Theo người dùng” → U → `project.create`, xác nhận đã về “Kế thừa” như A.4; nếu đã thử “Chặn riêng”, cũng trả về thiết lập ban đầu. Không xoá quyền riêng khác.
- **[DỮ LIỆU]** Đóng dự án `[TEST] Nghiệm thu dự án`; không xoá MXH_2026 và không xoá task test production.
- Ghi lại mã dự án/task, thời điểm, tài khoản, lỗi và ảnh chụp màn hình nếu có.
