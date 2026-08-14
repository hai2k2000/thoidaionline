# Thiết kế đặt lại mật khẩu nhân viên qua email

**Ngày:** 2026-08-14

**Trạng thái:** Đã được người dùng phê duyệt

**Phạm vi sản phẩm:** Thời Đại Work (`thoidai.online`)

## 1. Mục tiêu

Thêm nút đặt lại mật khẩu vào modal **Thông tin nhân sự** tại trang `/users`. Chỉ Admin được phép sử dụng nút này. Hệ thống gửi liên kết đặt lại mật khẩu dùng một lần tới email đã đăng ký của nhân viên, ghi nhận đầy đủ audit an toàn, và thu hồi mọi phiên đăng nhập cũ của nhân viên ngay khi mật khẩu mới được thiết lập thành công.

Thiết kế phải giữ nguyên luồng đăng nhập hiện tại, không làm người dùng đang đăng nhập bị đăng xuất hàng loạt khi phát hành, không đưa bí mật hoặc dữ liệu xác thực vào log/audit, và không làm mất các thay đổi đang tồn tại trong dirty worktree trên VPS.

## 2. Phạm vi

### 2.1 Trong phạm vi

- Bổ sung nút và trạng thái UX đặt lại mật khẩu trong modal quản lý nhân viên tại `src/app/users/page.tsx`.
- Giữ quyền thao tác ở mức Admin-only cả trên client và server.
- Dùng luồng email chứa liên kết một lần, hiệu lực 60 phút.
- Trả lỗi cụ thể cho Admin khi target không tồn tại, inactive, thiếu email, chuẩn bị reset thất bại, gửi email thất bại hoặc ghi audit thất bại.
- Vô hiệu hóa các reset token cũ của cùng target trước khi phát hành token mới.
- Thêm `session_version` và tăng version khi reset token được consume thành công để thu hồi toàn bộ session cũ của target.
- Ghi audit bắt buộc trước khi gửi email, sau đó kết thúc audit ở trạng thái `sent` hoặc `failed`.
- Bổ sung migration, kiểm thử, quy trình backup, rollout, health check và rollback tương ứng.

### 2.2 Ngoài phạm vi

- Cho Admin đặt hoặc xem mật khẩu tạm của nhân viên.
- Hiển thị raw reset token, token hash, password, password hash hoặc nội dung credential ở UI, API response, log hay audit.
- Cho role ngoài `admin` dùng nút reset, kể cả role có `can_manage_users`.
- Thay thế toàn bộ cơ chế HMAC cookie bằng Supabase Auth hoặc một hệ thống session mới.
- Sửa rộng RLS/audit policy hiện hữu ngoài những grant tối thiểu cần cho các RPC reset mới.
- Thay đổi Codex provider/model hoặc cơ chế CLIProxyAPI/9router đang hoạt động.
- Dọn dẹp, reset, stash, revert hoặc commit các thay đổi hiện hữu trong dirty worktree.

## 3. Hiện trạng và ràng buộc

- `src/app/users/page.tsx` đã có modal xem/sửa nhân viên. Email chỉ được hiển thị; Admin mới thấy hành động thay đổi dữ liệu.
- `src/app/api/auth/admin-reset/route.ts` đã có khung Admin gửi email reset nhưng hiện trả thành công kể cả khi thiếu email hoặc gửi thất bại.
- Reset token hiện được lưu dưới dạng hash, có `expires_at`, `used_at`, và được consume qua `public.consume_password_reset`.
- Cookie session hiện là HMAC stateless, TTL 8 giờ, payload chỉ có `userId` và `expiresAt`; chưa có issued-at, session ID hay version.
- `getSessionUser()` là điểm xác minh tập trung cho các API đã được bảo vệ và luôn đọc lại user active cùng role/permission từ database.
- `audit_logs.action` là `text`, không có enum/check constraint. Audit helper phía ứng dụng có union TypeScript nhưng không phải ràng buộc database.
- Worktree `/opt/thoidai-work` đang chứa nhiều thay đổi tracked và untracked có trước tính năng này. Toàn bộ phải được xem là dữ liệu người dùng cần bảo toàn.

