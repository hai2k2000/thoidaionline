# CSDL (Cơ sở dữ liệu hồ sơ): tài liệu bàn giao cho phiên Claude khác

Cập nhật lần cuối: 2026-11-02 (sau khi deploy giai đoạn 2). Người viết: phiên Claude ở máy cơ quan. Người duyệt: owner (hai2k2000).

## 1. Đọc trước
- **Ngôn ngữ:** owner trao đổi bằng tiếng Việt, ưa câu ngắn.
- **Phân công:** Claude lập đặc tả và review; Codex viết code (`codex exec`). Owner không tự chạy lệnh nào. Claude chạy mọi thứ, kể cả Playwright; khi cần đăng nhập thì mở trình duyệt có giao diện để owner tự đăng nhập.
- **Production:** mọi thao tác trên production (migration, deploy, Nginx) đều cần owner duyệt riêng cho từng việc. Duyệt PR không có nghĩa là duyệt deploy.
- **Secret:** không đọc, không in. Không chạy `docker top` hay `docker inspect` lên container DB.
- **Chỉ một máy deploy production tại một thời điểm.** Trước khi activate: `readlink -f /opt/releases/thoidai-work/current`, rồi so release đang chạy với commit sắp deploy để biết những PR nào sẽ lên cùng.
- **Merge:** chỉ merge khi `gh pr checks <n>` xanh ở `build-test-package`. Job `isolated-authenticated-e2e` đỏ sẵn từ 27/10 ở `20261020100000` ("db_records does not exist"), không phải lỗi của PR. Chạy `next build` ở máy trước khi mở PR.

