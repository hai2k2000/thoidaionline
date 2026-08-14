# THỜI ĐẠI WORK — Đặc tả thiết kế tái cấu trúc giao diện và luồng quản lý công việc

- **Trạng thái:** Đã được duyệt để chuyển sang bước lập kế hoạch triển khai
- **Ngày:** 2026-08-14
- **Phạm vi:** `thoidai.online`, mã nguồn `/opt/thoidai-work`, production Supabase `thoidai-work`
- **Kiến trúc được chọn:** Façade tăng dần trên schema hiện có, dữ liệu task chỉ đi qua server
- **Ngôn ngữ và múi giờ hiển thị:** Tiếng Việt, `Asia/Ho_Chi_Minh`
- **Lưu trữ thời gian:** UTC trong cơ sở dữ liệu

## 1. Mục đích của tài liệu

Tài liệu này khóa thiết kế sản phẩm, kiến trúc, mô hình dữ liệu, phân quyền, quy trình đánh giá và chiến lược triển khai cho việc đưa **Quản lý công việc** thành trung tâm của THỜI ĐẠI WORK.

Tài liệu là đầu vào duy nhất cho bước lập kế hoạch triển khai. Mỗi phase phải có thể build, kiểm thử, deploy và rollback độc lập. Việc triển khai không được suy diễn thêm yêu cầu sản phẩm ngoài các quyết định đã ghi ở đây.

## 2. Mục tiêu

1. Mọi tài khoản hợp lệ sau đăng nhập đi tới `/tasks`.
2. Gộp công việc được giao và nhiệm vụ cá nhân vào một Task Center.
3. Chỉ người có quyền giao việc mới thấy và sử dụng `/tasks/assign`.
4. Permission được kiểm tra ở giao diện, Next.js server API và RPC/database; không tin role hoặc actor do client gửi.
5. Giữ dữ liệu task, kế hoạch, đánh giá và lịch sử hiện có; migration chỉ theo hướng cộng thêm và tương thích ngược.
6. Bỏ phần trăm tiến độ khỏi trải nghiệm mới; thay bằng báo cáo có ngày, trạng thái, tiến triển và vướng mắc.
7. Tách rõ hoàn thành, trả lại và hủy.
8. Tự động thêm Trưởng phòng chính của người thực hiện làm watcher, không tạo trùng.
9. Hỗ trợ công việc lặp hàng tuần và hàng tháng với cơ chế chống tạo trùng.
10. Đưa Đánh giá nhân viên vào Task Center và áp dụng quy trình tự đánh giá → Trưởng phòng bước 1 → TBT bước 2/phát hành.
11. Dùng một bộ tiêu chí 5 yếu tố, tổng 100 điểm, có phiên bản và dùng chung cho mọi phòng.
12. Giữ nguyên password reset, session epoch và đường rollback an toàn đã deploy.

## 3. Ngoài phạm vi

1. Không chuyển toàn bộ ứng dụng sang Supabase Auth/JWT trong dự án này.
2. Không rewrite các module nhân sự, tài sản, tài liệu hoặc chấm công không liên quan.
3. Không xóa cột, bảng, task, kế hoạch hoặc đánh giá cũ trong tám phase.
4. Không hard-delete task; hủy là một trạng thái có audit.
5. Không chuyển đổi điểm đánh giá cũ 1–10 sang thang 100 bằng công thức suy đoán.
6. Không có AI tạo barem, AI hỗ trợ đánh giá, nút AI, provider AI hoặc lời gọi mô hình trong phạm vi này.
7. Không thay đổi Codex provider/model, cấu hình CLIProxyAPI hay switch `9router`.
8. Không thay đổi mô hình password reset, signed session cookie, `session_version` hoặc session epoch.
9. Không tạo rubric riêng theo phòng, ban hoặc bộ phận.
10. Không sửa migration history trong cùng commit hoặc cùng deployment với tính năng UI/task.

## 4. Hiện trạng và bằng chứng kiến trúc

### 4.1. Stack và deployment

- Next.js 16.1.6 App Router, React 19.2.3, TypeScript 5, Tailwind CSS 4.
- Browser hiện dùng Supabase anon client; server API dùng service-role client.
- Xác thực dùng signed HttpOnly cookie, `session_version` và server-side session lookup.
- Service production chạy `npm start` tại `/opt/thoidai-work`, port 3001, sau nginx.
- Active HEAD tại thời điểm duyệt thiết kế: `0752f61f0ea914555767595c4afe3901cb12efe4`.
- Active tree: `88f6b9560fd1c25d662567d86ed96785e8dc845b`.
- Active BUILD_ID SHA-256: `a698692aa376a148e8826759e33dac9637fb65915d7e845575959ab7586f9e0b`.

### 4.2. Route và menu đang chạy

- Login hiện điều hướng về `/`.
- `/` là trang Giao việc.
- Nhân viên bị client redirect từ `/` sang `/tasks/active`.
- `/tasks/active`, `/tasks/pending-review`, `/tasks/done`, `/tasks/[id]` tồn tại.
- `/tasks` chưa tồn tại và trả 404.
- `/planning` và `/planning/reports` chưa nằm trong active build và trả 404.
- `/performance` là menu cấp 1 riêng.
- `AppNav` vẫn chứa link tới các route task/status và planning cũ.
- Các route API task server-side trong dirty worktree chưa nằm trong active build.

### 4.3. Data flow và security hiện tại

Luồng cũ:

~~~text
Browser
  → Supabase anon client
  → đọc/ghi trực tiếp tasks, assignees, comments, progress logs
  → lọc quyền ở React client
~~~

Production RLS hiện có permissive anon policies cho nhiều bảng quan trọng, gồm `staff_users`, `roles`, `role_permissions`, `departments`, `tasks`, `task_assignees`, `task_comments`, `task_progress_logs` và các bảng performance. Đây là lý do thiết kế mới bắt buộc chuyển task data qua server trước khi siết RLS.

Các RPC `claim_task_plan`, `create_bulk_task_plan`, `report_task_progress`, `review_task_completion` và `save_task_evaluation_checkpoint` đã chỉ cho `service_role` execute. Active build vẫn có đường gọi evaluation RPC từ browser, trong khi các wrapper API server-side mới chỉ tồn tại dạng untracked. Thiết kế phải đóng khoảng cách này trước khi thêm hành vi mới.

### 4.4. Dữ liệu production dạng tổng hợp

Tại thời điểm audit:

- 6 task: 3 `new`, 2 `in_progress`, 1 `rejected`.
- 4 daily plan dạng self-claimable, thuộc 2 batch; 1 task chưa được claim.
- Không có weekly hoặc monthly plan trong production hiện tại.
- 0 watcher, 0 attachment object, 2 comment, 1 progress log, 1 final task-evaluation checkpoint.
- 0 performance cycle và 0 performance review.
- 5 phòng active; 2 phòng chưa có manager candidate, 3 phòng có đúng một manager candidate.
- `departments` chưa có `manager_id`.
- Task chưa có `task_type`, `start_date`, `completed_at`, cancellation fields hoặc deadline history.

