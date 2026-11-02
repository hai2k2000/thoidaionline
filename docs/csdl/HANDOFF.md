# CSDL (Cơ sở dữ liệu hồ sơ): tài liệu bàn giao cho phiên Claude khác

Cập nhật lần cuối: 2026-11-02. Người viết: phiên Claude ở máy cơ quan. Người duyệt: owner (hai2k2000).

## 1. Đọc trước
- **Ngôn ngữ:** owner trao đổi bằng tiếng Việt, ưa câu ngắn.
- **Phân công:** Claude lập đặc tả và review; Codex viết code (`codex exec`). Owner không tự chạy lệnh nào. Claude chạy mọi thứ, kể cả Playwright; khi cần đăng nhập thì mở trình duyệt có giao diện để owner tự đăng nhập.
- **Production:** mọi thao tác trên production (migration, deploy, Nginx) đều cần owner duyệt riêng cho từng việc. Duyệt PR không có nghĩa là duyệt deploy.
- **Secret:** không đọc, không in. Không chạy `docker top` hay `docker inspect` lên container DB.
- **Chỉ một máy deploy production tại một thời điểm.** Trước khi activate: `readlink -f /opt/releases/thoidai-work/current`, rồi so release đang chạy với commit sắp deploy để biết những PR nào sẽ lên cùng.
- **Merge:** chỉ merge khi `gh pr checks <n>` xanh. Chạy `next build` ở máy trước khi mở PR.

