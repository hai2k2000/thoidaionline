# Runbook production RBAC Approval V1

1. Merge PR `feature/rbac-approval-v1` vào `integration/production`.
2. Từ `integration/production`, build artifact và kiểm tra:
   `npm run package:standalone`, `npm run artifact:manifest`, `npm run artifact:verify`, `npm run artifact:secret-scan`.
3. Chạy kiểm tra DB không thay đổi:
   `BUNDLE_DIR=<artifact> scripts/production/rbac-approval-production-apply.sh --verify-only`.
4. Owner duyệt chính xác: `APPROVE RBAC-APPROVAL PRODUCTION` (tương ứng biến `THOIDAI_RBAC_PROD_APPROVED=APPROVE-RBAC-APPROVAL-PRODUCTION`).
5. Chạy `--apply`. Đây là migration-first: app cũ vẫn chạy vì chữ ký RPC không đổi và seed tái tạo quyền truy cập hiện tại.
6. Kiểm tra artifact rồi activate: `scripts/production/deploy-external-artifact.sh <dir> <sha> --verify-only`, sau đó `THOIDAI_EXTERNAL_DEPLOY_APPROVED=1 ... --activate`.
7. Kiểm tra `http://127.0.0.1:3001/login` trả 200 và service không restart.
8. Nghiệm thu thủ công: owner chọn một nhân sự thật; admin cấp `schedule.business.approve` với scope phòng ban; nhân sự thấy và duyệt đúng hàng chờ; admin thu hồi; nhân sự nhận 403; cuối cùng khôi phục grant về trạng thái ban đầu.

## Rollback

- App: chuyển pointer về `previous`.
- DB: chỉ chạy `scripts/production/rbac-approval-v1-revert.sql` khi cần. Nếu migration attendance-RBAC (PR #63) đã chạy, revert chúng trước rồi mới chạy file này.
- Để DB đã migrate cùng app cũ là an toàn: chữ ký RPC giữ nguyên, còn app cũ tiếp tục dùng các RPC tương thích; rollback DB chỉ cần khi phải khôi phục hành vi P1.

Known issue: các RPC khác trên production vẫn có thể raise `40001`; xem `C:\Users\hai2k\Desktop\hai2k\claude\cpay\thoidai-40001\`.