### 4.5. Dirty worktree và migration history

Trước tài liệu này, worktree có 358 status records, SHA-256 `20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a`, gồm 20 modified, 1 deleted và 337 untracked. Active build khớp committed tree, không khớp toàn bộ source dirty đang nằm cạnh nó.

Trong 20 migration liên quan đã audit, 11 version chưa có history row dù nhiều database object tương ứng đang tồn tại. Không được dùng automated migration runner cho feature này trước khi hoàn tất prerequisite reconciliation ở mục 22.

## 5. Phương án kiến trúc

### 5.1. Phương án được chọn: incremental server façade

Giữ bảng `tasks` và các quan hệ hiện có, bổ sung schema theo hướng additive, đặt Next.js server API làm biên tin cậy và chuyển từng luồng khỏi browser anon client.

~~~text
Browser UI
  → Next.js route handler
  → same-origin check đối với mutation
  → signed-session lookup
  → canonical authorization
  → service-role RPC/query
  → production database
  → DTO tối thiểu trả về UI
~~~

Lợi ích:

- Không làm mất dữ liệu cũ.
- Mỗi phase có thể deploy độc lập.
- Có thể rollback ứng dụng mà không drop schema.
- Tái sử dụng task, assignee, watcher enum, comment, audit và RPC.
- Không đụng auth/password-reset vừa được harden.

Chi phí chấp nhận được:

- Có thời gian dual-read/dual-write.
- Schema cũ như `progress_percent`, `plan_period` và `self_claimable` phải được giữ trong giai đoạn tương thích.
- Việc siết RLS phải là phase cuối sau khi mọi client task đã chuyển sang server.

### 5.2. Phương án không chọn: chuyển ngay sang Supabase Auth/JWT

Phương án này cho phép native per-user RLS nhưng buộc rewrite custom login, session cookie, password migration, password reset và session epoch. Rủi ro vượt phạm vi và làm suy yếu rollback hiện có, nên không dùng trong dự án này.

### 5.3. Phương án không chọn: chỉ đổi UI, giữ anon data flow

Phương án này nhanh hơn ở bề mặt nhưng không đáp ứng backend authorization, watcher scope, evaluation scope hoặc security acceptance. Không được dùng cho production.

## 6. Canonical server-only task data flow

### 6.1. Nguyên tắc

1. UI không import Supabase client cho dữ liệu task sau cutover.
2. Actor ID chỉ lấy từ signed session; API bỏ qua actor/role do request body gửi lên.
3. Mọi mutation có same-origin check, validation, permission check và audit.
4. RPC `security definer` chỉ cho `service_role`; `public`, `anon` và `authenticated` không execute.
5. List/detail API chỉ trả field cần render; không trả email, password, token hoặc profile không liên quan.
6. Pagination, filter và search chạy server-side.
7. Một transition task phải được thực hiện trong một transaction.
8. Error response không lộ SQL, service-role payload hoặc dữ liệu người khác.

### 6.2. API boundary dự kiến

- `GET /api/tasks`: list, filter, pagination và scope.
- `POST /api/tasks/personal`: tạo nhiệm vụ cá nhân.
- `POST /api/tasks/assign`: giao việc.
- `GET /api/tasks/:id`: detail đã scope.
- `POST /api/tasks/:id/progress-reports`: báo cáo tiến độ.
- `POST /api/tasks/:id/complete`: gửi hoàn thành hoặc hoàn thành personal task.
- `POST /api/tasks/:id/review`: approve/return assigned task.
- `POST /api/tasks/:id/cancel`: hủy với lý do.
- `POST /api/tasks/:id/deadline`: đổi deadline với lý do.
- `POST /api/tasks/:id/comments`: comment.
- `POST/DELETE /api/tasks/:id/watchers`: thêm/bớt watcher theo quyền.
- `POST /api/tasks/:id/attachments`: upload private attachment.
- `GET /api/tasks/:id/attachments/:attachmentId`: cấp signed download sau `canViewTask`.
- `POST /api/task-recurrence/run`: không public; chỉ recurrence runner nội bộ gọi bằng local service credential.

Route implementation có thể tách file khác nhau, nhưng contract, authorization và transaction boundary ở trên là bắt buộc.

## 7. Canonical permission model

### 7.1. Permission keys

Các permission mới là stable fields, không dựa vào tên hiển thị:

- `can_assign_task`
- `can_manage_department_tasks`
- `can_view_all_tasks`
- `can_evaluate_step1`
- `can_evaluate_step2`
- `can_publish_evaluation`
- `can_manage_shared_rubric`

Các quyền phổ quát nhưng vẫn được kiểm tra bằng relationship:

- Tạo nhiệm vụ cá nhân.
- Xem task liên quan.
- Báo cáo/hoàn thành task được giao theo transition hợp lệ.
- Comment task liên quan.
- Xem đánh giá đã publish của bản thân.

`roles.level` hỗ trợ biểu diễn cấp bậc; quyết định cuối cùng dùng explicit permission và scope, không dùng `level` đơn lẻ.

### 7.2. Ma trận vai trò

#### Nhân viên

- Xem task được giao, task cá nhân, task mình tạo hoặc task mình là watcher.
- Tạo/sửa/hủy nhiệm vụ cá nhân của mình.
- Báo cáo tiến độ và gửi hoàn thành task được giao.
- Comment task liên quan.
- Tự đánh giá và xem evaluation đã publish của mình.
- Không giao việc, không xem bảng đánh giá người khác, không đánh giá bước 1 hoặc bước 2.

#### Trưởng phòng chính

- Có toàn bộ quyền nhân viên.
- Giao việc trong phạm vi phòng được phép.
- Xem và quản lý task của nhân viên trực thuộc.
- Được thêm làm watcher tự động.
- Đánh giá bước 1 cho nhân viên trực thuộc.
- Không tự đánh giá bước 1 cho chính mình.

#### Phó TBT hoặc role quản lý rộng hơn được cấp quyền

- Có quyền giao việc và xem task theo scope cấu hình.
- Có thể đánh giá bước 1 khi là manager/reviewer hợp lệ.
- Không thay TBT publish bước 2 trong quy trình chuẩn.

#### TBT (`tong_bien_tap`)

- Xem task/evaluation toàn cơ quan.
- Chỉ có mutation nghiệp vụ `can_evaluate_step2` và `can_publish_evaluation`.
- Không giao việc, không sửa task, không approve completion, không comment hoặc đánh giá bước 1.
- Đây là ngoại lệ có chủ đích đối với chính sách read-only hiện tại: read-only cho vận hành task, có quyền riêng cho evaluation bước 2/phát hành.

#### Compatibility role `tbt_read_only`

- Tiếp tục chỉ đọc.
- Không được tự động nhận quyền bước 2.
- Việc hợp nhất hoặc loại bỏ role này nằm ngoài phạm vi.

#### Admin

