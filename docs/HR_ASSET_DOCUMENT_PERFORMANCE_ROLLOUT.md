# Rollout kế hoạch: Hồ sơ nhân sự + Hiệu suất + Tài sản + Công văn

## Mục tiêu
Triển khai theo từng pha để tránh tràn phạm vi và tránh nghẽn tài nguyên (RAM/CPU/context).

## Phạm vi MVP (đã tạo schema)
- HR Profile: `employee_profiles`
- Performance: `performance_cycles`, `performance_criteria`, `performance_reviews`
- Asset: `assets`, `asset_assignments`
- Official Documents: `official_documents`, `document_assignments`
- Audit: `audit_logs`

Migration đã thêm:
- `supabase/migrations/20260320114500_hr_assets_documents_performance_mvp.sql`

---

## Triển khai từng bước (khuyến nghị)

### Bước 1 — Database foundation (DONE ở mức code)
- [x] Tạo schema + index + constraint
- [x] Bật RLS permissive cùng chuẩn hiện tại của dự án
- [ ] Apply migration lên môi trường test
- [ ] Verify số bảng và ràng buộc chính

### Bước 2 — API/service layer (1 sprint)
- [ ] Tạo module query cho 4 nhóm bảng (lib/services)
- [ ] Chuẩn hóa helper ghi `audit_logs`
- [ ] Thêm validation input (zod hoặc tương đương)
- [ ] Rule cơ bản:
  - Không xóa cứng bản ghi tài sản/công văn đã phát sinh giao dịch
  - Các bản ghi dùng `status` để đóng/mở

### Bước 3 — UI MVP (1–2 sprint)
Ưu tiên màn hình cốt lõi trước:
1. Nhân sự
   - Danh sách nhân sự
   - Chi tiết hồ sơ
   - Lịch sử hợp đồng/trạng thái
2. Tài sản
   - Danh sách tài sản
   - Cấp phát/thu hồi
3. Công văn
   - Sổ công văn đến/đi
   - Chi tiết + giao xử lý + deadline
4. Hiệu suất
   - Danh sách kỳ đánh giá
   - Phiếu đánh giá nhân viên

### Bước 4 — Báo cáo nhẹ + thông báo (1 sprint)
- [ ] Dashboard tổng quan: số công văn quá hạn, tài sản đang cấp phát, tỷ lệ hoàn tất đánh giá
- [ ] Nhắc việc deadline (document assignments)

---

## Checklist chống “tràn”

### Chống tràn phạm vi
- Mỗi sprint chỉ chốt 1 module chính + 1 module phụ.
- Feature chưa có acceptance criteria thì không code.
- Mỗi module UI tối đa 3 màn hình trước khi mở rộng.

### Chống tràn tài nguyên máy
- Không chạy build/lint/test cùng lúc nhiều repo.
- Chạy migration theo từng file, không batch quá lớn.
- Sau mỗi bước lớn, kiểm tra `free -h` và swap.

### Chống tràn context đội dev
- Dùng changelog ngắn theo ngày (what/why/rollback).
- Mỗi PR chỉ 1 mục tiêu rõ ràng.
- Luôn có rollback SQL tối thiểu (drop policy/table mới nếu cần).

---

## Đề xuất sprint thực tế
- Sprint A: HR profile + API + 2 màn hình
- Sprint B: Asset management + API + cấp phát/thu hồi
- Sprint C: Official documents + assignment workflow
- Sprint D: Performance review + báo cáo nhẹ

---

## Ghi chú bảo mật
MVP hiện đang theo mode RLS permissive (đồng bộ với hệ thống hiện tại). Khi ổn định nghiệp vụ, chuyển dần sang role-based policies theo `role_permissions`.