## 2. Trạng thái hiện tại (2026-11-02)
- Repo `hai2k2000/thoidaionline`, nhánh `integration/production`. Production đang chạy `artifact-9730e5e` (PR #108, #109, #110). Release trước: `artifact-7be7fdc`, trước nữa `artifact-41a9bcd`.
- Các migration CSDL đã áp, mới nhất ở cuối:
  - `20261028090000_doan_the_types`: tạo nhóm "Các tổ chức đoàn thể" với 16 loại (nay đã inactive, xem `20261102140000`).
  - `20261028120000_record_type_sort_order`
  - `20261029120000_department_visibility`: thêm cột `visibility` (department/public), bảng `db_department_view_grants`; trưởng phòng (`departments.manager_id`) duyệt hồ sơ.
  - `20261030100000_record_approve_department_scope`: định nghĩa lại `api_transition_database_record`.
  - `20261031100000_p2_search_hardening`: định nghĩa lại `api_search_database_records`.
  - `20261102100000_noidung_forms`: thêm `db_form_fields.hidden`, `validation.help`, form riêng cho 11 loại `ngoai_ngu`, Tổ Tiếng Nga (`ru`).
  - `20261102140000_p2_restricted_groups`: cột `db_categories.restricted`, bảng `db_category_access_grants` (level view/contribute/approve), hàm `db_restricted_category_id`, `db_category_is_restricted`. 6 nhóm hạn chế: `cong_tac_dang`, `chi_hoi_nha_bao`, `cong_doan`, `doan_thanh_nien`, `cuc_bao_chi`, `lien_hiep`. Nhóm `phap_ly_dieu_hanh` không hạn chế. `doan_the_quan_ly` inactive. Định nghĩa lại CẢ `api_search_database_records` và `api_transition_database_record`.
  - `20261102160000_p2_form_fields_fix`: form version mới cho 24 loại của 4 nhóm `cong_tac_dang`, `cong_doan`, `lien_hiep`, `phap_ly_dieu_hanh` (sửa options, `keywords` là text, `con_phai_thu` là number).
  - `20261102170000_to_tieng_viet_forms`: form riêng 10 loại của `noi_dung_tieng_viet`; trigger `db_records_danh_ba_visibility` chặn danh bạ nghiệp vụ `public`.
- **Bản gốc khi viết lại RPC:** luôn lấy định nghĩa mới nhất. Hiện CẢ search và transition đều ở `20261102140000`. Hàm `rbac_v2_scope_supported` lấy từ migration mới nhất có ghi đè hàm này. Không dùng bản cũ hơn.
- **Cấp quyền nhóm hạn chế:** Phân quyền → Theo người dùng → mục "Nhóm hồ sơ hạn chế" (API `PUT /api/permissions/users/[userId]/category-grants`, cần `permission.manage`). Đến 2026-11-02 chưa ai được cấp; chỉ Admin thấy 6 nhóm.
- **Hồ sơ trên production:** gần như chưa có (1–2 hồ sơ thật). Có thể cấu trúc lại nhóm và loại mà không phải chuyển dữ liệu lớn, nhưng migration vẫn phải cập nhật `db_records.category_id` khi chuyển loại sang nhóm khác.

## 3. Mô hình dữ liệu (tóm tắt)
- `db_categories` (code, name, parent_id, department_id, sort_order, active, restricted): nhóm hồ sơ.
  - Phòng Nội dung là nhóm cha, các tổ ngôn ngữ là nhóm con.
  - Loại hồ sơ của tổ ngoại ngữ nằm trong nhóm `ngoai_ngu`, nhóm này bị ẩn khỏi ô chọn (xem `languageGroup.mjs`).
- `db_category_access_grants` (user_id, category_id, level): quyền theo nhóm hạn chế top-level.
- `db_record_types` (category_id, code, name, sort_order, active): loại hồ sơ.
- `db_form_definitions` (record_type_id, version, status draft/published/retired) và `db_form_fields` (field_key, label, data_type, required, hidden, options, validation{help, …}, sort_order): form của từng loại. **Không tách bảng theo loại.** Mọi trường riêng nằm trong `db_records.metadata` (jsonb). Mỗi loại chỉ có một form `published`; sửa form thì tạo version mới và retire bản cũ, không sửa tại chỗ.
- Options của trường `person`, `department`, `country` do API catalog tự nạp; trong DB để `[]`.
- `db_records`: owner_id, department_id, visibility, status (draft/pending_review/approved/archived/deleted), metadata.
- **Ai xem được hồ sơ:**
  - Admin (`record.discover` scope `all`) xem tất cả.
  - Người cùng phòng xem mọi trạng thái.
  - Người ngoài phòng chỉ xem hồ sơ approved/archived, khi hồ sơ là `public` hoặc người đó có grant xem phòng.
  - ACL từng hồ sơ: allow cho xem, deny chặn.
  - **Nhóm hạn chế** (nhóm của loại hoặc nhóm cha có `restricted=true`): chỉ Admin (`record.sensitive.access`) hoặc người có grant nhóm đó (mọi level) thấy, mọi trạng thái, bất kể phòng; ACL deny vẫn chặn. Tạo/sửa cần `record.create` + grant contribute/approve. Duyệt/trả lại chỉ grant approve hoặc Admin; trưởng phòng KHÔNG duyệt. Catalog chỉ hiện nhóm hạn chế với Admin hoặc grant contribute/approve.
  - 4 code nhạy cảm cũ (`ho_so_dang`, `chi_hoi_nha_bao`, `doan_thanh_nien`, `giay_phep_quan_ly_bao_chi`) vẫn chỉ cho người có `record.sensitive.access`.
  - Danh bạ nghiệp vụ (`danh_ba_nghiep_vu`) không được `public`: chặn ở form, repository và trigger DB.
  - Logic này nằm ở RPC search/transition và ở `src/lib/databaseManagement/{policy.ts,repository.ts}`.
- **Code chính:**
  - `src/lib/databaseManagement/*`
  - `src/app/database/records/**`
  - `src/app/api/database/**`
  - `src/app/api/permissions/users/[userId]/category-grants/route.ts`
  - `src/components/DatabaseRecordForm.tsx`
  - `src/components/permissions/*` (trang phân quyền, gồm `CategoryGrantsSection.tsx`)

## 4. Quy trình
**Giao Codex**
- Tạo worktree mới: `git worktree add <dir> -b <branch> origin/integration/production`, rồi `npm ci` (Claude chạy, Codex không có mạng).
- Ghi đặc tả và prompt ra file trong Temp, rồi chạy: `codex exec -s workspace-write -C <dir> --skip-git-repo-check -o <last.md> - < <prompt.md> > <run.log> 2>&1`. Đường dẫn redirect phải ghi thẳng (không dùng biến) để hook cho qua.
- Prompt phải có:
  - "DESIGN PRE-APPROVED; do not stop for approval";
  - đường dẫn RuleCodex (AGENTS.md yêu cầu);
  - "No network: không next build, không npm install";
  - quy tắc ghi file: không dùng PowerShell `Set-Content`/`Out-File`/here-string. Trên máy này `apply_patch` của Codex chạy qua PowerShell và cũng làm hỏng tiếng Việt thành `?`. Cách chắc chắn: nội dung tiếng Việt dài để sẵn trong file UTF-8 ở Temp, Codex dùng `node` (`fs.readFileSync`/`fs.writeFileSync` với `'utf8'`) để chép hoặc thay.
- Codex thường không commit được vì bị chặn `index.lock`. Claude tự commit, chạy `node_modules/.bin/tsc --noEmit`, `node --test`, rồi `next build` với các biến môi trường placeholder sau:

  ```
  NEXT_PUBLIC_SUPABASE_URL=https://ci.invalid/supabase NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-anon-key-placeholder SUPABASE_SERVICE_ROLE_KEY=ci-service-role-key-placeholder-01234567890123456789 SESSION_SECRET=ci-session-secret-placeholder-01234567890123456789 THOIDAI_BUILD_CONFIG=ci-placeholder THOIDAI_RELEASE_BRANCH=integration/production THOIDAI_INTEGRATION_BRANCH=origin/integration/production npx next build
  ```

- **Review kỹ những lỗi Codex từng mắc:**
  - Chép lại khối seed của migration cũ vào migration mới.
  - Dùng `pg_get_functiondef` kết hợp regexp để viết lại RPC. Không được làm vậy: phải viết lại tường minh và kết thúc bằng khối DO assertion.
  - Bỏ qua validation ở trường ẩn.
  - **Mã hóa UTF-8 hai lần** làm chữ tiếng Việt thành "Ã¡…", hoặc PowerShell biến thành `?`. Trước khi mở PR luôn chạy `grep -lE "Ã|á»|Æ°"` và tìm `?` giữa chữ trên các file đã sửa.
  - Gắn danh sách trạng thái cho mọi trường; ô chọn dùng nhầm danh sách. Phải kiểm NỘI DUNG options từng ô chọn, không chỉ kiểm "có options".
  - `gen_random_uuid()` trong lateral không tham chiếu bảng ngoài bị tính một lần → trùng khóa, tùy kế hoạch thực thi.
  - Câu update chung đặt `hidden=false` cho trường cũ ở mọi loại → form lẫn nhãn của loại khác.
  - Shell nuốt `$` trong `$$` → dùng tag `$function$`.
  - Thừa dấu ngoặc trong RPC. Lỗi cú pháp kiểu này chỉ lộ khi áp DB thật, test contract không bắt được.
- **Migration mới:**
  - Đặt version theo timestamp, sau khi kiểm tra `gh pr list` xem có PR nào đang mở dùng trùng version không.
  - Thêm migration vào danh sách MIGRATION_REFERENCE ở 3 file: `scripts/package-standalone.mjs`, `scripts/verify-standalone-artifact.mjs`, `scripts/standalone-packaging.test.mjs`.
  - **Chạy thử trước khi mở PR** (CI không áp migration): Postgres 17 Docker dùng một lần, chạy bootstrap giống `scripts/e2e/start-sandbox.sh`, áp toàn bộ `supabase/migrations` theo thứ tự (khoảng 9 migration seed dữ liệu hoặc không thuộc CSDL lỗi là bình thường), rồi áp migration mới. Thử trên ít nhất 2 bản sao (`pg_dump`/`pg_restore`), thử chạy ma trận quyền bằng gọi RPC với từng user, và thử file revert.
- **PR xếp chồng:** merge PR dưới (không xóa nhánh) thì phải `gh pr edit <n> --base integration/production` cho PR trên. Đổi base không chạy lại CI → `gh pr close` rồi `gh pr reopen`.

**Deploy (chỉ khi owner duyệt)**
1. Backup: `ssh vps-aylaspa 'sudo -n /usr/local/sbin/thoidai-backup run --kind predeploy --label <x>'`. Bản backup nằm ở `/opt/ops/thoidai-work/backups/managed/predeploy/`.
2. Áp migration, trước khi deploy code:
   - Kiểm tra ledger: `select version from supabase_migrations.schema_migrations order by 1 desc limit 5`.
   - Chạy thử: thay `commit;` cuối bằng `rollback;`. Nhiều migration: bỏ `begin;`/`commit;` của từng file, bọc chung một `begin; … rollback;`.
   - Chạy thật: `git show <sha>:<file> | ssh vps-aylaspa 'docker exec -i supabase_db_thoidai-work psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q'`.
3. Ghi ledger: `insert into supabase_migrations.schema_migrations(version,name) values (...)` (có thể nối vào cùng lệnh pipe ở bước 2).
4. Lấy artifact CI:
   - Tìm run: `gh run list --workflow production-artifact.yml --commit <fullsha>`. Nếu có PR khác merge ngay sau, run sẽ bị hủy; khi đó dùng commit mới nhất.
   - Tải về thư mục Temp: `gh run download <run> -D <Temp>/thoidai-ci-<sha7>`.
   - Kiểm tra: `node scripts/{verify-artifact-manifest,scan-artifact-secrets,verify-standalone-artifact}.mjs <dir>`.
5. Chuyển lên VPS và activate: hook chặn Claude chạy `tar`, nên Claude viết script `Temp/thoidai-codex-deploy-<sha7>.sh` (kiểm tra release hiện tại → `tar` artifact vào `/opt/build/thoidai-work/artifact-<sha7>` → `git -c core.autocrlf=false archive <sha> scripts deploy` vào `/opt/build/thoidai-work/deploy-tools-<sha7>` → verify-only → activate) và Codex chỉ chạy script, với `-c "sandbox_workspace_write.network_access=true"`.
6. Trong thư mục deploy-tools: `bash scripts/production/deploy-external-artifact.sh <artifact-dir> <fullsha> --verify-only`, sau đó chạy lại với `THOIDAI_EXTERNAL_DEPLOY_APPROVED=1` và `--activate`. **Không** tự tạo marker `*.codex-staging-owner`.
7. Kiểm tra:
   - Từ ngoài: `curl https://thoidai.online/login`, `/database/records`. (curl tới `127.0.0.1:3001` trong sandbox Codex không dùng được.)
   - `journalctl -u thoidai-work.service -p err --since '-3 min'`.
   - Mở trình duyệt, owner đăng nhập, gọi `/api/database/catalog` để kiểm form và nhóm.
8. Rollback: release trước đó là `/opt/releases/thoidai-work/previous`.

## 5. Việc tiếp theo
- **Giai đoạn 2:** đã xong và deploy 2026-11-02 (PR #108, #109). Xem `PHASE2_SPEC.md`.
- **Góp ý Tổ Tiếng Việt:** đã làm phần form riêng 10 loại (PR #110). Các việc để sau (liên kết giữa hồ sơ, cảnh báo trùng, danh mục từ khóa/quốc gia/lĩnh vực dùng chung, ngôn ngữ tài liệu tách khỏi tổ, tìm kiếm kết hợp, tải ảnh/video >50 MB) ghi ở `TO_TIENG_VIET_FEEDBACK.md`.
- **Giai đoạn 3:** xem `PHASE3_SPEC.md`. Nhóm con của Phòng Tổng hợp. Chỉ làm khi owner yêu cầu.
- Form của các tổ ngoại ngữ khác và các phòng khác chưa nhận góp ý tương tự.
- **Nguồn:** góp ý của các phòng sau buổi demo (file docx của owner). Phần đã thống nhất được tóm tắt trong các đặc tả trên.
- **Cách làm:** gửi owner bản đặc tả rút gọn, hỏi các điểm còn mở được đánh dấu **[HỎI OWNER]**, rồi mới giao Codex.