- Quản lý user, permission, phòng, manager chính và rubric dùng chung.
- Có quyền cứu hộ dữ liệu khi được phép, nhưng mọi override nghiệp vụ phải ghi audit với lý do.
- Quy trình chuẩn vẫn dùng TBT cho bước 2/phát hành; Admin không âm thầm thay actor nghiệp vụ.

### 7.3. Canonical authorization helpers

Server phải có các quyết định dùng chung:

- `canViewTask`
- `canCreatePersonalTask`
- `canAssignTask`
- `canUpdateTask`
- `canSubmitProgress`
- `canCompleteTask`
- `canReviewCompletion`
- `canCancelTask`
- `canChangeDeadline`
- `canCommentTask`
- `canManageWatchers`
- `canViewEmployeeEvaluation`
- `canEvaluateStep1`
- `canEvaluateStep2`
- `canPublishEvaluation`
- `canManageSharedRubric`

UI chỉ dùng cùng permission DTO để ẩn/hiện. Backend luôn tính lại từ session và database relationships.

## 8. Navigation, route mới và redirect

### 8.1. Menu

Nhân viên:

~~~text
THỜI ĐẠI WORK
▣ Quản lý công việc
────────────────
👤 Tài khoản
↪ Đăng xuất
~~~

Trưởng phòng/Phó TBT/Admin có `can_assign_task`:

~~~text
THỜI ĐẠI WORK
＋ Giao việc
▣ Quản lý công việc
────────────────
👤 Tài khoản
↪ Đăng xuất
~~~

TBT:

~~~text
THỜI ĐẠI WORK
▣ Quản lý công việc
  └─ tab Đánh giá nhân viên
────────────────
👤 Tài khoản
↪ Đăng xuất
~~~

Admin có thêm nhóm **Cấu hình** riêng, gồm user/permission/phòng ban/Trưởng phòng chính và **Bộ tiêu chí đánh giá chung**. Nhóm này không hiển thị cho role khác.

### 8.2. Route canonical

- `/tasks`: Task Center, mặc định sau login.
- `/tasks?view=work`: tab Công việc.
- `/tasks?view=evaluations`: tab Đánh giá nhân viên, chỉ role có quyền.
- `/tasks/assign`: Giao việc.
- `/tasks/[id]`: Chi tiết task.
- `/configuration/evaluation-rubrics`: Quản lý rubric dùng chung, Admin-only.

Filter lưu trên URL:

- `type=all|assigned|personal`
- `scope=all|mine|assigned_to_me|watching|managed`
- `status=...`
- `deadline=all|on_time|due_soon|overdue|none`
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `q=...`
- `page=...`

### 8.3. Redirect tương thích

- `/` → `/tasks`
- `/tasks/active` → `/tasks?status=active`
- `/tasks/pending-review` → `/tasks?status=pending_review`
- `/tasks/done` → `/tasks?status=done`
- `/my-tasks` → `/tasks?type=personal`
- `/planning` → `/tasks?type=personal`
- `/planning/reports` → `/tasks?type=personal&scope=managed`
- `/performance` → `/tasks?view=evaluations`

Redirect là temporary trong ít nhất một release để giữ back/forward và bookmark. Cleanup không xóa redirect.

## 9. Additive task schema

### 9.1. `tasks`

Cột mới:

- `task_type text null` trong giai đoạn migration, check `assigned|personal`.
- `start_date date null`.
- `completion_submitted_at timestamptz null`.
- `completed_at timestamptz null`.
- `cancelled_at timestamptz null`.
- `cancelled_by uuid null`.
- `cancel_reason text null`.
- `evaluation_criteria text null`.
- `recurrence_rule_id uuid null`.

Cột được giữ:

- `due_date` tiếp tục là deadline/end date.
- `status` được mở rộng nhưng không đổi tên.
- `progress_percent` giữ cho dữ liệu cũ, UI mới không đọc/ghi.
- `plan_period`, `self_claimable`, `plan_batch_id` giữ để truy vết legacy.
- `attachment_url` giữ read-only cho legacy; attachment mới dùng bảng riêng.

### 9.2. Thời gian

- `date` dùng cho ngày nghiệp vụ như `start_date`, `due_date`, `reported_on`, `scheduled_for`.
- `timestamptz` lưu UTC cho event time.
- UI và server format theo `Asia/Ho_Chi_Minh`.
- Scheduler tính occurrence theo `Asia/Ho_Chi_Minh`, sau đó lưu timestamp UTC.
- So sánh đúng hạn của assigned task dùng `completion_submitted_at`; thời gian phê duyệt của manager không làm nhân viên bị tính trễ.
- `completed_at` ghi khi task chuyển thành `done`.

### 9.3. Deadline history

Bảng `task_deadline_history`:

- `id`
- `task_id`
- `old_due_date`
- `new_due_date`
- `reason`
- `changed_by`
- `changed_at`

`reason` bắt buộc. Update task và insert history nằm trong cùng transaction. Không update hoặc delete history row.

### 9.4. Progress reports

Bảng `task_progress_reports`:

- `id`
- `task_id`
- `reported_by`
- `reported_on`
- `report_status`: `in_progress|blocked|waiting|nearly_done`
- `progress_text`
- `blockers`
- `created_at`

Không có phần trăm. `progress_text` bắt buộc; `blockers` bắt buộc khi status là `blocked`.

Task status được đồng bộ trong transaction:

- `blocked` report → task `blocked`.
- `waiting` report → task `waiting`.
- `in_progress` hoặc `nearly_done` → task `in_progress`, trừ task terminal hoặc đang chờ duyệt.
- Report không tự hoàn thành task.

`task_progress_logs` cũ giữ read-only và hiển thị trong mục lịch sử cũ. Dữ liệu cũ không được chuyển đổi thành structured status bằng suy đoán.

### 9.5. Status và transition

Canonical status:

- `new`: Chưa thực hiện
- `in_progress`: Đang thực hiện
- `blocked`: Có vướng mắc
- `waiting`: Chờ phối hợp
- `pending_review`: Chờ duyệt hoàn thành
- `done`: Hoàn thành
- `rejected`: Trả lại
- `cancelled`: Hủy

Transition hợp lệ:

~~~text
new → in_progress | blocked | waiting | cancelled
in_progress → blocked | waiting | pending_review | done(personal) | cancelled
blocked → in_progress | waiting | pending_review | done(personal) | cancelled
waiting → in_progress | blocked | pending_review | done(personal) | cancelled
pending_review → done | rejected | cancelled
rejected → in_progress | blocked | waiting | pending_review | cancelled
done → terminal
cancelled → terminal
~~~

Admin correction không update âm thầm. Correction tạo một audited status event có lý do.

Bảng `task_status_events` lưu mọi transition:

- `task_id`
- `from_status`
- `to_status`
- `reason`
- `actor_id`
- `created_at`

Return và cancel bắt buộc lý do. Không dùng return thay cancel.

### 9.6. Private attachments

Bảng `task_attachments`:

- `id`
- `task_id`
- `storage_path`
- `file_name`
- `mime_type`
- `size_bytes`
- `uploaded_by`
- `created_at`