## 4. Thiết kế UI trong modal nhân viên

### 4.1 Vị trí và quyền hiển thị

- Đặt nút **Đặt lại mật khẩu** trong footer của modal **Thông tin nhân sự**, cùng khu vực với **Đóng** và **Lưu thay đổi**.
- Chỉ render nút khi `user.role_code === "admin"`.
- Việc ẩn nút chỉ là bảo vệ UX; API vẫn phải tự xác minh session và role Admin.
- Admin được phép gửi reset cho mọi nhân viên đủ điều kiện, kể cả chính tài khoản Admin đang đăng nhập. Nếu Admin tự đổi mật khẩu qua liên kết, session hiện tại của Admin cũng bị thu hồi khi consume thành công.

### 4.2 Điều kiện enable/disable

Nút được enable chỉ khi target:

- Có `id` hợp lệ.
- Có email đã đăng ký.
- Đang ở trạng thái active.
- Không có yêu cầu reset đang được gửi từ modal hiện tại.

Nút bị disable khi thiếu email hoặc target inactive. UI hiển thị giải thích ngay cạnh nút:

- Thiếu email: **Nhân viên chưa có email đăng ký.**
- Inactive: **Không thể đặt lại mật khẩu cho tài khoản đã khóa.**

Client không được tự suy luận rằng thao tác hợp lệ chỉ dựa trên dữ liệu đã tải; server phải kiểm tra lại target mới nhất.

### 4.3 Xác nhận và state machine

Nhấn nút mở confirm dialog riêng, không gửi ngay. Nội dung xác nhận nêu tên hiển thị của nhân viên và nói rằng hệ thống sẽ gửi liên kết đến email đã đăng ký; không cần lặp lại địa chỉ email đầy đủ.

UI dùng các trạng thái rõ ràng:

1. `idle`: nút sẵn sàng.
2. `confirming`: confirm dialog đang mở.
3. `submitting`: request đang chạy; disable nút xác nhận, nút reset và thao tác đóng gây gửi lặp; hiển thị **Đang gửi...**.
4. `success`: hiển thị **Đã gửi liên kết đặt lại mật khẩu. Liên kết có hiệu lực trong 60 phút.**
5. `error`: hiển thị thông điệp an toàn dựa trên error code của API và cho phép thử lại có chủ đích.

Khi chọn nhân viên khác hoặc đóng modal, reset state trở về `idle`. Một click chỉ tạo tối đa một request. Các control phải có label/disabled state truy cập được bằng bàn phím và screen reader.

## 5. Hợp đồng API Admin reset

### 5.1 Endpoint

`POST /api/auth/admin-reset`

Request JSON:

```json
{ "userId": "00000000-0000-4000-8000-000000000000" }
```

Success response:

```json
{
  "ok": true,
  "code": "reset_email_sent",
  "message": "Đã gửi liên kết đặt lại mật khẩu."
}
```

Response không được chứa target email, raw token, token hash hoặc provider payload. Response dùng `Cache-Control: private, no-store`.

### 5.2 Guard và lỗi cụ thể

Thứ tự guard bắt buộc:

1. Kiểm tra same-origin bằng `isSameOriginRequest()`.
2. Đọc actor qua `getSessionUser()`.
3. Yêu cầu chính xác `actor.role_code === "admin"`.
4. Validate JSON và UUID target.
5. Đọc lại target từ database và kiểm tra tồn tại, active, có email.

API dùng cấu trúc lỗi `{ "ok": false, "code": "...", "error": "..." }` với thông điệp tiếng Việt an toàn:

| HTTP | Code | Trường hợp |
|---|---|---|
| 400 | `invalid_request` | JSON hoặc `userId` không hợp lệ |
| 401 | `unauthenticated` | Không có session hợp lệ |
| 403 | `invalid_origin` | Origin/Host không hợp lệ |
| 403 | `forbidden` | Actor không phải Admin |
| 404 | `user_not_found` | Target không tồn tại |
| 409 | `user_inactive` | Target đã bị khóa |
| 422 | `email_missing` | Target chưa có email |
| 500 | `reset_prepare_failed` | Không thể invalidate token cũ, tạo record mới hoặc tạo audit pending |
| 500 | `audit_finalize_failed` | Không thể kết thúc audit sau khi gọi provider |
| 502 | `email_delivery_failed` | Provider không chấp nhận email |