## 2. Trạng thái hiện tại (2026-11-02)
- Repo `hai2k2000/thoidaionline`, nhánh `integration/production`. Production đang chạy `artifact-41a9bcd` (PR #106).
- Các migration CSDL đã áp, mới nhất ở cuối:
  - `20261028090000_doan_the_types`: tạo nhóm "Các tổ chức đoàn thể" với 16 loại; chỉ Admin xem được.
  - `20261028120000_record_type_sort_order`
  - `20261029120000_department_visibility`: thêm cột `visibility` (department/public), bảng `db_department_view_grants`; trưởng phòng (`departments.manager_id`) duyệt hồ sơ.
  - `20261030100000_record_approve_department_scope`: định nghĩa lại `api_transition_database_record`.
  - `20261031100000_p2_search_hardening`: định nghĩa lại `api_search_database_records`.
  - `20261102100000_noidung_forms`: thêm `db_form_fields.hidden`, `validation.help`, form riêng cho 11 loại `ngoai_ngu`, Tổ Tiếng Nga (`ru`).
- **Bản gốc khi viết lại RPC:** luôn lấy định nghĩa mới nhất, cụ thể là search trong `20261031100000` và transition trong `20261030100000`. Hàm `rbac_v2_scope_supported` lấy từ migration mới nhất có ghi đè hàm này. Không dùng bản cũ hơn.
- **Hồ sơ trên production:** gần như chưa có (1–2 hồ sơ thật). Có thể cấu trúc lại nhóm và loại mà không phải chuyển dữ liệu lớn, nhưng migration vẫn phải cập nhật `db_records.category_id` khi chuyển loại sang nhóm khác.

## 3. Mô hình dữ liệu (tóm tắt)
- `db_categories` (code, name, parent_id, department_id, sort_order, active): nhóm hồ sơ.
  - Phòng Nội dung là nhóm cha, các tổ ngôn ngữ là nhóm con.
  - Loại hồ sơ của tổ ngoại ngữ nằm trong nhóm `ngoai_ngu`, nhóm này bị ẩn khỏi ô chọn (xem `languageGroup.mjs`).
- `db_record_types` (category_id, code, name, sort_order, active): loại hồ sơ.
- `db_form_definitions` (record_type_id, version, status) và `db_form_fields` (field_key, label, data_type, required, hidden, options, validation{help, …}, sort_order): form của từng loại. **Không tách bảng theo loại.** Mọi trường riêng nằm trong `db_records.metadata` (jsonb).
- `db_records`: owner_id, department_id, visibility, status (draft/pending_review/approved/archived/deleted), metadata.
- **Ai xem được hồ sơ:**
  - Admin (`record.discover` scope `all`) xem tất cả.
  - Người cùng phòng xem mọi trạng thái.
  - Người ngoài phòng chỉ xem hồ sơ approved/archived, khi hồ sơ là `public` hoặc người đó có grant xem phòng.
  - ACL từng hồ sơ: allow cho xem, deny chặn.
  - Hồ sơ **nhạy cảm** (category `doan_the_quan_ly` hoặc 4 code cũ) chỉ người có `record.sensitive.access` xem được; hiện chỉ role admin có quyền này.
  - Logic này nằm ở RPC search/transition và ở `src/lib/databaseManagement/{policy.ts,repository.ts}`.
- **Code chính:**
  - `src/lib/databaseManagement/*`
  - `src/app/database/records/**`
  - `src/app/api/database/**`
  - `src/components/DatabaseRecordForm.tsx`
  - `src/components/permissions/*` (trang phân quyền)

## 4. Quy trình
**Giao Codex**
- Tạo worktree mới: `git worktree add <dir> -b <branch> origin/integration/production`.
- Ghi đặc tả và prompt ra file, rồi chạy: `codex exec -s workspace-write -C <dir> --skip-git-repo-check "$(cat prompt.md)" </dev/null`.
- Prompt phải có:
  - "DESIGN PRE-APPROVED; do not stop for approval";
  - đường dẫn RuleCodex (AGENTS.md yêu cầu);
  - "No network: không next build, không npm install".
- Codex thường không commit được vì bị chặn `index.lock`. Claude tự commit, `npm ci`, chạy `npx tsc --noEmit`, `node --test`, rồi `next build` với các biến môi trường placeholder sau:

  ```
  NEXT_PUBLIC_SUPABASE_URL=https://ci.invalid/supabase NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-anon-key-placeholder SUPABASE_SERVICE_ROLE_KEY=ci-service-role-key-placeholder-01234567890123456789 SESSION_SECRET=ci-session-secret-placeholder-01234567890123456789 THOIDAI_BUILD_CONFIG=ci-placeholder THOIDAI_RELEASE_BRANCH=integration/production THOIDAI_INTEGRATION_BRANCH=origin/integration/production npx next build
  ```

- **Review kỹ những lỗi Codex từng mắc:**
  - Chép lại khối seed của migration cũ vào migration mới.
  - Dùng `pg_get_functiondef` kết hợp regexp để viết lại RPC. Không được làm vậy: phải viết lại tường minh và kết thúc bằng khối DO assertion.
  - Bỏ qua validation ở trường ẩn.
  - **Mã hóa UTF-8 hai lần** làm chữ tiếng Việt thành "Ã¡…". Trước khi mở PR luôn chạy `grep -lE "Ã|á»|Æ°"` trên các file đã sửa.
- **Migration mới:**
  - Đặt version theo timestamp, sau khi kiểm tra `gh pr list` xem có PR nào đang mở dùng trùng version không.
  - Thêm migration vào danh sách MIGRATION_REFERENCE ở 3 file: `scripts/package-standalone.mjs`, `scripts/verify-standalone-artifact.mjs`, `scripts/standalone-packaging.test.mjs`.

**Deploy (chỉ khi owner duyệt)**
1. Backup: `ssh vps-aylaspa 'sudo -n /usr/local/sbin/thoidai-backup run --kind predeploy --label <x>'`. Bản backup nằm ở `/opt/ops/thoidai-work/backups/managed/predeploy/`.
2. Áp migration, trước khi deploy code: `git show <sha>:<file> | ssh vps-aylaspa 'docker exec -i supabase_db_thoidai-work psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q'`.
3. Ghi ledger: `insert into supabase_migrations.schema_migrations(version,name) values (...)`.
4. Lấy artifact CI:
   - Tìm run: `gh run list --workflow production-artifact.yml --commit <fullsha>`. Nếu có PR khác merge ngay sau, run sẽ bị hủy; khi đó dùng commit mới nhất.
   - Tải về: `gh run download <run> -D artifacts/ci-<sha7>`.
   - Kiểm tra: `node scripts/{verify-artifact-manifest,scan-artifact-secrets,verify-standalone-artifact}.mjs <dir>`.
5. Chuyển lên VPS:
   - Artifact: `tar` qua ssh vào `/opt/build/thoidai-work/artifact-<sha7>`.
   - Công cụ deploy: `git -c core.autocrlf=false archive <sha> scripts deploy` vào `/opt/build/thoidai-work/deploy-tools-<sha7>`.
6. Trong thư mục deploy-tools, chạy `bash scripts/production/deploy-external-artifact.sh <artifact-dir> <fullsha> --verify-only`, sau đó chạy lại với `THOIDAI_EXTERNAL_DEPLOY_APPROVED=1` và `--activate`. **Không** tự tạo marker `*.codex-staging-owner`.
7. Kiểm tra:
   - `curl http://127.0.0.1:3001/login` và `/database/records` (app chạy ở cổng 3001).
   - `journalctl -u thoidai-work.service -p err --since '-3 min'`.
   - Kiểm tra trên DB bằng cách gọi RPC với vai từng user.
8. Rollback: release trước đó là `/opt/releases/thoidai-work/previous`.

## 5. Việc tiếp theo
- **Giai đoạn 2:** xem `PHASE2_SPEC.md`. Tách nhóm đoàn thể, thêm Công đoàn, Liên hiệp, Pháp lý; phân quyền truy cập theo nhóm hồ sơ.
- **Giai đoạn 3:** xem `PHASE3_SPEC.md`. Nhóm con của Phòng Tổng hợp.
- **Nguồn:** góp ý của các phòng sau buổi demo (6 file docx của owner). Phần đã thống nhất được tóm tắt trong hai đặc tả trên.
- **Cách làm:** gửi owner bản đặc tả rút gọn, hỏi các điểm còn mở được đánh dấu **[HỎI OWNER]**, rồi mới giao Codex.