Bucket task mới là private. Upload chỉ qua server-authorized route hoặc signed upload được cấp sau authorization. Download dùng signed URL ngắn hạn sau `canViewTask`.

Không ghi public URL mới. Nếu migration phát hiện legacy `attachment_url`, hệ thống giữ read-only link cho tới khi file được sao chép an toàn; không xóa link cũ trong tám phase. Production hiện không có task attachment object nên cutover không cần xóa dữ liệu.

### 9.7. Một Trưởng phòng chính và watcher

Thêm nullable `departments.manager_id` trước, FK tới active `staff_users`. Validation bắt buộc manager thuộc cùng department.

Sau khi hai phòng còn thiếu manager được gán, mọi active department phải có đúng một manager chính. Đây là nguồn dữ liệu duy nhất cho auto-watcher.

Khi chọn assignee:

1. Lấy `staff_users.department_id`.
2. Lấy `departments.manager_id`.
3. Upsert manager vào `task_assignees` với `assignment_role='watcher'`.
4. Upsert watcher bổ sung do người giao chọn.
5. Nếu manager là creator, assignee hoặc watcher đã có thì không tạo duplicate.
6. Watcher được xem và comment task, không được báo cáo, hoàn thành hoặc được chấm như assignee.

PK hiện có `(task_id,user_id)` là invariant chống duplicate. Thêm index theo `user_id,assignment_role,task_id` cho query scope.

### 9.8. Recurrence và idempotency

Bảng `task_recurrence_rules`:

- `id`
- template fields cho task
- `frequency`: `weekly|monthly`
- local scheduling fields
- `timezone`: cố định `Asia/Ho_Chi_Minh`
- `starts_on`
- `ends_on`
- `next_scheduled_for`
- `active`
- `created_by`
- timestamps

Bảng `task_recurrence_occurrences`:

- `rule_id`
- `scheduled_for`
- `task_id`
- `created_at`
- unique `(rule_id,scheduled_for)`

Runner:

- Chạy bằng systemd timer trên VPS, gọi application-level server runner nội bộ.
- Có thể retry; database advisory lock và unique occurrence key bảo đảm một kỳ chỉ tạo một task.
- Tạo task, assignee, manager watcher, extra watchers và occurrence row trong một transaction.
- Monthly occurrence giữ ngày trong tháng; nếu tháng ngắn hơn thì dùng ngày cuối tháng.
- Disable rule không xóa task đã sinh.

### 9.9. Index

Index được thêm theo query contract:

- `tasks(task_type,status,due_date,created_at desc)`
- `tasks(assignee_id,status,due_date)`
- `tasks(department_id,status,due_date)`
- `tasks(created_by,created_at desc)`
- `task_assignees(user_id,assignment_role,task_id)`
- `task_comments(task_id,created_at desc)`
- `task_progress_reports(task_id,reported_on desc,created_at desc)`
- `task_deadline_history(task_id,changed_at desc)`
- `task_status_events(task_id,created_at desc)`
- `task_attachments(task_id,created_at desc)`
- `performance_reviews(employee_id,cycle_id,status)`
- `performance_review_scores(review_id,stage,factor_code)`

Title search dùng server-side normalized `ILIKE` ban đầu. Chỉ bật `pg_trgm`/GIN sau khi query telemetry chứng minh cần thiết.

## 10. Mapping kế hoạch cũ

### 10.1. Quy tắc

Migration thêm `task_type` nullable với check `assigned|personal`.

- `plan_period='ad_hoc'` và không self-claimable → `assigned`.
- Daily/weekly/monthly plan đã có owner/assignee → `personal`.
- Daily/weekly/monthly plan chưa claim giữ `task_type=null`, hiển thị read-only qua compatibility adapter và legacy redirect.
- Không tạo loại sản phẩm thứ ba trong UI.
- `start_date` của row cũ dùng ngày `created_at` hiển thị theo `Asia/Ho_Chi_Minh`.
- `due_date` giữ nguyên.
- `plan_period`, `self_claimable`, `plan_batch_id` giữ nguyên để audit.
- Monthly được hỗ trợ trong mapper dù production hiện không có row loại này.

### 10.2. Row legacy chưa claim

Production hiện có một daily plan chưa claim. Row này không bị xóa hoặc tự gán. Sau khi owner nghiệp vụ quyết định assignee hoặc hủy, migration kế tiếp mới gán `task_type` và chuyển `task_type` sang NOT NULL cho toàn bộ active task.

Đây là thao tác vận hành có kiểm soát, không phải lựa chọn sản phẩm còn mở.

### 10.3. Invariant migration

Trước và sau backfill phải đối soát:

- Tổng số task không đổi.
- Tổng theo `plan_period`, `self_claimable`, `plan_batch_id` không đổi.
- Không mất assignee, owner, reviewer, comment, progress log hoặc evaluation.
- Mọi row được map có `start_date` và `due_date`.
- Mọi row chưa map được liệt kê bằng count, không in title hoặc identity.
- Migration idempotent và chạy trong single transaction.

## 11. Workflow hoàn thành, trả lại và hủy

### 11.1. Assigned task

1. Assignee/owner bấm **Hoàn thành** ở góc phải header.
2. Server xác nhận quyền, task không terminal và không có transition xung đột.
3. Ghi `completion_submitted_at=now()`.
4. Chuyển `pending_review`.
5. Ghi status event và notification/audit.
6. Reviewer hợp lệ:
   - Approve → `done`, ghi `completed_at=now()`.
   - Return → `rejected`, bắt buộc lý do, giữ submission/history cũ.
7. Deadline classification của assignee dùng `completion_submitted_at <= due_date` end-of-day `Asia/Ho_Chi_Minh`.

### 11.2. Personal task

1. Owner bấm **Hoàn thành**.
2. Task chuyển trực tiếp `done`.
3. `completion_submitted_at` và `completed_at` cùng timestamp.
4. Deadline classification dùng timestamp đó.
5. Không có review step.

### 11.3. Return

- Chỉ dùng khi yêu cầu làm lại/bổ sung.
- Lý do bắt buộc.
- Có thể thực hiện nhiều lần; mọi lần nằm trong status events.
- Không xóa progress report/comment/attachment.

### 11.4. Cancel

- Dùng khi task không còn cần thực hiện.
- Lý do, actor và timestamp bắt buộc.
- Trạng thái `cancelled`; không hard delete.
- Assigned task do người có quyền quản lý scope hoặc Admin hủy.
- Personal task do owner hoặc Admin hủy.
- Task done/cancelled không bị sửa bằng workflow thông thường.

## 12. Task Center UX

### 12.1. Header và tabs

~~~text
QUẢN LÝ CÔNG VIỆC
Theo dõi công việc được giao và nhiệm vụ cá nhân
~~~

- Tab nhanh: **Tất cả**, **Được giao cho tôi**, **Nhiệm vụ cá nhân**.
- **Tôi theo dõi** hiện khi watcher scope có dữ liệu/quyền.
- Role có evaluation permission thấy tabs **Công việc** và **Đánh giá nhân viên**.
- Nút **+ Nhiệm vụ cá nhân** cho mọi nhân viên.
- Nút **+ Giao việc** chỉ cho `can_assign_task`.