Không trả raw database error hay provider response cho client.

### 5.3 Trình tự xử lý

Sau khi guard thành công:

1. Sinh raw token bằng CSPRNG trong bộ nhớ tiến trình và tính SHA-256 token hash.
2. Gọi bước chuẩn bị transaction trong database để khóa target, invalidate reset token cũ, insert token hash mới hết hạn sau 60 phút, và insert audit `pending`.
3. Nếu bước chuẩn bị hoặc audit insert thất bại, dừng; tuyệt đối không gọi email provider.
4. Gửi email chứa raw token qua helper hiện hữu. Raw token chỉ tồn tại trong bộ nhớ đủ để tạo link.
5. Nếu provider chấp nhận email, finalize audit thành `sent` và trả success.
6. Nếu provider thất bại, finalize audit thành `failed`, vô hiệu hóa token vừa tạo, rồi trả `email_delivery_failed`.
7. Nếu provider đã trả kết quả nhưng finalize audit lỗi, trả `audit_finalize_failed`; audit `pending` được giữ làm dấu hiệu cần đối soát. Không tự động gửi lại email vì có thể tạo email trùng.

## 6. Reset token và email

- Raw token có entropy tương đương 32 byte ngẫu nhiên và chỉ xuất hiện trong link email.
- Database chỉ lưu SHA-256 token hash; không lưu raw token.
- Link dùng base URL đã cấu hình của ứng dụng và route `/reset-password?token=...`.
- Token hết hạn sau đúng 60 phút, dùng một lần, và chỉ áp dụng cho user active.
- Mỗi yêu cầu Admin mới invalidate toàn bộ token chưa dùng trước đó của target, kể cả token được tạo từ luồng self-service. Vì vậy chỉ liên kết mới nhất còn hiệu lực.
- Nếu gửi email thất bại, token vừa chuẩn bị phải được đánh dấu đã vô hiệu hóa.
- Khi một token được consume thành công, mọi token còn lại của target cũng bị invalidate để không thể đổi mật khẩu lần hai bằng một link khác.
- Nội dung email không chứa mật khẩu tạm và hướng dẫn người nhận bỏ qua nếu họ không yêu cầu thao tác.

## 7. Thu hồi session bằng `session_version`

### 7.1 Thay đổi payload

Mở rộng payload đã ký thành:

```ts
type SessionPayload = {
  userId: string;
  expiresAt: number;
  sessionVersion?: number;
};
```

`createSessionToken()` nhận `sessionVersion` đọc từ `staff_users` lúc login và đưa version vào payload. `verifySessionToken()` tiếp tục kiểm tra chữ ký/expiry, đồng thời chỉ chấp nhận version là số nguyên không âm.

Không cần thêm `issuedAt`: session version tránh phụ thuộc độ lệch đồng hồ và cho phép thu hồi theo user với một phép so sánh chính xác.

### 7.2 Tương thích cookie cũ

- Migration thêm `staff_users.session_version` với default `0` cho toàn bộ row hiện hữu.
- Cookie cũ không có `sessionVersion` được chuẩn hóa thành `0`.
- Vì row hiện hữu cũng có version `0`, phát hành thay đổi không gây logout hàng loạt.
- Sau lần reset thành công đầu tiên của một target, database version tăng lên; mọi cookie cũ thiếu version hoặc mang version thấp hơn đều bị từ chối.

### 7.3 Điểm revoke

`consume_password_reset` thực hiện atomically:

1. Consume token hợp lệ và lấy `user_id`.
2. Cập nhật bcrypt password hash, xóa giá trị password legacy còn lại.
3. Tăng `session_version = session_version + 1`.
4. Invalidate mọi reset token còn lại của target.