### 12.2. Filter và URL state

Filter bắt buộc:

- Search theo tên.
- Từ ngày/đến ngày.
- Tính chất assigned/personal.
- Trạng thái.
- Thời hạn: đúng hạn, sắp đến hạn, quá hạn, không deadline.
- Department khi actor có scope.
- Reset filter.

Server áp dụng filter và pagination. UI debounce search. Refresh, copy URL và back/forward giữ nguyên trạng thái.

### 12.3. Desktop list

Cột:

- Công việc
- Tính chất
- Người phụ trách
- Phòng
- Bắt đầu
- Deadline
- Trạng thái
- Thời hạn

Cả row click tới `/tasks/[id]`. Action có menu riêng phải stop propagation. Badge phải có text, không chỉ màu.

### 12.4. Mobile list

- Dưới 768px dùng task cards, không ép bảng rộng.
- Card hiển thị title, type, assignee, deadline, status, deadline state.
- Filter mở dưới dạng sheet; số filter active hiển thị trên trigger.
- Primary action sticky nhưng không che nội dung.
- Pagination/load-more có trạng thái loading/error rõ ràng.

## 13. Task Detail UX

Thứ tự:

1. Header: title, badges, **Hoàn thành** bên phải.
2. Thông tin chung.
3. Nội dung công việc.
4. Tiêu chí đánh giá dạng text.
5. Báo cáo tiến độ.
6. Trao đổi/comment.
7. Đánh giá công việc.
8. Attachment.
9. Lịch sử deadline/status/legacy progress.

Header hiển thị:

- Người giao.
- Người thực hiện.
- Watchers.
- Ngày bắt đầu.
- Deadline.
- Trạng thái.
- Đúng hạn/sắp hạn/quá hạn.
- Completion submitted/completed time khi có.

Progress form:

- Ngày báo cáo.
- Trạng thái.
- Tiến triển.
- Vướng mắc.
- Không có input hoặc display phần trăm.

Comment composer hiển thị cho creator, assignee, watcher và actor quản lý scope. Server kiểm tra lại relationship.

Evaluation cũ 1–10 hiển thị trong panel **Đánh giá cũ**, tách khỏi evaluation 100 điểm mới.

## 14. Assign Task UX

Route `/tasks/assign`, chỉ render khi `can_assign_task`.

Fields:

- Tên công việc.
- Nội dung.
- Người thực hiện.
- Ngày bắt đầu.
- Deadline.
- Watcher tự động: Trưởng phòng chính của assignee.
- Watcher bổ sung.
- Tiêu chí đánh giá dạng text.
- Recurrence: không lặp, hàng tuần, hàng tháng.
- Private attachment.
- Hủy/Giao việc.

Validation:

- Title, content, assignee và deadline bắt buộc.
- `start_date <= due_date`.
- Assignee nằm trong scope actor.
- Department có manager chính trước khi giao.
- Watcher không duplicate.
- Recurrence fields hợp lệ.
- File đạt allowlist MIME/size.
- Server transaction tạo task, assignments, watchers, attachment metadata, recurrence rule và audit.

### 14.1. Tiêu chí đánh giá task: text-only

Field là một textarea để người giao gõ hoặc dán barem/tiêu chí. Nội dung được lưu nguyên văn sau trim, giới hạn độ dài và hiển thị ở detail.

Không có:

- Nút AI.
- AI suggestion.
- Lời gọi provider/model.
- Structured rubric bắt buộc cho từng task.
- Tự động ghi/chỉnh sửa tiêu chí.

Bộ tiêu chí 5 yếu tố dùng cho đánh giá nhân viên là module khác, không tự động chèn vào textarea task.

## 15. Bộ tiêu chí đánh giá chung có phiên bản

### 15.1. Một rubric cho toàn bộ cơ quan

Chỉ có **một bộ tiêu chí dùng chung cho tất cả phòng, ban và bộ phận** tại mỗi thời điểm hiệu lực. Không có department override, department template hoặc weight riêng theo phòng.

Admin quản lý tại `/configuration/evaluation-rubrics`.

### 15.2. Versioning và immutability

Bảng `evaluation_rubric_versions`:

- `id`
- `version_no`
- `status`: `draft|published|retired`
- `effective_from`
- `created_by`
- `published_by`
- `published_at`
- timestamps

Bảng `evaluation_rubric_factors`:

- `rubric_version_id`
- `position`
- `factor_code`
- `label`
- `description`
- `max_score`
- `band_definitions`
- unique `(rubric_version_id,factor_code)`

Quy tắc:

1. Đúng 5 factor.
2. Tổng `max_score` đúng 100.
3. Chỉ draft được sửa.
4. Publish khóa version.
5. Sửa rubric nghĩa là clone active version thành draft mới.
6. Retire chỉ ảnh hưởng cycle tương lai.
7. Evaluation lưu `rubric_version_id` và JSON snapshot của label, description, max score, bands.
8. Snapshot và published evaluation không update tại chỗ.
9. Correction tạo revision mới có liên kết supersede và audit, giữ bản cũ.

### 15.3. Neutral common seed

Seed đầu tiên được tổng hợp trung tính từ tài liệu Phòng Nội dung và Phòng Tổng hợp, loại bỏ chỉ số đặc thù phòng nhưng giữ phần giao nhau.

| Mã | Yếu tố dùng chung | Điểm tối đa |
|---|---|---:|
| `work_effectiveness` | Hiệu quả công việc, chất lượng đầu ra và phối hợp | 40 |
| `responsibility` | Trách nhiệm, chủ động tiếp nhận và xử lý công việc | 25 |
| `compliance` | Chấp hành nội quy, kỷ luật và quy trình | 15 |
| `learning_challenge` | Học tập và sẵn sàng nhận nhiệm vụ khó, phức tạp | 10 |
| `innovation_technology` | Sáng kiến, cải tiến và ứng dụng công nghệ hiệu quả | 10 |
|  | **Tổng** | **100** |

Yếu tố 5 có thể ghi nhận việc ứng dụng AI/công nghệ của nhân viên như một bằng chứng công việc. Điều này không tạo AI integration trong ứng dụng.

### 15.4. Score bands theo factor

#### Hiệu quả/chất lượng/phối hợp — 40

- 35–40: chất lượng cao, đúng hạn, phối hợp hiệu quả, bằng chứng đầy đủ.
- 30–34: đạt tốt, có sai sót nhỏ không ảnh hưởng kết quả chung.
- 20–29: cần cải thiện về tiến độ, chất lượng hoặc tính chủ động phối hợp.
- 0–19: không đạt, bị trả lại nghiêm trọng, thiếu bằng chứng hoặc không hoàn thành.

#### Trách nhiệm/chủ động — 25

- 20–25: chủ động, theo việc đến cùng, phản hồi và báo cáo kịp thời.
- 15–19: hoàn thành trách nhiệm, cần nhắc nhẹ và khắc phục tốt.
- 10–14: còn thụ động hoặc cần đôn đốc lặp lại.
- 0–9: né tránh, chậm phản hồi nghiêm trọng hoặc không thực hiện trách nhiệm.

#### Kỷ luật/quy trình — 15

- 15: chấp hành đầy đủ, không có vi phạm.
- 10–14: có nhắc nhở nhẹ, không ảnh hưởng kết quả chung.
- 5–9: vi phạm quy trình, hồ sơ hoặc chế độ báo cáo.
- 0–4: vi phạm nghiêm trọng, ảnh hưởng cơ quan hoặc kết quả công việc.

#### Học tập/nhận việc khó — 10

- 8–10: chủ động học tập và xung phong nhận nhiệm vụ khó.
- 6–7: có học tập/nhận việc khó, mức chủ động chưa ổn định.
- 4–5: tham gia khi được yêu cầu nhưng chưa thể hiện cải thiện rõ.
- 0–3: không chủ động học tập hoặc né tránh nhiệm vụ khó.

#### Sáng kiến/cải tiến/công nghệ — 10

- 8–10: có sáng kiến hoặc ứng dụng công nghệ hiệu quả, có bằng chứng.
- 6–7: có cải tiến hữu ích nhưng phạm vi hoặc hiệu quả chưa ổn định.
- 4–5: có thử nghiệm/áp dụng ở mức cơ bản.
- 0–3: không có cải tiến có thể chứng minh hoặc ứng dụng hình thức.

### 15.5. Xếp loại 100 điểm

- 90–100: Hoàn thành xuất sắc nhiệm vụ.
- 80–89: Hoàn thành tốt nhiệm vụ.
- 65–79: Hoàn thành nhiệm vụ.
- 50–64: Hoàn thành một phần nhiệm vụ.
- Dưới 50: Không hoàn thành nhiệm vụ.

Điểm từng factor phải nằm trong band/range hợp lệ và không vượt max. Tổng được tính server-side, không nhận total từ client.

## 16. Quy trình đánh giá nhân viên

### 16.1. Schema

Tái sử dụng additive `performance_cycles` và `performance_reviews`; không dùng lại semantics điểm 1–10.

Bổ sung:

- `performance_reviews.rubric_version_id`
- `performance_reviews.rubric_snapshot`
- `performance_reviews.workflow_type`: `employee|manager`
- `performance_reviews.status`: `self_draft|awaiting_manager|awaiting_tbt|published`
- `performance_reviews.published_at`
- `performance_reviews.published_by`
- revision/supersede reference

Bảng `performance_review_scores`:

- `review_id`
- `stage`: `self|manager|tbt`
- `factor_code`
- `score`
- `comment`
- `actor_id`
- `created_at`
- unique `(review_id,stage,factor_code)`

### 16.2. Nhân viên thường

~~~text
Self assessment
  → submit
  → awaiting_manager
  → Trưởng phòng bước 1
  → awaiting_tbt
  → TBT bước 2
  → publish
~~~

- Self, manager và TBT đều dùng cùng rubric snapshot.
- Manager chỉ đánh giá nhân viên trực thuộc.
- TBT xem bằng chứng task, self score và manager score; có thể điều chỉnh điểm kèm nhận xét.
- Employee chỉ thấy kết quả sau publish.

### 16.3. Trưởng phòng chính

~~~text
Manager self assessment
  → submit
  → awaiting_tbt
  → TBT đánh giá trực tiếp
  → publish
~~~

Manager không tự thực hiện bước 1 cho chính mình. Không có manager trung gian.

### 16.4. Scope và evidence

Evaluation tab filter theo:

- Từ ngày/đến ngày.
- Department.
- Search nhân viên.
- Evaluation status.

Danh sách hiển thị:

- Nhân viên.
- Phòng.
- Tổng task.
- Hoàn thành/chưa hoàn thành.
- Đúng hạn/quá hạn.
- Evaluation status.

Employee detail hiển thị task trong kỳ và link `/tasks/[id]`. Evidence chỉ gồm task actor có quyền xem; không nhân bản task detail.

### 16.5. Legacy 1–10

`task_evaluation_checkpoints` và `total_score=rating*effort_weight` giữ nguyên, không update/delete và không được cộng vào tổng 100 điểm mới.

UI:

- Gắn nhãn **Đánh giá cũ — thang 1–10**.
- Không cho tạo checkpoint 1–10 mới sau cutover.
- Không quy đổi tự động.
- Có thể xem khi actor có quyền với task/evaluation đó.

## 17. Responsive và accessibility

Breakpoints bắt buộc kiểm thử: 375, 768, 1024, 1440, 1920px.

- Desktop sidebar 232px.
- Header cao 60px.
- Content padding 24px desktop, 16px tablet, 12px mobile.
- Không đặt max-width làm table/list bị hẹp trên 1440/1920.
- Dưới 1024px sidebar thành off-canvas drawer có overlay.
- Drawer hỗ trợ focus trap, Escape, restore focus.
- Filter mobile là sheet/collapsible panel.
- Table chuyển card dưới 768px; horizontal scroll chỉ là fallback.
- Primary action dễ tiếp cận và không che nội dung.
- Modal/drawer có `role`, accessible name, focus management.
- Badge/status không phụ thuộc màu.
- Row clickable có keyboard activation.
- Loading, empty, error và permission-denied states có text rõ ràng.

## 18. Authorization và RLS cutover

### 18.1. Chuyển đổi hai bước

Bước A — compatibility:

1. Deploy server API/RPC và canonical permission.
2. Chuyển Task Center, detail, assign, comment, attachment, evaluation sang server-only.
3. Giữ anon policies tạm thời để active/rollback build cũ không hỏng.
4. Quan sát logs và xác nhận không còn task request trực tiếp từ browser Supabase.

Bước B — enforcement:

1. Backup database và ACL/policy inventory.
2. Revoke anon INSERT/UPDATE/DELETE trên task, assignee, comment, progress, performance, role/department tables.
3. Revoke anon SELECT dữ liệu task/staff không cần public.
4. Giữ RPC execute chỉ `service_role`.
5. Thêm restrictive policies/privilege tests.
6. Deploy cleanup build không còn anon task client.
7. Kiểm tra 401/403/200 matrix và journal.

Không được đảo thứ tự hai bước.

### 18.2. Audit

Audit bắt buộc cho:

- Tạo task.
- Đổi deadline.
- Đổi assignee.
- Thêm/bớt watcher.
- Progress report.
- Submit/approve/return/cancel/complete.
- Tạo/publish/retire rubric version.
- Self submit, manager step 1, TBT step 2/publish.
- Admin override/correction.

Audit payload không chứa password, reset token, session cookie, attachment binary hoặc provider secret.

## 19. Tám phase deploy, dependency và acceptance gate

### Phase 1 — Baseline, canonical permission và server façade

**Phụ thuộc:** Không.

**Phạm vi:**