`getSessionUser()` bổ sung `session_version` vào query và trả `null` khi token version không bằng database version. Cookie stale có thể còn được trình duyệt gửi tới hết TTL, nhưng không còn quyền truy cập. Client nhận 401 từ `/api/auth/session`, xóa user state và yêu cầu đăng nhập lại.

Chỉ tăng version khi mật khẩu mới đã được đặt thành công. Không revoke ngay lúc gửi email vì email có thể chưa tới, và mật khẩu cũ vẫn còn hiệu lực trong giai đoạn đó.

## 8. Audit bắt buộc và an toàn dữ liệu

### 8.1 Audit record

Trước khi gọi email provider, route phải insert một record:

- `actor_id`: Admin thực hiện thao tác.
- `module`: `admin`.
- `entity_type`: `staff_user`.
- `entity_id`: target user ID.
- `action`: `password_reset`.
- `old_data`: `null`.
- `new_data`: chỉ gồm `event`, `channel: "email"`, `status: "pending"`.

`audit_logs.action` là text nên không cần migration enum/check. Nếu dùng helper TypeScript chung thì bổ sung `password_reset` vào union; route server không được hạ xuống client anon chỉ để ghi audit.

### 8.2 Chuyển trạng thái

- Không gửi email nếu insert audit `pending` thất bại.
- Provider success: cập nhật đúng audit row thành `status: "sent"`.
- Provider failure: cập nhật thành `status: "failed"` với failure code tổng quát như `delivery_failed`.
- Không lưu raw provider response vì có thể chứa PII hoặc thông tin vận hành nhạy cảm.
- Trạng thái `pending` quá 5 phút được xem là warning cần đối soát; nó chỉ xuất hiện khi tiến trình dừng hoặc finalize audit thất bại.

Audit không được chứa địa chỉ email, raw token, token hash, password, password hash, session cookie, signing material, API credential hoặc nội dung bí mật khác. Log ứng dụng cũng tuân theo danh sách cấm này.

## 9. Thiết kế dữ liệu và migration

Tạo một migration additive, có thứ tự sau các migration ngày 2026-08-14 hiện hữu:

1. Thêm `staff_users.session_version bigint not null default 0` cùng check `session_version >= 0`.
2. Thay `consume_password_reset` bằng phiên bản giữ nguyên signature hiện tại nhưng tăng session version và invalidate token còn lại trong cùng transaction.
3. Thêm bước chuẩn bị reset dưới dạng server-only PostgreSQL function/RPC để khóa target row, invalidate token cũ, insert token mới và audit pending atomically; trả về token record ID và audit ID, không trả token hash hay email.
4. Thêm bước finalize để chuyển audit sang `sent`/`failed`; nhánh failed đồng thời invalidate token mới.
5. Revoke execute khỏi `public`, `anon` và `authenticated` đối với các function quản trị; chỉ grant cho `service_role`. API route server là caller duy nhất.
6. Giữ nguyên bảng `password_reset_tokens`, `password_reset_attempts` và `audit_logs`; không drop hay rewrite dữ liệu hiện hữu.

Function chuẩn bị phải khóa row `staff_users` target để hai yêu cầu đồng thời được tuần tự hóa. Request commit sau cùng là request duy nhất có token còn hiệu lực.

Migration phải idempotent ở mức an toàn triển khai, chạy được trên bản sao phục hồi trước production, và có ghi chú rollback. Vì cột mới là additive và code cũ bỏ qua nó, rollback ứng dụng không cần drop cột.

## 10. File map dự kiến khi triển khai

- `src/app/users/page.tsx`: nút, confirm dialog, state loading/success/error và mapping API error.
- `src/app/api/auth/admin-reset/route.ts`: guard, lỗi cụ thể, prepare/send/finalize flow.
- `src/app/api/auth/login/route.ts`: đọc `session_version` và tạo token có version.
- `src/app/api/auth/reset-password/route.ts`: tiếp tục gọi RPC consume đã harden.
- `src/lib/serverSession.ts`: payload/version validation và database comparison.
- `src/lib/passwordReset.ts`: helper token/email không rò rỉ dữ liệu và return result rõ ràng.
- `src/lib/services/audit.ts` hoặc server audit helper: type action nếu helper được dùng.
- `supabase/migrations/20260814160000_employee_password_reset_admin.sql`: thay đổi dữ liệu/RPC/grant.
- Test TypeScript/Node và SQL smoke tương ứng.

Danh sách này không cho phép sửa refactor ngoài phạm vi hoặc thay đổi routing/provider.

## 11. Error handling và các tình huống biên

- Target bị inactive hoặc bị xóa giữa lúc mở modal và lúc submit: server trả lỗi cụ thể; không tạo token/audit pending.
- Email bị xóa giữa lúc tải UI và submit: server trả `email_missing`.
- Hai Admin reset cùng target: database row lock tuần tự hóa; chỉ token từ request commit sau cùng hợp lệ.
- Admin đóng modal khi request đang chạy: UI không tạo request thứ hai; kết quả vẫn được xử lý khi promise hoàn tất.
- Provider timeout: coi là `failed`, finalize audit an toàn và invalidate token. Không tự động retry vì không biết provider đã nhận email hay chưa.
- Token expired/used/đã bị thay thế: reset endpoint trả thông điệp chung rằng link không hợp lệ hoặc hết hạn.
- Session version mismatch: coi session không hợp lệ, không tiết lộ lý do chi tiết cho client.
- Audit finalize lỗi sau provider call: trả lỗi vận hành, giữ audit `pending`, không tự gửi lại.

## 12. Chiến lược kiểm thử

### 12.1 Unit và component

- Nút chỉ render cho role `admin`.
- Nút disable đúng khi target thiếu email, inactive hoặc đang submitting.
- Confirm không gửi request trước khi xác nhận.
- Double-click/submitting không tạo request trùng.
- Mapping đầy đủ success/error code và reset state khi đổi/đóng modal.
- Session payload mới ký/xác minh đúng; payload hết hạn, malformed, version âm/lẻ hoặc signature sai bị từ chối.
- Cookie legacy thiếu version được chấp nhận khi database version bằng `0` và bị từ chối sau khi version tăng.

### 12.2 API integration

- Reject invalid origin, unauthenticated và non-admin.
- Trả đúng lỗi cho invalid UUID, target không tồn tại, inactive và thiếu email.
- Audit pending phải tồn tại trước khi mock email sender được gọi.
- Audit prepare failure chứng minh sender không được gọi.
- Provider success chuyển audit sang `sent`; provider failure chuyển sang `failed` và invalidate token mới.
- Response/log không chứa email, token, hash hoặc password.

### 12.3 Database smoke

- Migration thêm version default `0` mà không thay đổi dữ liệu nhân sự khác.
- Yêu cầu mới invalidate mọi token cũ và để đúng một token mới hợp lệ.
- Consume token chỉ thành công một lần, cập nhật password hash, tăng version đúng một đơn vị và invalidate token còn lại.
- Consume token invalid/expired/inactive không đổi password hoặc session version.
- Hai prepare request đồng thời được tuần tự hóa và request sau cùng thắng.
- Grant chỉ cho phép caller server cần thiết thực thi function quản trị.

### 12.4 Verification ứng dụng

Chạy tối thiểu:

- Focused Node tests mới và test hiện hữu liên quan.
- SQL smoke trên database disposable/restore, không chạy mutation test trực tiếp trên dữ liệu production.
- `npm run lint`.
- `npx tsc --noEmit`.
- `npm run build`.
- Kiểm thử thủ công bằng tài khoản test kiểm soát: Admin success, thiếu email, inactive, link one-use, expiry, và session cũ bị 401 sau consume.

## 13. Backup, rollout, health check và rollback

### 13.1 Bảo toàn dirty worktree

Trước khi triển khai:

- Ghi lại `git status --short`, branch, HEAD và diff của đúng các file liên quan.
- Không chạy `git reset`, `git clean`, `git stash`, checkout ghi đè hoặc commit gộp thay đổi hiện hữu.
- Backup timestamped từng file quan trọng sẽ sửa vào một thư mục con mới dưới `/opt/thoidai-backups/employee-password-reset/`, giữ nguyên permission và kiểm tra checksum.
- Stage/commit bằng path cụ thể; xác nhận commit chỉ chứa file thuộc tính năng đã được duyệt.
- Nếu cần worktree cô lập, tạo từ commit hiện tại rồi overlay có kiểm soát đúng các file auth chưa commit; không di chuyển hay xóa source authoritative tại `/opt/thoidai-work`.