- Tạo clean implementation worktree từ HEAD đã chứa employee password reset.
- Chụp dirty fingerprint, active build, DB schema/ACL/history inventory.
- Thêm shared permission contract và role level vào server session DTO.
- Thêm task server APIs/RPC compatibility nhưng chưa đổi UI và chưa revoke anon.
- Sửa contract evaluation hiện tại để browser không gọi service-only RPC.

**Gate:**

- Session/password-reset regression pass.
- API trả 401 khi chưa login, 403 sai scope, success đúng scope.
- TBT chỉ có evaluation step 2/publish mutation.
- Active UI cũ vẫn hoạt động.
- Không thay provider/model/9router.

### Phase 2 — Navigation và route shell

**Phụ thuộc:** Phase 1.

**Phạm vi:**

- Thêm `/tasks`.
- Login và `/` redirect tới `/tasks`.
- Sidebar mới theo permission.
- Thêm `/tasks/assign` shell.
- Thêm redirects route cũ.
- Evaluation là tab trong Task Center.

**Gate:**

- Employee không thấy Giao việc/Evaluation.
- Manager thấy Giao việc và Evaluation step 1.
- TBT thấy Evaluation, không thấy Giao việc.
- Route cũ redirect đúng search params.
- Không có link tới 404.

### Phase 3 — Additive schema và compatibility adapter

**Phụ thuộc:** Phase 1; prerequisite migration-history đã được xử lý theo mục 22.

**Phạm vi:**

- Add task type/date/completion/cancel/history/progress/attachment/manager/recurrence/rubric/evaluation schema.
- Add indexes.
- Backfill safe rows.
- Giữ legacy fields và adapter.
- Seed shared rubric version 1.

**Gate:**

- Migration chạy hai lần an toàn trên disposable DB.
- Count/invariant trước và sau khớp.
- Rubric có đúng 5 factor, tổng 100.
- Không có row dữ liệu bị xóa.
- Production apply dùng single transaction.

### Phase 4 — Task Center và nhiệm vụ cá nhân

**Phụ thuộc:** Phase 2 và 3.

**Phạm vi:**

- Unified server-filtered list.
- URL filters/search/pagination.
- Desktop table/mobile cards.
- Personal task create/edit/deadline/cancel/complete.
- Legacy plan compatibility display.

**Gate:**

- Filter URL round-trip.
- Scope không lộ task người khác.
- Personal task không cần assignment permission.
- Deadline history được ghi transactionally.
- Viewport 375/768/1024/1440/1920 pass.

### Phase 5 — Task Detail workflow

**Phụ thuộc:** Phase 3 và 4.

**Phạm vi:**

- Detail sections mới.
- Structured progress report.
- Assigned/personal completion flows.
- Return/cancel.
- Comment watcher.
- Private attachment.
- Status/deadline history.
- Legacy progress/evaluation read-only panels.

**Gate:**

- Transition matrix SQL/API tests pass.
- Watcher comment được nhưng không report/complete.
- Return/cancel bắt buộc lý do.
- Deadline classification dùng đúng timestamp/timezone.
- Attachment không public.

### Phase 6 — Assign task, watcher và recurrence

**Phụ thuộc:** Phase 3 và Phase 5; mọi active department đã có manager chính.

**Phạm vi:**

- Full assign form.
- Text-only evaluation criteria.
- Auto/extra watchers.
- Weekly/monthly recurrence.
- Idempotent systemd runner.
- Private attachments.

**Gate:**

- Unauthorized assign bị 403 server-side.
- Assignee scope đúng.
- Manager watcher auto và không duplicate.
- Retry recurrence không tạo task thứ hai.
- Monthly end-of-month behavior pass.
- Không có AI button/provider call.

### Phase 7 — Shared rubric và employee evaluation

**Phụ thuộc:** Phase 3, Task Center Phase 4 và Task Detail evidence Phase 5.

**Phạm vi:**

- Admin rubric manager.
- Version/publish/retire/snapshot.
- Seed 40/25/15/10/10.
- Evaluation tab, filters, employee detail.
- Self → manager → TBT → publish.
- Manager → TBT direct.
- Legacy 1–10 read-only.

**Gate:**

- Không có rubric theo department.
- Published rubric/snapshot immutable.
- Employee chỉ thấy published result của mình.
- Manager chỉ step 1 cho subordinate, không tự chấm.
- TBT chỉ step 2/publish.
- Score factor bounds, sum và classification đúng.

### Phase 8 — RLS enforcement, cleanup và hardening

**Phụ thuộc:** Phase 1–7 đã chuyển hoàn toàn sang server APIs.

**Phạm vi:**

- Revoke anon task/staff/performance CRUD.
- Restrictive policy/privilege hardening.
- Remove old menu/pages/components sau khi giữ redirects.
- Stop new writes vào percent/1–10 paths.
- Full docs/runbook/rollback refresh.

**Gate:**

- Browser network không gọi Supabase task tables trực tiếp.
- RLS/privilege SQL tests pass.
- Full Node/TypeScript/lint/build/browser suite pass.
- Public/local health pass.
- Rollback build tương thích schema additive và session epoch.
- Journals không có error/fatal.

## 20. Test strategy

### 20.1. Unit/contract

- Canonical role/permission matrix.
- Status transitions.
- Deadline classification/timezone.
- Score bands/classification.
- Rubric version immutability.
- Recurrence occurrence key.
- URL filter parsing/serialization.
- Legacy mapping.

### 20.2. API authorization

Mỗi mutation kiểm tra:

- Unauthenticated.
- Employee related/unrelated.
- Manager same/other department.
- TBT task mutation bị chặn.
- TBT evaluation step 2/publish được phép.
- Admin audited override.
- Same-origin failure.
- Invalid state/duplicate request.

### 20.3. SQL

- Additive migration idempotency.
- Backfill invariants.
- Function execute grants.
- Anon privilege denial sau cutover.
- Watcher uniqueness.
- Recurrence concurrency/retry.
- Published rubric/evaluation immutability.
- Task/evaluation scope.

### 20.4. Component/browser

- Menu visibility theo role.
- Task Center filters/table/cards.
- Keyboard row navigation.
- Mobile drawer/filter sheet.
- Task complete/return/cancel dialogs.
- Assignment manager watcher preview.
- Rubric Admin draft/publish.
- Evaluation step flows.
- Focus trap/Escape/restore focus.
- Viewports 375/768/1024/1440/1920.

### 20.5. Full gates

- Existing Node tests, đặc biệt password-reset/session.
- TypeScript `--noEmit`.
- ESLint không có error mới.
- Production build.
- Secret/log marker scan.
- Local/public `/login`, `/tasks`, protected APIs.
- nginx config, service, DB readiness, journal error counts.

## 21. Backup và rollback

Trước mỗi MODIFY/deploy phase:

1. Chụp exact HEAD/tree/status fingerprint.
2. Backup đúng source targets.
3. Custom-format production DB dump, mode root-only.
4. `pg_restore --list` verify.
5. Source bundle của candidate/rollback.
6. Backup active `.next`.
7. Ghi BUILD_ID/head/tree/migration checksum.