### 13.2 Backup database

- Tạo logical backup có thể phục hồi trước migration, bao gồm schema và các bảng `staff_users`, `password_reset_tokens`, `password_reset_attempts`, `audit_logs`, cùng metadata migration.
- Kiểm tra backup tồn tại, có kích thước hợp lý và có thể restore trên database disposable.
- Không xóa backup sau rollout.

### 13.3 Rollout

1. Xác minh backup source/database và test migration trên bản restore.
2. Áp dụng migration additive; xác minh column, function, constraint và grant.
3. Build/deploy ứng dụng vào inactive blue/green slot.
4. Chạy health check trên inactive slot và kiểm thử reset bằng tài khoản test.
5. Chỉ switch Nginx khi toàn bộ check đạt yêu cầu.
6. Sau switch, kiểm tra public health, auth/session, Docker, Nginx và database; không thay đổi provider/model hay CLIProxyAPI/9router.

### 13.4 Health check bắt buộc

Báo cáo theo chuẩn vận hành VPS: `VPS`, `STATUS`, `CPU`, `RAM`, `DISK`, `LOAD`, `SERVICES`, `DOCKER`, `NGINX`, `DATABASE`, `WARNINGS`, `ERRORS`, `RECOMMENDED ACTION`.

Các check tính năng gồm:

- App trả response bình thường và `/api/auth/session` giữ session hợp lệ không bị reset.
- Non-admin không gọi được Admin reset API.
- Target thiếu email/inactive nhận lỗi đúng mà không tạo token/audit gửi mail.
- Email test thành công tạo audit `sent`; link chỉ dùng một lần và hết hạn đúng thiết kế.
- Sau consume, cookie cũ của target bị từ chối trong khi user khác không bị ảnh hưởng.
- Không có audit `pending` quá 5 phút; không có dữ liệu nhạy cảm trong response/log/audit.

### 13.5 Rollback

- Nếu candidate lỗi trước switch: không switch slot; giữ production hiện tại.
- Nếu lỗi sau switch: chuyển Nginx về slot trước và xác minh health.
- Có thể restore định nghĩa function từ backup/migration rollback; giữ cột additive `session_version` để tránh thao tác drop nguy hiểm và vì app cũ bỏ qua cột này.
- Nếu dữ liệu reset/audit bị ảnh hưởng, dừng phát hành, dùng backup verified để lập kế hoạch phục hồi riêng; không tự ý xóa token, audit, volume hay database.

## 14. Tiêu chí nghiệm thu

1. Chỉ Admin thấy và gọi được nút reset.
2. Target thiếu email hoặc inactive không thể submit và nhận thông điệp rõ ràng.
3. Confirm/loading/success/error ngăn request lặp và phản hồi đúng trạng thái.
4. Mỗi email chứa link một lần, hiệu lực 60 phút; chỉ link mới nhất hợp lệ.
5. API kiểm tra same-origin, session, role và target mới nhất; lỗi cụ thể nhưng không rò rỉ dữ liệu nhạy cảm.
6. Audit pending tồn tại trước email call và kết thúc `sent`/`failed`; exception để lại `pending` có cảnh báo đối soát.
7. Audit/log/response không chứa email, token, hash, password, session cookie hoặc credential.
8. Consume thành công tăng `session_version`; toàn bộ session trước đó của target bị vô hiệu, user khác không bị ảnh hưởng.
9. Cookie legacy version `0` tiếp tục hoạt động cho tới khi chính user đó reset, nên rollout không logout hàng loạt.
10. Migration additive, grant tối thiểu, test/backup/rollout/rollback được kiểm chứng.
11. Dirty worktree và mọi thay đổi có trước được giữ nguyên; commit tính năng dùng path cụ thể.