Rollback:

- Mỗi phase có build rollback riêng, dựa trên epoch-aware HEAD đã chứa session-version enforcement và employee password reset.
- Không dùng pre-epoch build.
- Schema additive không rollback bằng drop; rollback app dùng compatibility adapter.
- RLS Phase 8 có policy/grant backup và script khôi phục ACL hẹp nếu build rollback cần, nhưng không mở rộng hơn pre-cutover state.
- Recurrence runner có thể disable mà không xóa occurrences/tasks.
- Rubric version có thể retire cho cycle tương lai; published snapshot không sửa/xóa.
- Không reset/stash/clean dirty production worktree.

## 22. Rủi ro và prerequisite vận hành

### 22.1. Hai phòng chưa có Trưởng phòng chính

Trước Phase 6, Admin phải gán `departments.manager_id` cho hai active department còn thiếu. Migration Phase 3 để nullable và báo count; Phase 6 từ chối giao task cho assignee thuộc phòng chưa có manager chính thay vì bỏ qua watcher.

Không in identity trong log/migration report.

### 22.2. Migration-history reconciliation

Trước Phase 3 production apply, đội vận hành phải đối chiếu checksum/object của 11 migration chưa có history row và hoàn tất reconciliation theo runbook riêng được phê duyệt. Feature migration không được tự sửa history.

Đây là prerequisite vận hành duy nhất còn lại ngoài việc gán hai manager.

### 22.3. Dirty worktree và build/source split

Implementation bắt buộc dùng isolated clean worktree. Không stage, commit, revert hoặc copy toàn bộ dirty root. Mỗi merge phải so sánh status count/fingerprint và path overlap. Active build phải được tạo từ committed tree, không từ source dirty.

### 22.4. Security cutover sequencing

Revoke anon trước khi UI/server cutover sẽ làm active/rollback build cũ hỏng. Giữ anon sau khi mọi luồng đã chuyển sẽ kéo dài exposure. Phase 8 chỉ chạy khi telemetry và browser test chứng minh không còn direct task table requests.

### 22.5. Preservation invariants

Mọi phase phải giữ:

- Employee password reset và audit hardening.
- Session epoch/session version.
- Canonical provider/model hiện tại.
- CLIProxyAPI/9router switch.
- Existing DB backups và epoch-aware rollback artifacts.
- Legacy plan, progress, 1–10 evaluation và audit rows.

## 23. Decision log

| ID | Quyết định đã duyệt |
|---|---|
| D01 | Chọn incremental façade trên schema hiện có; không rewrite toàn hệ thống. |
| D02 | Task data sau cutover chỉ đi qua Next.js server API/service-role RPC. |
| D03 | `/tasks` là homepage sau login cho mọi role. |
| D04 | Menu nhân viên chỉ có Quản lý công việc, Tài khoản, Đăng xuất. |
| D05 | Giao việc nằm ở `/tasks/assign` và chỉ hiển thị khi `can_assign_task`. |
| D06 | Evaluation nằm trong Task Center, không là menu cấp 1. |
| D07 | Permission dùng stable fields/role level và relationship; không dùng tên hiển thị. |
| D08 | TBT read-only đối với task operation, chỉ có evaluation bước 2 và publish. |
| D09 | `tbt_read_only` giữ compatibility read-only, không tự nhận quyền bước 2. |
| D10 | Admin quản lý rubric/permission/manager; override nghiệp vụ phải audit. |
| D11 | Mỗi active department có đúng một Trưởng phòng chính. |
| D12 | Hai manager còn thiếu là prerequisite vận hành trước Assign phase. |
| D13 | Trưởng phòng chính của assignee được auto-add làm watcher; watcher bổ sung được phép; không duplicate. |
| D14 | Product có hai task type: assigned và personal. |
| D15 | Legacy daily/weekly/monthly không bị xóa; mapped có kiểm soát, row chưa claim giữ read-only cho tới khi được xử lý. |
| D16 | `start_date` và `due_date` là ngày nghiệp vụ; event timestamps lưu UTC, hiển thị Asia/Ho_Chi_Minh. |
| D17 | Đổi deadline bắt buộc lý do và lưu immutable history. |
| D18 | Progress report mới không có phần trăm; gồm ngày, trạng thái, tiến triển và vướng mắc. |
| D19 | Status gồm new, in_progress, blocked, waiting, pending_review, done, rejected, cancelled. |
| D20 | Assigned completion qua pending review; personal completion đi thẳng done. |
| D21 | Assigned deadline timeliness dùng completion submission time, không dùng approval delay. |
| D22 | Return và cancel là hai transition khác nhau, đều có reason/audit; không hard-delete. |
| D23 | Attachment mới dùng private storage và signed download. |
| D24 | Recurrence chỉ hỗ trợ weekly/monthly, dùng unique occurrence key và advisory lock để idempotent. |
| D25 | Assign form có textarea để gõ/dán tiêu chí; không có AI integration, provider hoặc button. |
| D26 | Có một rubric 5 yếu tố dùng chung cho tất cả phòng; tuyệt đối không có rubric riêng theo phòng. |
| D27 | Rubric version 1 dùng trọng số 40/25/15/10/10 và tổng 100. |
| D28 | Seed rubric trung tính được rút từ tài liệu Phòng Nội dung và Phòng Tổng hợp. |
| D29 | Admin chỉnh rubric bằng cách tạo version mới; published version và historical snapshot immutable. |
| D30 | Xếp loại: 90–100 xuất sắc, 80–89 tốt, 65–79 hoàn thành, 50–64 hoàn thành một phần, dưới 50 không hoàn thành. |
| D31 | Nhân viên tự đánh giá → manager bước 1 → TBT bước 2/publish. |
| D32 | Trưởng phòng tự đánh giá → TBT đánh giá trực tiếp/publish; không tự làm bước 1. |
| D33 | Legacy task evaluation 1–10 giữ read-only và không quy đổi sang 100. |
| D34 | Redirect route cũ được giữ qua cleanup. |
| D35 | Responsive được kiểm thử tại 375/768/1024/1440/1920. |
| D36 | Authorization cutover hai bước: server façade trước, RLS revoke sau. |
| D37 | Triển khai chia đúng tám phase, mỗi phase có dependency, gate, backup và rollback. |
| D38 | Không sửa migration history trong feature; reconciliation là prerequisite riêng. |
| D39 | Không làm mất dirty worktree; implementation dùng clean isolated worktree. |
| D40 | Giữ password reset/session epoch và chỉ dùng epoch-aware rollback build. |
| D41 | Không thay Codex provider/model hoặc CLIProxyAPI/9router. |

## 24. Điều kiện chuyển sang implementation plan

Implementation plan chỉ được viết từ tài liệu này sau khi người duyệt xác nhận nội dung file đã phản ánh đúng thiết kế. Plan phải tách theo tám phase, dùng TDD, ghi exact files/tests/commands và không mở lại các quyết định đã khóa trong Decision log.
